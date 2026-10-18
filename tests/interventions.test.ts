import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, loadInterventions } from "../src/lib/db";
import { setIntervention, ServiceError } from "../src/lib/service";

process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "districtcare-int-")),
  "t.sqlite",
);
const base = {
  facilityId: "rampur",
  role: "administrator" as const,
  note: "Called block officer",
};

test("intervention status moves forward only, is admin-only, and is audited", async () => {
  const db = await getDb();
  const facilityId = (
    (await db
      .prepare("SELECT id FROM facilities LIMIT 1")
      .get()) as unknown as { id: string }
  ).id;
  const input = { ...base, facilityId };
  await assert.rejects(
    () =>
      setIntervention({ ...input, role: "officer", status: "acknowledged" }),
    (e) => e instanceof ServiceError && e.status === 403,
  );
  await assert.rejects(
    () =>
      setIntervention({ ...input, facilityId: "nope", status: "acknowledged" }),
    (e) => e instanceof ServiceError && e.status === 404,
  );
  await setIntervention({ ...input, status: "acknowledged" });
  await setIntervention({ ...input, status: "in_progress" });
  await assert.rejects(
    () => setIntervention({ ...input, status: "acknowledged" }),
    (e) => e instanceof ServiceError && e.status === 409,
  );
  assert.equal((await loadInterventions(db))[0].status, "in_progress");
  const n = (
    (await db
      .prepare(
        "SELECT COUNT(*) c FROM audit WHERE action LIKE 'intervention.%'",
      )
      .get()) as unknown as { c: number }
  ).c;
  assert.equal(n, 2);
});
