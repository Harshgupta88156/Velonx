import Database from "better-sqlite3";
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

let connection: Database.Database | undefined;
let connectionPath = "";
export function getDb(): Database.Database {
  const path = process.env.DATABASE_PATH || "./data/velonx.db";
  if (connection && connectionPath === path) return connection;
  connection?.close();
  // Runtime-configured writable location; never trace local state into a build.
  mkdirSync(dirname(resolve(/* turbopackIgnore: true */ path)), {
    recursive: true,
  });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
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
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, detail TEXT NOT NULL);
  `);
  connection = db;
  connectionPath = path;
  if (!db.prepare("SELECT value FROM meta WHERE key='asOf'").get())
    seedDatabase(db);
  return db;
}
export function seedDatabase(db = getDb()): void {
  const s = createSeed();
  db.transaction(() => {
    for (const f of s.facilities)
      db.prepare("INSERT INTO facilities VALUES (?,?)").run(
        f.id,
        JSON.stringify(f),
      );
    for (const m of s.medicines)
      db.prepare("INSERT INTO medicines VALUES (?,?)").run(
        m.id,
        JSON.stringify(m),
      );
    for (const i of s.inventory)
      db.prepare("INSERT INTO inventory VALUES (?,?,?,?,?,?,?,?,?)").run(
        i.id,
        i.facilityId,
        i.medicineId,
        i.quantity,
        i.reserved,
        i.minimum,
        i.expiry,
        i.version,
        JSON.stringify(i.history),
      );
    for (const d of s.diagnostics)
      db.prepare("INSERT INTO diagnostics VALUES (?,?,?)").run(
        d.id,
        d.facilityId,
        JSON.stringify(d),
      );
    for (const [id, h] of Object.entries(s.footfall))
      db.prepare("INSERT INTO footfall VALUES (?,?)").run(
        id,
        JSON.stringify(h),
      );
    db.prepare("INSERT INTO meta VALUES (?,?)").run("asOf", s.asOf);
    db.prepare("INSERT INTO meta VALUES (?,?)").run("revision", "1");
  }).immediate();
}
export function loadSnapshot(db = getDb()): Snapshot {
  const bodies = <T>(table: "facilities" | "medicines" | "diagnostics") =>
    (
      db.prepare(`SELECT body FROM ${table} ORDER BY rowid`).all() as {
        body: string;
      }[]
    ).map((r) => JSON.parse(r.body) as T);
  const inv = db.prepare("SELECT * FROM inventory ORDER BY rowid").all() as {
    id: string;
    facility_id: string;
    medicine_id: string;
    quantity: number;
    reserved: number;
    minimum: number;
    expiry: string;
    version: number;
    history: string;
  }[];
  const inventory: Inventory[] = inv.map((i) => ({
    id: i.id,
    facilityId: i.facility_id,
    medicineId: i.medicine_id,
    quantity: i.quantity,
    reserved: i.reserved,
    minimum: i.minimum,
    expiry: i.expiry,
    version: i.version,
    history: JSON.parse(i.history),
  }));
  const transfers: Transfer[] = (
    db
      .prepare("SELECT * FROM transfers ORDER BY created_at DESC")
      .all() as Record<string, unknown>[]
  ).map(
    (r) =>
      ({
        id: r.id,
        donorId: r.donor_id,
        recipientId: r.recipient_id,
        medicineId: r.medicine_id,
        quantity: r.quantity,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        approvedBy: r.approved_by,
        reason: r.reason,
      }) as Transfer,
  );
  const audit: AuditEvent[] = (
    db
      .prepare("SELECT * FROM audit ORDER BY at DESC, rowid DESC LIMIT 200")
      .all() as Record<string, unknown>[]
  ).map(
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
  const ff = db.prepare("SELECT * FROM footfall").all() as {
    facility_id: string;
    body: string;
  }[];
  const meta = Object.fromEntries(
    (
      db.prepare("SELECT key,value FROM meta").all() as {
        key: string;
        value: string;
      }[]
    ).map((r) => [r.key, r.value]),
  );
  return {
    facilities: bodies<Facility>("facilities"),
    medicines: bodies<Medicine>("medicines"),
    diagnostics: bodies<Diagnostic>("diagnostics"),
    inventory,
    transfers,
    audit,
    footfall: Object.fromEntries(
      ff.map((r) => [r.facility_id, JSON.parse(r.body) as HistoryPoint[]]),
    ),
    asOf: meta.asOf,
    revision: Number(meta.revision),
    synthetic: true,
  };
}
export function bumpRevision(db: Database.Database) {
  db.prepare(
    "UPDATE meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'",
  ).run();
}
export function writeAudit(
  db: Database.Database,
  actor: string,
  action: string,
  entityId: string,
  detail: string,
) {
  db.prepare("INSERT INTO audit VALUES (?,?,?,?,?,?)").run(
    crypto.randomUUID(),
    new Date().toISOString(),
    actor,
    action,
    entityId,
    detail,
  );
}
