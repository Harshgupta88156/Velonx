import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb } from "../src/lib/db";
import { GET as health } from "../src/app/api/health/route";
import { GET as snapshot } from "../src/app/api/snapshot/route";
import { POST as operations } from "../src/app/api/operations/route";
import { POST as interventions } from "../src/app/api/interventions/route";
import { POST as inventory } from "../src/app/api/inventory/[id]/route";
import { POST as transition } from "../src/app/api/transfers/[id]/route";

const directory = mkdtempSync(join(tmpdir(), "districtcare-routes-"));
process.env.DATABASE_PATH = join(directory, "routes.sqlite");
process.env.DEMO_MODE = "true";
delete process.env.TURSO_DATABASE_URL;
after(async () => {
  (await getDb()).close();
  rmSync(directory, { recursive: true, force: true });
});
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const context = (id: string) => ({ params: Promise.resolve({ id }) });

test("health and snapshot routes expose synthetic, uncached, well-formed data", async () => {
  const ok = await health();
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { status: "ok", synthetic: true });
  const response = await snapshot();
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.snapshot.synthetic, true);
  assert.equal(body.snapshot.facilities.length, 8);
  assert.equal(body.demoMode, true);
  assert.ok(Array.isArray(body.interventions));
  assert.equal(body.quality.summary.historySeries, 56);
  assert.ok(body.intelligence.recommendations.length > 0);
});

test("mutation routes return JSON errors with the right status and no internals", async () => {
  const badJson = await operations(post("{not json"));
  assert.equal(badJson.status, 400);
  const invalid = await operations(
    post({ facilityId: "rampur", role: "administrator", beds: -1 }),
  );
  assert.equal(invalid.status, 400);
  const forbidden = await interventions(
    post({
      facilityId: "rampur",
      role: "inventory",
      status: "acknowledged",
      note: "Checked stock",
    }),
  );
  assert.equal(forbidden.status, 403);
  const missing = await transition(
    post({ action: "dispatch", role: "administrator" }),
    context("nope"),
  );
  assert.equal(missing.status, 404);
  const absent = await inventory(
    post({
      quantity: 1,
      version: 1,
      reason: "Stock count",
      role: "administrator",
    }),
    context("nope"),
  );
  assert.equal(absent.status, 404);
  const crossOrigin = await operations(
    post(
      { facilityId: "rampur", role: "administrator", beds: 10 },
      { origin: "https://evil.example", host: "localhost" },
    ),
  );
  assert.equal(crossOrigin.status, 403);
  for (const response of [
    badJson,
    invalid,
    forbidden,
    missing,
    absent,
    crossOrigin,
  ]) {
    const { error } = await response.json();
    assert.equal(typeof error, "string");
    assert.ok(
      !/\bat \S+:\d+|node_modules|\.tsx?\b|\/Users\//.test(error),
      "error text must not expose stack or paths",
    );
  }
});

test("a valid operations update persists and is visible in the next snapshot", async () => {
  const before = (await (await snapshot()).json()).snapshot;
  const response = await operations(
    post({ facilityId: "rampur", role: "administrator", patientsToday: 77 }),
  );
  assert.equal(response.status, 200);
  const after = (await (await snapshot()).json()).snapshot;
  assert.equal(
    after.facilities.find((f: { id: string }) => f.id === "rampur")
      .patientsToday,
    77,
  );
  assert.equal(after.revision, before.revision + 1);
});

test("write rate limit returns 429 after 60 writes per minute from one client", async () => {
  const { rateLimit } = await import("../src/lib/http");
  const request = new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.9" },
  });
  const start = 1_000_000;
  for (let i = 0; i < 60; i++) rateLimit(request, start + i);
  assert.throws(() => rateLimit(request, start + 61), /Too many changes/);
  assert.doesNotThrow(() => rateLimit(request, start + 61_000));
});

test("body limit counts bytes, not characters", async () => {
  const { jsonBody } = await import("../src/lib/http");
  // 6,000 three-byte characters is 18,000 bytes but only 6,000 characters.
  const body = JSON.stringify({ note: "ह".repeat(6_000) });
  const request = new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  await assert.rejects(() => jsonBody(request), /too large/);
});
