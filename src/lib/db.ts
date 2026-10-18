import {
  createClient,
  type Client,
  type Row,
  type Transaction,
} from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createSeed } from "./seed";
import type {
  Snapshot,
  Inventory,
  Transfer,
  AuditEvent,
  Facility,
  Diagnostic,
  Medicine,
  HistoryPoint,
} from "./types";

type Param = string | number | null;
/** Thin async wrapper over a libSQL client or open transaction. Keeps the
 * prepare().run/get/all call shape so SQL stays readable. */
export class Db {
  constructor(
    private readonly executor: Client | Transaction,
    private readonly root?: Client,
  ) {}
  prepare(sql: string) {
    const executor = this.executor;
    const query = async (args: Param[]) => executor.execute({ sql, args });
    return {
      run: async (...args: Param[]) => ({
        changes: (await query(args)).rowsAffected,
      }),
      get: async (...args: Param[]) => (await query(args)).rows.at(0),
      all: async (...args: Param[]) => (await query(args)).rows,
    };
  }
  /** One round trip. Row sets are returned in statement order. */
  async batch(
    statements: { sql: string; args?: Param[] }[],
    mode: "read" | "write" = "write",
  ): Promise<Row[][]> {
    const results =
      "commit" in this.executor
        ? await this.executor.batch(statements)
        : await this.executor.batch(statements, mode);
    return results.map((r) => r.rows);
  }
  transaction<T>(fn: (tx: Db) => Promise<T>) {
    const root = this.root;
    const run = async (mode: "write" | "read") => {
      if (!root) throw new Error("Nested transactions are not supported.");
      const tx = await root.transaction(mode);
      try {
        const result = await fn(new Db(tx));
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback().catch(() => undefined);
        throw error;
      } finally {
        tx.close();
      }
    };
    return { immediate: () => run("write"), read: () => run("read") };
  }
  close() {
    if (this.root) this.root.close();
  }
}

const schema = `
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS facilities (id TEXT PRIMARY KEY, body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS medicines (id TEXT PRIMARY KEY, body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS footfall (facility_id TEXT PRIMARY KEY REFERENCES facilities(id), body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY, facility_id TEXT NOT NULL REFERENCES facilities(id), medicine_id TEXT NOT NULL REFERENCES medicines(id),
    quantity INTEGER NOT NULL CHECK(quantity>=0), reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=quantity),
    minimum INTEGER NOT NULL CHECK(minimum>=0), expiry TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    history TEXT NOT NULL, UNIQUE(facility_id,medicine_id));
  CREATE TABLE IF NOT EXISTS diagnostics (id TEXT PRIMARY KEY, facility_id TEXT NOT NULL REFERENCES facilities(id), body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY, donor_id TEXT NOT NULL REFERENCES facilities(id), recipient_id TEXT NOT NULL REFERENCES facilities(id),
    medicine_id TEXT NOT NULL REFERENCES medicines(id), quantity INTEGER NOT NULL CHECK(quantity>0),
    status TEXT NOT NULL CHECK(status IN ('approved','dispatched','received','cancelled')), created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL, approved_by TEXT NOT NULL, reason TEXT NOT NULL, CHECK(donor_id<>recipient_id));
  CREATE TABLE IF NOT EXISTS interventions (
    facility_id TEXT PRIMARY KEY REFERENCES facilities(id), status TEXT NOT NULL CHECK(status IN ('acknowledged','in_progress','resolved')),
    note TEXT NOT NULL, actor TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, detail TEXT NOT NULL);
`;

