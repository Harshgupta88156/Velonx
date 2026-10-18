import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, loadSnapshot } from "../src/lib/db";
import type { Snapshot } from "../src/lib/types";
import { analyze } from "../src/lib/intelligence";
import {
  approveTransfer,
  transitionTransfer,
  updateInventory,
  updateOperations,
  ServiceError,
  approvalSchema,
  transitionSchema,
  inventorySchema,
  operationSchema,
} from "../src/lib/service";
import { authorizeRequest, jsonBody, handleError } from "../src/lib/http";

const testDirectory = mkdtempSync(
  join(tmpdir(), "districtcare-service-tests-"),
);
const originalPath = process.env.DATABASE_PATH;
const originalMode = process.env.DEMO_MODE;
const originalKey = process.env.ADMIN_KEY;
let databaseNumber = 0;
beforeEach(() => {
  process.env.DATABASE_PATH = join(
    testDirectory,
    `case-${++databaseNumber}.sqlite`,
  );
  process.env.DEMO_MODE = "true";
  delete process.env.ADMIN_KEY;
});
after(async () => {
  (await getDb()).close();
  rmSync(testDirectory, { recursive: true, force: true });
  for (const [key, value] of Object.entries({
    DATABASE_PATH: originalPath,
    DEMO_MODE: originalMode,
    ADMIN_KEY: originalKey,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
const throwsStatus = (callback: () => Promise<unknown>, status: number) =>
  assert.rejects(
    callback,
    (error: unknown) =>
      error instanceof ServiceError && error.status === status,
  );
const throwsStatusSync = (callback: () => unknown, status: number) =>
  assert.throws(
    callback,
    (error: unknown) =>
      error instanceof ServiceError && error.status === status,
  );
async function recommendation() {
  const snapshot = await loadSnapshot();
  const intelligence = analyze(snapshot);
  const recommendation = intelligence.recommendations.find(
    (rec) =>
      !intelligence.inventory.find(
        (row) =>
          row.facilityId === rec.recipientId &&
          row.medicineId === rec.medicineId,
      )!.expired,
  );
  assert.ok(recommendation, "seed must have a feasible recommendation");
  return recommendation;
}
async function approve(rec?: Awaited<ReturnType<typeof recommendation>>) {
  rec = rec ?? (await recommendation());
  const result = await approveTransfer({
    recommendationId: rec.id,
    donorInventoryVersion: rec.donorInventoryVersion,
    recipientInventoryVersion: rec.recipientInventoryVersion,
    role: "administrator",
  });
  return { rec, result };
}

test("approval reserves physical stock; lifecycle conserves total units and audits transitions", async () => {
  const before = await loadSnapshot();
  const { rec, result } = await approve();
  const donor = (s: Snapshot) =>
    s.inventory.find(
      (row) =>
        row.facilityId === rec.donorId && row.medicineId === rec.medicineId,
    )!;
  const recipient = (s: Snapshot) =>
    s.inventory.find(
      (row) =>
        row.facilityId === rec.recipientId && row.medicineId === rec.medicineId,
    )!;
  assert.equal(donor(await loadSnapshot()).quantity, donor(before).quantity);
  assert.equal(
    donor(await loadSnapshot()).reserved,
    donor(before).reserved + rec.quantity,
  );
  assert.equal(
    recipient(await loadSnapshot()).quantity,
    recipient(before).quantity,
  );
  const afterApproval = await loadSnapshot();
  await throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "receive",
        role: "administrator",
      }),
    409,
  );
  assert.deepEqual(
    await loadSnapshot(),
    afterApproval,
    "failed transition rolls back all writes",
  );
  await transitionTransfer(result.id, {
    action: "dispatch",
    role: "inventory",
    facilityId: rec.donorId,
  });
  assert.equal(
    donor(await loadSnapshot()).quantity,
    donor(before).quantity - rec.quantity,
  );
  assert.equal(donor(await loadSnapshot()).reserved, donor(before).reserved);
  assert.equal(
    recipient(await loadSnapshot()).quantity,
    recipient(before).quantity,
  );
  await throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "dispatch",
        role: "administrator",
      }),
    409,
  );
  await throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "receive",
        role: "inventory",
        facilityId: rec.donorId,
      }),
    403,
  );
  await transitionTransfer(result.id, {
    action: "receive",
    role: "inventory",
    facilityId: rec.recipientId,
  });
  assert.equal(
    recipient(await loadSnapshot()).quantity,
    recipient(before).quantity + rec.quantity,
  );
  assert.equal(
    donor(await loadSnapshot()).quantity +
      recipient(await loadSnapshot()).quantity,
    donor(before).quantity + recipient(before).quantity,
  );
  await throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "receive",
        role: "administrator",
      }),
    409,
  );
  const after = await loadSnapshot();
  assert.equal(after.revision, before.revision + 3);
  assert.deepEqual(
    after.audit
      .filter((event) => event.entityId === result.id)
      .map((event) => event.action)
      .sort(),
    ["transfer.approved", "transfer.dispatched", "transfer.received"],
  );
});

