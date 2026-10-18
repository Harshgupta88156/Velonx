import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

// Runs only against an owned production process and disposable database.
const directory = await mkdtemp(join(tmpdir(), "districtcare-http-"));
const port = process.env.TEST_PORT || "3107";
const base = `http://127.0.0.1:${port}`;
let child;
let log = "";
let checks = 0;
async function start() {
  child = spawn(process.execPath, ["scripts/start.mjs"], {
    env: {
      ...process.env,
      PORT: port,
      BIND_HOST: "127.0.0.1",
      DATABASE_PATH: join(directory, "test.db"),
      DEMO_MODE: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => {
    log += d.toString();
  });
  child.stderr.on("data", (d) => {
    log += d.toString();
  });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${log}`);
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Startup timeout: ${log}`);
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const ended = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await ended;
}
async function snapshot() {
  const r = await fetch(`${base}/api/snapshot`);
  assert.equal(r.status, 200);
  return r.json();
}
async function post(path, body, expected = 200, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base, ...headers },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  assert.equal(
    response.status,
    expected,
    `${path}: ${JSON.stringify(payload)}`,
  );
  checks++;
  return payload;
}
try {
  await start();
  let data = await snapshot();
  assert.equal(data.snapshot.facilities.length, 8);
  assert.equal(data.snapshot.synthetic, true);
  const rec = data.intelligence.recommendations.find(
    (r) => r.recipientId === "rampur" && r.medicineId === "paracetamol",
  );
  assert.ok(rec);
  const row = (s, id) => s.inventory.find((i) => i.id === id);
  const donorId = `${rec.donorId}-${rec.medicineId}`,
    recipientId = `${rec.recipientId}-${rec.medicineId}`;
  const beforeDonor = row(data.snapshot, donorId),
    beforeRecipient = row(data.snapshot, recipientId);
  const approval = {
    recommendationId: rec.id,
    donorInventoryVersion: rec.donorInventoryVersion,
    recipientInventoryVersion: rec.recipientInventoryVersion,
    role: "administrator",
  };
  await post("/api/transfers", { ...approval, role: "officer" }, 403);
  await post("/api/transfers", approval, 403, {
    Origin: "https://untrusted.example",
  });
  const parallel = await Promise.all(
    [0, 1].map(async () => {
      const r = await fetch(`${base}/api/transfers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify(approval),
      });
      return { status: r.status, body: await r.json() };
    }),
  );
  assert.deepEqual(parallel.map((x) => x.status).sort(), [201, 409]);
  checks++;
  const id = parallel.find((x) => x.status === 201).body.id;
  data = await snapshot();
  assert.equal(data.snapshot.transfers.length, 1);
  assert.equal(row(data.snapshot, donorId).quantity, beforeDonor.quantity);
  assert.equal(row(data.snapshot, donorId).reserved, rec.quantity);
  assert.equal(
    row(data.snapshot, recipientId).quantity,
    beforeRecipient.quantity,
  );
  await post(
    `/api/transfers/${id}`,
    { action: "receive", role: "administrator" },
    409,
  );
  await post(
    `/api/transfers/${id}`,
    { action: "dispatch", role: "officer", facilityId: rec.recipientId },
    403,
  );
  await post(`/api/transfers/${id}`, {
    action: "dispatch",
    role: "inventory",
    facilityId: rec.donorId,
  });
  await post(
    `/api/transfers/${id}`,
    { action: "dispatch", role: "administrator" },
    409,
  );
  await post(`/api/transfers/${id}`, {
    action: "receive",
    role: "officer",
    facilityId: rec.recipientId,
  });
  await post(
    `/api/transfers/${id}`,
    { action: "receive", role: "administrator" },
    409,
  );
  data = await snapshot();
  assert.equal(
    row(data.snapshot, donorId).quantity,
    beforeDonor.quantity - rec.quantity,
  );
  assert.equal(row(data.snapshot, donorId).reserved, 0);
  assert.equal(
    row(data.snapshot, recipientId).quantity,
    beforeRecipient.quantity + rec.quantity,
  );
  assert.ok(row(data.snapshot, donorId).quantity >= rec.donorSafetyStock);
  assert.ok(data.snapshot.audit.some((a) => a.action === "transfer.received"));
  const current = row(data.snapshot, recipientId);
  await post(
    `/api/inventory/${recipientId}`,
    {
      quantity: -1,
      version: current.version,
      reason: "invalid test",
      role: "administrator",
    },
    400,
  );
  await post(`/api/inventory/${recipientId}`, {
    quantity: 0,
    version: current.version,
    reason: "Synthetic stock count correction",
    role: "inventory",
    facilityId: rec.recipientId,
  });
  data = await snapshot();
  assert.equal(
    data.intelligence.inventory.find((i) => i.inventoryId === recipientId).risk,
    "critical",
  );
  await post(
    "/api/operations",
    { facilityId: "rampur", role: "officer", beds: 12, occupied: 13 },
    400,
  );
  await post("/api/operations", {
    facilityId: "rampur",
    role: "officer",
    beds: 12,
    occupied: 7,
    attendanceRecorded: false,
    patientsToday: 89,
  });
  data = await snapshot();
  assert.equal(
    data.snapshot.facilities.find((f) => f.id === "rampur").occupied,
    7,
  );
  assert.ok(
    data.intelligence.risks
      .find((f) => f.facilityId === "rampur")
      .reasons.some((r) => r.code === "attendance-not-recorded"),
  );
  const revision = data.snapshot.revision;
  await stop();
  await start();
  data = await snapshot();
  assert.equal(data.snapshot.revision, revision);
  assert.equal(
    data.snapshot.transfers.find((t) => t.id === id).status,
    "received",
  );
  assert.equal(row(data.snapshot, recipientId).quantity, 0);
  checks++;
  console.log(
    `PASS: ${checks} HTTP checks, including concurrent approval, inventory conservation, updated risk, and restart persistence.`,
  );
} finally {
  await stop();
  await rm(directory, { recursive: true, force: true });
}
