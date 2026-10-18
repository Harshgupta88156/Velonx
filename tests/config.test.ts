import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config, ConfigError } from "../src/lib/config";
import { COMPLETED_TRANSFER_LIMIT, getDb, loadSnapshot } from "../src/lib/db";
import { transitionTransfer, ServiceError } from "../src/lib/service";

test("config applies safe defaults and treats empty values as unset", () => {
  const value = config({
    TURSO_DATABASE_URL: "",
    DEMO_MODE: "",
  });
  assert.equal(value.demoMode, true);
  assert.equal(value.tursoUrl, undefined);
  assert.equal(value.databasePath, "./data/districtcare.db");
  assert.equal(config({ DEMO_MODE: "false", ADMIN_KEY: "k" }).demoMode, false);
});

test("config rejects ambiguous or incomplete settings instead of guessing", () => {
  assert.throws(() => config({ DEMO_MODE: "False" }), ConfigError);
  assert.throws(() => config({ TURSO_DATABASE_URL: "mysql://x" }), /libsql/);
  assert.throws(
    () =>
      config({
        TURSO_DATABASE_URL: "libsql://db.example",
      }),
    /TURSO_AUTH_TOKEN/,
  );
});

const directory = mkdtempSync(join(tmpdir(), "districtcare-config-"));
after(async () => {
  (await getDb()).close();
  rmSync(directory, { recursive: true, force: true });
});

test("snapshot keeps every active transfer and only the latest completed ones", async () => {
  process.env.DATABASE_PATH = join(directory, "bounded.sqlite");
  process.env.DEMO_MODE = "true";
  delete process.env.TURSO_DATABASE_URL;
  const db = await getDb();
  const insert = (id: string, status: string, day: number) =>
    db
      .prepare("INSERT INTO transfers VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        "sehore",
        "rampur",
        "paracetamol",
        1,
        status,
        new Date(Date.UTC(2026, 0, 1) + day * 60_000).toISOString(),
        "2026-01-01T00:00:00Z",
        "test",
        "test",
      );
  await insert("active-oldest", "approved", 0);
  for (let i = 1; i <= COMPLETED_TRANSFER_LIMIT + 5; i++)
    await insert(`done-${i}`, "received", i);
  const { transfers } = await loadSnapshot();
  assert.equal(transfers.length, COMPLETED_TRANSFER_LIMIT + 1);
  assert.ok(transfers.some((t) => t.id === "active-oldest"));
  assert.ok(!transfers.some((t) => t.id === "done-1"));
  await assert.rejects(
    () =>
      transitionTransfer("done-1", {
        action: "receive",
        role: "administrator",
      }),
    (error) => error instanceof ServiceError && error.status === 409,
  );
});