/** Remote Turso when TURSO_DATABASE_URL is set; otherwise a local SQLite file. */
function target() {
  const remote = process.env.TURSO_DATABASE_URL;
  if (remote)
    return {
      url: remote,
      authToken: process.env.TURSO_AUTH_TOKEN,
      local: false,
    };
  const path = resolve(
    /* turbopackIgnore: true */ process.env.DATABASE_PATH ||
      "./data/districtcare.db",
  );
  return { url: `file:${path}`, authToken: undefined, local: true, path };
}
let connection: Promise<Db> | undefined;
let connectionKey = "";
export async function getDb(): Promise<Db> {
  const t = target();
  const key = `${t.url}|${t.authToken ?? ""}`;
  if (connection && connectionKey === key) return connection;
  void connection?.then((previous) => previous.close()).catch(() => undefined);
  connectionKey = key;
  const opening = (async () => {
    // Runtime-configured writable location; never trace local state into a build.
    if (t.local) mkdirSync(dirname(t.path!), { recursive: true });
    const client = createClient({ url: t.url, authToken: t.authToken });
    if (t.local) {
      await client.execute("PRAGMA journal_mode = WAL");
      await client.execute("PRAGMA busy_timeout = 5000");
    }
    await client.executeMultiple(schema);
    const db = new Db(client, client);
    if (!(await db.prepare("SELECT value FROM meta WHERE key='asOf'").get()))
      await seedDatabase(db);
    return db;
  })();
  connection = opening;
  opening.catch(() => {
    if (connection === opening) connection = undefined;
  });
  return opening;
}
export async function seedDatabase(db?: Db): Promise<void> {
  const root = db ?? (await getDb());
  const s = createSeed();
  await root
    .transaction(async (db) => {
      // Concurrent cold starts: only the first writer seeds.
      if (await db.prepare("SELECT value FROM meta WHERE key='asOf'").get())
        return;
      const json = JSON.stringify;
      await db.batch([
        ...s.facilities.map((f) => ({
          sql: "INSERT INTO facilities VALUES (?,?)",
          args: [f.id, json(f)],
        })),
        ...s.medicines.map((m) => ({
          sql: "INSERT INTO medicines VALUES (?,?)",
          args: [m.id, json(m)],
        })),
        ...s.inventory.map((i) => ({
          sql: "INSERT INTO inventory VALUES (?,?,?,?,?,?,?,?,?)",
          args: [
            i.id,
            i.facilityId,
            i.medicineId,
            i.quantity,
            i.reserved,
            i.minimum,
            i.expiry,
            i.version,
            json(i.history),
          ],
        })),
        ...s.diagnostics.map((d) => ({
          sql: "INSERT INTO diagnostics VALUES (?,?,?)",
          args: [d.id, d.facilityId, json(d)],
        })),
        ...Object.entries(s.footfall).map(([id, h]) => ({
          sql: "INSERT INTO footfall VALUES (?,?)",
          args: [id, json(h)],
        })),
        { sql: "INSERT INTO meta VALUES (?,?)", args: ["asOf", s.asOf] },
        { sql: "INSERT INTO meta VALUES (?,?)", args: ["revision", "1"] },
      ]);
    })
    .immediate();
}
export async function loadSnapshot(db?: Db): Promise<Snapshot> {
  const conn = db ?? (await getDb());
  const [
    facilityRows,
    medicineRows,
    diagnosticRows,
    inv,
    transferRows,
    auditRows,
    ff,
    metaRows,
  ] = await conn.batch(
    [
      { sql: "SELECT body FROM facilities ORDER BY rowid" },
      { sql: "SELECT body FROM medicines ORDER BY rowid" },
      { sql: "SELECT body FROM diagnostics ORDER BY rowid" },
      { sql: "SELECT * FROM inventory ORDER BY rowid" },
      { sql: "SELECT * FROM transfers ORDER BY created_at DESC" },
      { sql: "SELECT * FROM audit ORDER BY at DESC, rowid DESC LIMIT 200" },
      { sql: "SELECT * FROM footfall" },
      { sql: "SELECT key,value FROM meta" },
    ],
    "read",
  );
  const bodies = <T>(rows: Row[]) =>
    rows.map((r) => JSON.parse(r.body as string) as T);
  const inventory: Inventory[] = inv.map((i) => ({
    id: i.id as string,
    facilityId: i.facility_id as string,
    medicineId: i.medicine_id as string,
    quantity: Number(i.quantity),
    reserved: Number(i.reserved),
    minimum: Number(i.minimum),
    expiry: i.expiry as string,
    version: Number(i.version),
    history: JSON.parse(i.history as string),
  }));
  const transfers: Transfer[] = transferRows.map(
    (r) =>
      ({
        id: r.id,
        donorId: r.donor_id,
        recipientId: r.recipient_id,
        medicineId: r.medicine_id,
        quantity: Number(r.quantity),
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        approvedBy: r.approved_by,
        reason: r.reason,
      }) as Transfer,
  );
  const audit: AuditEvent[] = auditRows.map(
    (r) =>
      ({
        id: r.id,
        at: r.at,
        actor: r.actor,
        action: r.action,
        entityId: r.entity_id,
        detail: r.detail,
      }) as AuditEvent,
  );
  const meta = Object.fromEntries(
    metaRows.map((r) => [r.key as string, r.value as string]),
  );
  return {
    facilities: bodies<Facility>(facilityRows),
    medicines: bodies<Medicine>(medicineRows),
    diagnostics: bodies<Diagnostic>(diagnosticRows),
    inventory,
    transfers,
    audit,
    footfall: Object.fromEntries(
      ff.map((r) => [
        r.facility_id as string,
        JSON.parse(r.body as string) as HistoryPoint[],
      ]),
    ),
    asOf: meta.asOf,
    revision: Number(meta.revision),
    synthetic: true,
  };
}
export async function bumpRevision(db: Db) {
  await db
    .prepare(
      "UPDATE meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'",
    )
    .run();
}
export async function writeAudit(
  db: Db,
  actor: string,
  action: string,
  entityId: string,
  detail: string,
) {
  await db
    .prepare("INSERT INTO audit VALUES (?,?,?,?,?,?)")
    .run(
      crypto.randomUUID(),
      new Date().toISOString(),
      actor,
      action,
      entityId,
      detail,
    );
}

export type Intervention = {
  facilityId: string;
  status: "acknowledged" | "in_progress" | "resolved";
  note: string;
  actor: string;
  updatedAt: string;
};
export async function loadInterventions(db?: Db): Promise<Intervention[]> {
  const conn = db ?? (await getDb());
  const rows = await conn
    .prepare("SELECT * FROM interventions ORDER BY updated_at DESC")
    .all();
  return rows.map((r) => ({
    facilityId: r.facility_id as string,
    status: r.status as Intervention["status"],
    note: r.note as string,
    actor: r.actor as string,
    updatedAt: r.updated_at as string,
  }));
}