test("stale versions, repeated approval, and non-administrator approvals fail without mutation", async () => {
  const rec = await recommendation();
  const input = {
    recommendationId: rec.id,
    donorInventoryVersion: rec.donorInventoryVersion,
    recipientInventoryVersion: rec.recipientInventoryVersion,
    role: "administrator" as const,
  };
  const before = await loadSnapshot();
  await throwsStatus(() => approveTransfer({ ...input, role: "officer" }), 403);
  await throwsStatus(
    () =>
      approveTransfer({
        ...input,
        donorInventoryVersion: input.donorInventoryVersion + 1,
      }),
    409,
  );
  assert.deepEqual(await loadSnapshot(), before);
  await approveTransfer(input);
  const once = await loadSnapshot();
  await throwsStatus(() => approveTransfer(input), 409);
  assert.deepEqual(await loadSnapshot(), once);
  assert.ok(
    !analyze(once).recommendations.some(
      (row) =>
        row.recipientId === rec.recipientId &&
        row.medicineId === rec.medicineId,
    ),
    "pending inbound prevents another donor overfilling target",
  );
});

test("cancel releases reservations and requires administrator role", async () => {
  const { rec, result } = await approve();
  const before = await loadSnapshot();
  await throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "cancel",
        role: "inventory",
        facilityId: rec.donorId,
      }),
    403,
  );
  assert.deepEqual(await loadSnapshot(), before);
  await transitionTransfer(result.id, {
    action: "cancel",
    role: "administrator",
  });
  const after = await loadSnapshot();
  const donorBefore = before.inventory.find(
    (row) =>
      row.facilityId === rec.donorId && row.medicineId === rec.medicineId,
  )!;
  const donorAfter = after.inventory.find((row) => row.id === donorBefore.id)!;
  assert.equal(donorAfter.reserved, donorBefore.reserved - rec.quantity);
  assert.equal(donorAfter.quantity, donorBefore.quantity);
  assert.equal(
    after.transfers.find((t) => t.id === result.id)!.status,
    "cancelled",
  );
  assert.ok(after.audit.some((event) => event.action === "transfer.cancelled"));
  await throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "cancel",
        role: "administrator",
      }),
    409,
  );
});

test("inventory and transfer mutations enforce responsible facility and reserved floor", async () => {
  const { rec, result } = await approve();
  const before = await loadSnapshot();
  const donor = before.inventory.find(
    (row) =>
      row.facilityId === rec.donorId && row.medicineId === rec.medicineId,
  )!;
  await throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "dispatch",
        role: "officer",
        facilityId: rec.recipientId,
      }),
    403,
  );
  await throwsStatus(
    () =>
      transitionTransfer(result.id, { action: "dispatch", role: "inventory" }),
    403,
  );
  await throwsStatus(
    () =>
      updateInventory(donor.id, {
        quantity: donor.quantity,
        version: donor.version,
        reason: "Stock recount",
        role: "inventory",
        facilityId: rec.recipientId,
      }),
    403,
  );
  await throwsStatus(
    () =>
      updateInventory(donor.id, {
        quantity: donor.reserved - 1,
        version: donor.version,
        reason: "Stock recount",
        role: "administrator",
      }),
    409,
  );
  await throwsStatus(
    () =>
      updateInventory(donor.id, {
        quantity: donor.quantity,
        version: donor.version + 1,
        reason: "Stock recount",
        role: "administrator",
      }),
    409,
  );
  assert.deepEqual(await loadSnapshot(), before);
  await updateInventory(donor.id, {
    quantity: donor.quantity + 1,
    version: donor.version,
    reason: "Stock recount",
    role: "inventory",
    facilityId: rec.donorId,
  });
  assert.equal(
    (await loadSnapshot()).inventory.find((row) => row.id === donor.id)!
      .quantity,
    donor.quantity + 1,
  );
});

