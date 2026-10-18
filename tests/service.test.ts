import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, loadSnapshot } from "../src/lib/db";
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

const testDirectory = mkdtempSync(join(tmpdir(), "velonx-service-tests-"));
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
after(() => {
  getDb().close();
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
const throwsStatus = (callback: () => unknown, status: number) =>
  assert.throws(
    callback,
    (error: unknown) =>
      error instanceof ServiceError && error.status === status,
  );
function recommendation() {
  const snapshot = loadSnapshot();
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
function approve(rec = recommendation()) {
  const result = approveTransfer({
    recommendationId: rec.id,
    donorInventoryVersion: rec.donorInventoryVersion,
    recipientInventoryVersion: rec.recipientInventoryVersion,
    role: "administrator",
  });
  return { rec, result };
}

test("approval reserves physical stock; lifecycle conserves total units and audits transitions", () => {
  const before = loadSnapshot();
  const { rec, result } = approve();
  const donor = (s = loadSnapshot()) =>
    s.inventory.find(
      (row) =>
        row.facilityId === rec.donorId && row.medicineId === rec.medicineId,
    )!;
  const recipient = (s = loadSnapshot()) =>
    s.inventory.find(
      (row) =>
        row.facilityId === rec.recipientId && row.medicineId === rec.medicineId,
    )!;
  assert.equal(donor().quantity, donor(before).quantity);
  assert.equal(donor().reserved, donor(before).reserved + rec.quantity);
  assert.equal(recipient().quantity, recipient(before).quantity);
  const afterApproval = loadSnapshot();
  throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "receive",
        role: "administrator",
      }),
    409,
  );
  assert.deepEqual(
    loadSnapshot(),
    afterApproval,
    "failed transition rolls back all writes",
  );
  transitionTransfer(result.id, {
    action: "dispatch",
    role: "inventory",
    facilityId: rec.donorId,
  });
  assert.equal(donor().quantity, donor(before).quantity - rec.quantity);
  assert.equal(donor().reserved, donor(before).reserved);
  assert.equal(recipient().quantity, recipient(before).quantity);
  throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "dispatch",
        role: "administrator",
      }),
    409,
  );
  throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "receive",
        role: "inventory",
        facilityId: rec.donorId,
      }),
    403,
  );
  transitionTransfer(result.id, {
    action: "receive",
    role: "inventory",
    facilityId: rec.recipientId,
  });
  assert.equal(recipient().quantity, recipient(before).quantity + rec.quantity);
  assert.equal(
    donor().quantity + recipient().quantity,
    donor(before).quantity + recipient(before).quantity,
  );
  throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "receive",
        role: "administrator",
      }),
    409,
  );
  const after = loadSnapshot();
  assert.equal(after.revision, before.revision + 3);
  assert.deepEqual(
    after.audit
      .filter((event) => event.entityId === result.id)
      .map((event) => event.action)
      .sort(),
    ["transfer.approved", "transfer.dispatched", "transfer.received"],
  );
});

test("stale versions, repeated approval, and non-administrator approvals fail without mutation", () => {
  const rec = recommendation();
  const input = {
    recommendationId: rec.id,
    donorInventoryVersion: rec.donorInventoryVersion,
    recipientInventoryVersion: rec.recipientInventoryVersion,
    role: "administrator" as const,
  };
  const before = loadSnapshot();
  throwsStatus(() => approveTransfer({ ...input, role: "officer" }), 403);
  throwsStatus(
    () =>
      approveTransfer({
        ...input,
        donorInventoryVersion: input.donorInventoryVersion + 1,
      }),
    409,
  );
  assert.deepEqual(loadSnapshot(), before);
  approveTransfer(input);
  const once = loadSnapshot();
  throwsStatus(() => approveTransfer(input), 409);
  assert.deepEqual(loadSnapshot(), once);
  assert.ok(
    !analyze(once).recommendations.some(
      (row) =>
        row.recipientId === rec.recipientId &&
        row.medicineId === rec.medicineId,
    ),
    "pending inbound prevents another donor overfilling target",
  );
});

test("cancel releases reservations and requires administrator role", () => {
  const { rec, result } = approve();
  const before = loadSnapshot();
  throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "cancel",
        role: "inventory",
        facilityId: rec.donorId,
      }),
    403,
  );
  assert.deepEqual(loadSnapshot(), before);
  transitionTransfer(result.id, { action: "cancel", role: "administrator" });
  const after = loadSnapshot();
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
  throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "cancel",
        role: "administrator",
      }),
    409,
  );
});

