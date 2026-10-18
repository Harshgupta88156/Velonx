import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, loadInterventions } from "../src/lib/db";
import { setIntervention, ServiceError } from "../src/lib/service";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "velonx-int-")), "t.sqlite");
const base = { facilityId: "rampur", role: "administrator" as const, note: "Called block officer" };

test("intervention status moves forward only, is admin-only, and is audited", () => {
  const db = getDb();
  const facilityId = (db.prepare("SELECT id FROM facilities LIMIT 1").get() as { id: string }).id;
  const input = { ...base, facilityId };
  assert.throws(() => setIntervention({ ...input, role: "officer", status: "acknowledged" }), (e) => e instanceof ServiceError && e.status === 403);
  assert.throws(() => setIntervention({ ...input, facilityId: "nope", status: "acknowledged" }), (e) => e instanceof ServiceError && e.status === 404);
  setIntervention({ ...input, status: "acknowledged" });
  setIntervention({ ...input, status: "in_progress" });
  assert.throws(() => setIntervention({ ...input, status: "acknowledged" }), (e) => e instanceof ServiceError && e.status === 409);
  assert.equal(loadInterventions(db)[0].status, "in_progress");
  const n = (db.prepare("SELECT COUNT(*) c FROM audit WHERE action LIKE 'intervention.%'").get() as { c: number }).c;
  assert.equal(n, 2);
});