test("expired destination batch is quarantined before receipt", async () => {
  const rec = await recommendation();
  await (
    await getDb()
  )
    .prepare(
      "UPDATE inventory SET quantity=22,expiry=? WHERE facility_id=? AND medicine_id=?",
    )
    .run("2000-01-01", rec.recipientId, rec.medicineId);
  const selectedRecommendation = analyze(
    await loadSnapshot(),
  ).recommendations.find(
    (row) =>
      row.recipientId === rec.recipientId && row.medicineId === rec.medicineId,
  )!;
  assert.ok(selectedRecommendation);
  const { rec: selected, result } = await approve(selectedRecommendation);
  await transitionTransfer(result.id, {
    action: "dispatch",
    role: "administrator",
  });
  await transitionTransfer(result.id, {
    action: "receive",
    role: "administrator",
  });
  const after = await loadSnapshot();
  const destination = after.inventory.find(
    (row) =>
      row.facilityId === selected.recipientId &&
      row.medicineId === selected.medicineId,
  )!;
  assert.equal(
    destination.quantity,
    selected.quantity,
    "expired 22 units are excluded from usable stock",
  );
  assert.ok(
    after.audit.some(
      (event) =>
        event.action === "inventory.quarantined" &&
        event.entityId === destination.id &&
        JSON.parse(event.detail).quantity === 22,
    ),
  );
});

test("dispatch revalidates donor safety after a later stock adjustment", async () => {
  const { rec, result } = await approve();
  const donor = (await loadSnapshot()).inventory.find(
    (row) =>
      row.facilityId === rec.donorId && row.medicineId === rec.medicineId,
  )!;
  await updateInventory(donor.id, {
    quantity: donor.reserved,
    version: donor.version,
    reason: "Count corrected after damage",
    role: "administrator",
  });
  const before = await loadSnapshot();
  await throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "dispatch",
        role: "administrator",
      }),
    409,
  );
  assert.deepEqual(await loadSnapshot(), before);
  await transitionTransfer(result.id, {
    action: "cancel",
    role: "administrator",
  });
  assert.equal(
    (await loadSnapshot()).inventory.find((row) => row.id === donor.id)!
      .reserved,
    0,
  );
});

test("expired shipment is rejected on receipt with all state rolled back", async () => {
  const { result } = await approve();
  await transitionTransfer(result.id, {
    action: "dispatch",
    role: "administrator",
  });
  await (
    await getDb()
  )
    .prepare("UPDATE meta SET value=? WHERE key=?")
    .run("2000-01-01", `transfer-expiry:${result.id}`);
  const before = await loadSnapshot();
  await throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "receive",
        role: "administrator",
      }),
    409,
  );
  assert.deepEqual(await loadSnapshot(), before);
});