test("inventory and transfer mutations enforce responsible facility and reserved floor", () => {
  const { rec, result } = approve();
  const before = loadSnapshot();
  const donor = before.inventory.find(
    (row) =>
      row.facilityId === rec.donorId && row.medicineId === rec.medicineId,
  )!;
  throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "dispatch",
        role: "officer",
        facilityId: rec.recipientId,
      }),
    403,
  );
  throwsStatus(
    () =>
      transitionTransfer(result.id, { action: "dispatch", role: "inventory" }),
    403,
  );
  throwsStatus(
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
  throwsStatus(
    () =>
      updateInventory(donor.id, {
        quantity: donor.reserved - 1,
        version: donor.version,
        reason: "Stock recount",
        role: "administrator",
      }),
    409,
  );
  throwsStatus(
    () =>
      updateInventory(donor.id, {
        quantity: donor.quantity,
        version: donor.version + 1,
        reason: "Stock recount",
        role: "administrator",
      }),
    409,
  );
  assert.deepEqual(loadSnapshot(), before);
  updateInventory(donor.id, {
    quantity: donor.quantity + 1,
    version: donor.version,
    reason: "Stock recount",
    role: "inventory",
    facilityId: rec.donorId,
  });
  assert.equal(
    loadSnapshot().inventory.find((row) => row.id === donor.id)!.quantity,
    donor.quantity + 1,
  );
});

test("expired destination batch is quarantined before receipt", () => {
  const rec = recommendation();
  getDb()
    .prepare(
      "UPDATE inventory SET quantity=22,expiry=? WHERE facility_id=? AND medicine_id=?",
    )
    .run("2000-01-01", rec.recipientId, rec.medicineId);
  const selectedRecommendation = analyze(loadSnapshot()).recommendations.find(
    (row) =>
      row.recipientId === rec.recipientId && row.medicineId === rec.medicineId,
  )!;
  assert.ok(selectedRecommendation);
  const { rec: selected, result } = approve(selectedRecommendation);
  transitionTransfer(result.id, { action: "dispatch", role: "administrator" });
  transitionTransfer(result.id, { action: "receive", role: "administrator" });
  const after = loadSnapshot();
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

test("dispatch revalidates donor safety after a later stock adjustment", () => {
  const { rec, result } = approve();
  const donor = loadSnapshot().inventory.find(
    (row) =>
      row.facilityId === rec.donorId && row.medicineId === rec.medicineId,
  )!;
  updateInventory(donor.id, {
    quantity: donor.reserved,
    version: donor.version,
    reason: "Count corrected after damage",
    role: "administrator",
  });
  const before = loadSnapshot();
  throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "dispatch",
        role: "administrator",
      }),
    409,
  );
  assert.deepEqual(loadSnapshot(), before);
  transitionTransfer(result.id, { action: "cancel", role: "administrator" });
  assert.equal(
    loadSnapshot().inventory.find((row) => row.id === donor.id)!.reserved,
    0,
  );
});

test("expired shipment is rejected on receipt with all state rolled back", () => {
  const { result } = approve();
  transitionTransfer(result.id, { action: "dispatch", role: "administrator" });
  getDb()
    .prepare("UPDATE meta SET value=? WHERE key=?")
    .run("2000-01-01", `transfer-expiry:${result.id}`);
  const before = loadSnapshot();
  throwsStatus(
    () =>
      transitionTransfer(result.id, {
        action: "receive",
        role: "administrator",
      }),
    409,
  );
  assert.deepEqual(loadSnapshot(), before);
});

test("operations validation and missing records roll back cleanly", () => {
  const before = loadSnapshot();
  const f = before.facilities[0];
  throwsStatus(
    () =>
      updateOperations({
        facilityId: f.id,
        role: "inventory",
        patientsToday: 5,
      }),
    403,
  );
  throwsStatus(
    () =>
      updateOperations({
        facilityId: f.id,
        role: "officer",
        occupied: f.beds + 1,
      }),
    400,
  );
  throwsStatus(
    () =>
      updateOperations({
        facilityId: f.id,
        role: "officer",
        presentDoctors: f.scheduledDoctors + 1,
      }),
    400,
  );
  throwsStatus(
    () =>
      updateOperations({
        facilityId: f.id,
        role: "officer",
        equipment: "down",
      }),
    400,
  );
  throwsStatus(
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
  throwsStatus(
    () =>
      transitionTransfer("missing", {
        action: "cancel",
        role: "administrator",
      }),
    404,
  );
  assert.deepEqual(loadSnapshot(), before);
});

test("schemas reject negatives, fractions, excess fields, and empty operation payloads", () => {
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

test("HTTP mutation guard rejects cross-origin and protected mode without exact key", () => {
  const request = (headers: Record<string, string> = {}) =>
    new Request("http://localhost:3000/api/inventory/x", {
      method: "POST",
      headers,
    });
  authorizeRequest(request({ origin: "http://localhost:3000" }));
  throwsStatus(() => authorizeRequest(request({ origin: "not-a-valid-origin" })), 403);
  throwsStatus(() => authorizeRequest(request({ origin: "null" })), 403);
  throwsStatus(() => authorizeRequest(request({ "sec-fetch-site": "cross-site" })), 403);
  throwsStatus(
    () => authorizeRequest(request({ origin: "https://attacker.example" })),
    403,
  );
  process.env.DEMO_MODE = "false";
  throwsStatus(() => authorizeRequest(request()), 401);
  process.env.ADMIN_KEY = "test-key-only";
  throwsStatus(() => authorizeRequest(request()), 401);
  throwsStatus(
    () => authorizeRequest(request({ "x-admin-key": "wrong-key" })),
    401,
  );
  authorizeRequest(request({ "x-admin-key": "test-key-only" }));
  throwsStatus(
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