test("operations validation and missing records roll back cleanly", async () => {
  const before = await loadSnapshot();
  const f = before.facilities[0];
  await throwsStatus(
    () =>
      updateOperations({
        facilityId: f.id,
        role: "inventory",
        patientsToday: 5,
      }),
    403,
  );
  await throwsStatus(
    () =>
      updateOperations({
        facilityId: f.id,
        role: "officer",
        occupied: f.beds + 1,
      }),
    400,
  );
  await throwsStatus(
    () =>
      updateOperations({
        facilityId: f.id,
        role: "officer",
        presentDoctors: f.scheduledDoctors + 1,
      }),
    400,
  );
  await throwsStatus(
    () =>
      updateOperations({
        facilityId: f.id,
        role: "officer",
        equipment: "down",
      }),
    400,
  );
  await throwsStatus(
    () =>
      updateOperations({
        facilityId: f.id,
        role: "officer",
        diagnosticId: "missing",
        equipment: "down",
        patientsToday: 1,
      }),
    404,
  );
  await throwsStatus(
    () =>
      transitionTransfer("missing", {
        action: "cancel",
        role: "administrator",
      }),
    404,
  );
  assert.deepEqual(await loadSnapshot(), before);
});

test("schemas reject negatives, fractions, excess fields, and empty operation payloads", async () => {
  const valid = {
    quantity: 10,
    version: 1,
    reason: "Manual recount",
    role: "administrator",
  };
  for (const patch of [
    { quantity: -1 },
    { quantity: 1.5 },
    { quantity: 10_000_001 },
    { version: 0 },
    { reason: "x" },
    { extra: true },
  ])
    assert.equal(
      inventorySchema.safeParse({ ...valid, ...patch }).success,
      false,
    );
  assert.equal(inventorySchema.safeParse(valid).success, true);
  assert.equal(
    approvalSchema.safeParse({
      recommendationId: "x",
      donorInventoryVersion: 1,
      recipientInventoryVersion: 1,
      role: "administrator",
      quantity: 999,
    }).success,
    false,
  );
  assert.equal(
    transitionSchema.safeParse({ action: "receive", role: "unknown" }).success,
    false,
  );
  assert.equal(
    operationSchema.safeParse({ facilityId: "x", role: "officer" }).success,
    false,
  );
  assert.equal(
    operationSchema.safeParse({
      facilityId: "x",
      role: "officer",
      patientsToday: -1,
    }).success,
    false,
  );
});

test("HTTP mutation guard rejects cross-origin and protected mode without exact key", async () => {
  const request = (headers: Record<string, string> = {}) =>
    new Request("http://localhost:3000/api/inventory/x", {
      method: "POST",
      headers,
    });
  authorizeRequest(request({ origin: "http://localhost:3000" }));
  throwsStatusSync(
    () => authorizeRequest(request({ origin: "not-a-valid-origin" })),
    403,
  );
  throwsStatusSync(() => authorizeRequest(request({ origin: "null" })), 403);
  throwsStatusSync(
    () => authorizeRequest(request({ "sec-fetch-site": "cross-site" })),
    403,
  );
  throwsStatusSync(
    () => authorizeRequest(request({ origin: "https://attacker.example" })),
    403,
  );
  process.env.DEMO_MODE = "false";
  throwsStatusSync(() => authorizeRequest(request()), 401);
  process.env.ADMIN_KEY = "test-key-only";
  throwsStatusSync(() => authorizeRequest(request()), 401);
  throwsStatusSync(
    () => authorizeRequest(request({ "x-admin-key": "wrong-key" })),
    401,
  );
  authorizeRequest(request({ "x-admin-key": "test-key-only" }));
  throwsStatusSync(
    () =>
      authorizeRequest(
        request({
          origin: "https://attacker.example",
          "x-admin-key": "test-key-only",
        }),
      ),
    403,
  );
});

test("HTTP body parser limits content and maps errors to safe response statuses", async () => {
  const request = (body: string, contentType = "application/json") =>
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
  assert.deepEqual(await jsonBody(request('{"quantity":3}')), { quantity: 3 });
  for (const [body, contentType, status] of [
    ["{}", "text/plain", 415],
    ["{oops", "application/json", 400],
    [" ".repeat(16385), "application/json", 413],
  ] as const) {
    await assert.rejects(
      () => jsonBody(request(body, contentType)),
      (error: unknown) =>
        error instanceof ServiceError && error.status === status,
    );
  }
  assert.equal(handleError(new ServiceError(409, "Changed")).status, 409);
  const parse = inventorySchema.safeParse({ quantity: -1 });
  assert.ok(!parse.success);
  assert.equal(handleError(parse.error).status, 400);
});
