import { z } from "zod";
import { analyze } from "./intelligence";
import { getDb, loadSnapshot, writeAudit, bumpRevision } from "./db";
import type { Role } from "./types";

export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const role = z.enum(["administrator", "officer", "inventory"]);
const version = z.number().int().positive();
const quantity = z.number().int().min(0).max(10_000_000);
const scope = { role, facilityId: z.string().max(80).optional() };
export const approvalSchema = z
  .object({
    recommendationId: z.string().max(250),
    donorInventoryVersion: version,
    recipientInventoryVersion: version,
    role,
  })
  .strict();
export const transitionSchema = z
  .object({ action: z.enum(["dispatch", "receive", "cancel"]), ...scope })
  .strict();
export const inventorySchema = z
  .object({
    quantity,
    version,
    reason: z.string().trim().min(5).max(400),
    ...scope,
  })
  .strict();
export const operationSchema = z
  .object({
    facilityId: z.string().min(1).max(80),
    role,
    beds: z.number().int().min(0).max(10000).optional(),
    occupied: z.number().int().min(0).max(10000).optional(),
    presentDoctors: z.number().int().min(0).max(1000).optional(),
    attendanceRecorded: z.boolean().optional(),
    patientsToday: z.number().int().min(0).max(100000).optional(),
    diagnosticId: z.string().max(100).optional(),
    equipment: z.enum(["operational", "down", "unknown"]).optional(),
    reagents: z.boolean().optional(),
  })
  .strict()
  .refine(
    (x) => Object.keys(x).some((k) => !["role", "facilityId"].includes(k)),
    "No operational update supplied",
  );

function requireRole(actual: Role, allowed: Role[]) {
  if (!allowed.includes(actual))
    throw new ServiceError(403, "This role cannot perform that action.");
}
function requireScope(
  actual: Role,
  supplied: string | undefined,
  expected: string,
) {
  if (actual !== "administrator" && supplied !== expected)
    throw new ServiceError(
      403,
      "Select the facility responsible for this action.",
    );
}
export async function approveTransfer(input: z.infer<typeof approvalSchema>) {
  requireRole(input.role, ["administrator"]);
  const db = await getDb();
  return db
    .transaction(async (db) => {
      const s = await loadSnapshot(db);
      const rec = analyze(s).recommendations.find(
        (r) => r.id === input.recommendationId,
      );
      if (!rec)
        throw new ServiceError(
          409,
          "This recommendation is no longer available. Refresh the evidence.",
        );
      if (
        rec.donorInventoryVersion !== input.donorInventoryVersion ||
        rec.recipientInventoryVersion !== input.recipientInventoryVersion
      )
        throw new ServiceError(
          409,
          "Inventory changed since review. Refresh before approving.",
        );
      const donor = s.inventory.find(
        (i) => i.facilityId === rec.donorId && i.medicineId === rec.medicineId,
      )!;
      const recipient = s.inventory.find(
        (i) =>
          i.facilityId === rec.recipientId && i.medicineId === rec.medicineId,
      )!;
      const now = new Date().toISOString(),
        id = crypto.randomUUID();
      // Immediate transaction serializes the fresh recommendation and reservation.
      const result = await db
        .prepare(
          "UPDATE inventory SET reserved=reserved+?,version=version+1 WHERE id=? AND version=? AND quantity-reserved>=?",
        )
        .run(rec.quantity, donor.id, donor.version, rec.quantity);
      if (result.changes !== 1)
        throw new ServiceError(
          409,
          "Donor stock changed. Refresh and try again.",
        );
      await db
        .prepare("UPDATE inventory SET version=version+1 WHERE id=?")
        .run(recipient.id);
      await db
        .prepare("INSERT INTO transfers VALUES (?,?,?,?,?,?,?,?,?,?)")
        .run(
          id,
          rec.donorId,
          rec.recipientId,
          rec.medicineId,
          rec.quantity,
          "approved",
          now,
          now,
          "Demo administrator",
          rec.explanation,
        );
      // Preserve batch expiry even if the donor record changes before receipt.
      await db
        .prepare("INSERT INTO meta VALUES (?,?)")
        .run(`transfer-expiry:${id}`, donor.expiry);
      await writeAudit(
        db,
        input.role,
        "transfer.approved",
        id,
        JSON.stringify({
          donor: rec.donorId,
          recipient: rec.recipientId,
          medicine: rec.medicineId,
          quantity: rec.quantity,
          safetyStock: rec.donorSafetyStock,
          availableBefore: donor.quantity - donor.reserved,
        }),
      );
      await bumpRevision(db);
      return { id, status: "approved" };
    })
    .immediate();
}
export async function transitionTransfer(
  id: string,
  input: z.infer<typeof transitionSchema>,
) {
  const db = await getDb();
  return db
    .transaction(async (db) => {
      const s = await loadSnapshot(db),
        transfer = s.transfers.find((t) => t.id === id);
      if (!transfer) {
        // Older completed transfers are outside the snapshot window but still exist.
        const exists = await db
          .prepare("SELECT 1 AS found FROM transfers WHERE id=?")
          .get(id);
        throw exists
          ? new ServiceError(409, "Transfer is already completed.")
          : new ServiceError(404, "Transfer not found.");
      }
      const expected = input.action === "receive" ? "dispatched" : "approved";
      if (transfer.status !== expected)
        throw new ServiceError(
          409,
          "Transfer state has changed. Refresh before continuing.",
        );
      if (input.action === "cancel") requireRole(input.role, ["administrator"]);
      else
        requireScope(
          input.role,
          input.facilityId,
          input.action === "dispatch" ? transfer.donorId : transfer.recipientId,
        );
      const donor = s.inventory.find(
        (i) =>
          i.facilityId === transfer.donorId &&
          i.medicineId === transfer.medicineId,
      )!;
      const recipient = s.inventory.find(
        (i) =>
          i.facilityId === transfer.recipientId &&
          i.medicineId === transfer.medicineId,
      )!;
      let status: string;
      if (input.action === "dispatch") {
        if (
          donor.reserved < transfer.quantity ||
          donor.quantity < transfer.quantity
        )
          throw new ServiceError(
            409,
            "Reserved donor inventory is inconsistent.",
          );
        const insight = analyze(s).inventory.find(
          (i) => i.inventoryId === donor.id,
        )!;
        const safety = Math.ceil(
          Math.max(
            donor.minimum,
            insight.forecast.points.reduce(
              (sum, p) => sum + (p.upper ?? p.value),
              0,
            ),
          ),
        );
        if (
          insight.expired ||
          insight.forecast.method === "insufficient-data" ||
          donor.quantity - donor.reserved < safety
        )
          throw new ServiceError(
            409,
            "Donor safety stock no longer supports dispatch. Cancel and review the recommendation.",
          );
        await db
          .prepare(
            "UPDATE inventory SET quantity=quantity-?,reserved=reserved-?,version=version+1 WHERE id=?",
          )
          .run(transfer.quantity, transfer.quantity, donor.id);
        status = "dispatched";
      } else if (input.action === "receive") {
        const expiryRow = await db
          .prepare("SELECT value FROM meta WHERE key=?")
          .get(`transfer-expiry:${id}`);
        if (typeof expiryRow?.value !== "string")
          throw new ServiceError(409, "Shipment expiry record is missing.");
        const expiry = expiryRow.value;
        if (expiry < s.asOf)
          throw new ServiceError(
            409,
            "Shipment has expired; receipt into usable stock is blocked.",
          );
        const oldExpired = recipient.expiry < s.asOf;
        if (oldExpired && recipient.reserved > 0)
          throw new ServiceError(
            409,
            "Expired destination stock has reservations; resolve them first.",
          );
        if (oldExpired && recipient.quantity > 0) {
          // Quarantine expired stock in an immutable audit record, never count it as usable.
          await writeAudit(
            db,
            input.role,
            "inventory.quarantined",
            recipient.id,
            JSON.stringify({
              quantity: recipient.quantity,
              expiry: recipient.expiry,
              reason: "Expired batch isolated before incoming receipt",
            }),
          );
        }
        const newExpiry =
          oldExpired || recipient.quantity === 0
            ? expiry
            : [recipient.expiry, expiry].sort()[0];
        await db
          .prepare(
            "UPDATE inventory SET quantity=?,expiry=?,version=version+1 WHERE id=?",
          )
          .run(
            (oldExpired ? 0 : recipient.quantity) + transfer.quantity,
            newExpiry,
            recipient.id,
          );
        status = "received";
      } else {
        if (donor.reserved < transfer.quantity)
          throw new ServiceError(409, "Reservation cannot be released.");
        await db
          .prepare(
            "UPDATE inventory SET reserved=reserved-?,version=version+1 WHERE id=?",
          )
          .run(transfer.quantity, donor.id);
        status = "cancelled";
      }
      await db
        .prepare("UPDATE transfers SET status=?,updated_at=? WHERE id=?")
        .run(status, new Date().toISOString(), id);
      await writeAudit(
        db,
        input.role,
        `transfer.${status}`,
        id,
        JSON.stringify({
          quantity: transfer.quantity,
          donor: transfer.donorId,
          recipient: transfer.recipientId,
          medicine: transfer.medicineId,
        }),
      );
      await bumpRevision(db);
      return { id, status };
    })
    .immediate();
}
export async function updateInventory(
  id: string,
  input: z.infer<typeof inventorySchema>,
) {
  requireRole(input.role, ["administrator", "inventory", "officer"]);
  const db = await getDb();
  return db
    .transaction(async (db) => {
      const s = await loadSnapshot(db),
        row = s.inventory.find((i) => i.id === id);
      if (!row) throw new ServiceError(404, "Inventory row not found.");
      requireScope(input.role, input.facilityId, row.facilityId);
      if (row.version !== input.version)
        throw new ServiceError(
          409,
          "Inventory changed. Refresh before saving.",
        );
      if (input.quantity < row.reserved)
        throw new ServiceError(
          409,
          "Stock cannot be less than the reserved quantity. Cancel the reservation first.",
        );
      await db
        .prepare("UPDATE inventory SET quantity=?,version=version+1 WHERE id=?")
        .run(input.quantity, id);
      await writeAudit(
        db,
        input.role,
        "inventory.adjusted",
        id,
        JSON.stringify({
          before: row.quantity,
          after: input.quantity,
          reason: input.reason,
        }),
      );
      await bumpRevision(db);
      return { id, quantity: input.quantity };
    })
    .immediate();
}
export async function updateOperations(input: z.infer<typeof operationSchema>) {
  requireRole(input.role, ["administrator", "officer"]);
  const db = await getDb();
  return db
    .transaction(async (db) => {
      const s = await loadSnapshot(db),
        f = s.facilities.find((f) => f.id === input.facilityId);
      if (!f) throw new ServiceError(404, "Facility not found.");
      const {
        role: actor,
        facilityId,
        diagnosticId,
        equipment,
        reagents,
        ...fields
      } = input;
      if ((equipment !== undefined || reagents !== undefined) && !diagnosticId)
        throw new ServiceError(400, "Choose a diagnostic test to update.");
      const next = { ...f, ...fields, updatedAt: new Date().toISOString() };
      if (next.occupied > next.beds)
        throw new ServiceError(
          400,
          "Occupied beds cannot exceed operational beds.",
        );
      if (next.presentDoctors > next.scheduledDoctors)
        throw new ServiceError(
          400,
          "Recorded doctors cannot exceed the schedule in this demo.",
        );
      if (diagnosticId) {
        const d = s.diagnostics.find(
          (d) => d.id === diagnosticId && d.facilityId === facilityId,
        );
        if (!d)
          throw new ServiceError(
            404,
            "Diagnostic record not found at this facility.",
          );
        const updated = {
          ...d,
          equipment: equipment ?? d.equipment,
          reagents: reagents ?? d.reagents,
          updatedAt: new Date().toISOString(),
        };
        if (equipment === "operational") updated.downtimeHours = 0;
        await db
          .prepare("UPDATE diagnostics SET body=? WHERE id=?")
          .run(JSON.stringify(updated), d.id);
      }
      await db
        .prepare("UPDATE facilities SET body=? WHERE id=?")
        .run(JSON.stringify(next), facilityId);
      await writeAudit(
        db,
        actor,
        "facility.updated",
        facilityId,
        JSON.stringify(input),
      );
      await bumpRevision(db);
      return { id: facilityId };
    })
    .immediate();
}

export const interventionSchema = z
  .object({
    facilityId: z.string().min(1).max(80),
    role,
    status: z.enum(["acknowledged", "in_progress", "resolved"]),
    note: z.string().trim().min(5).max(400),
  })
  .strict();
const interventionOrder = { acknowledged: 0, in_progress: 1, resolved: 2 };
export async function setIntervention(
  input: z.infer<typeof interventionSchema>,
) {
  requireRole(input.role, ["administrator"]);
  const db = await getDb();
  return db
    .transaction(async (db) => {
      if (
        !(await loadSnapshot(db)).facilities.some(
          (f) => f.id === input.facilityId,
        )
      )
        throw new ServiceError(404, "Facility not found.");
      const currentRow = await db
        .prepare("SELECT status FROM interventions WHERE facility_id=?")
        .get(input.facilityId);
      const current = interventionSchema.shape.status.safeParse(
        currentRow?.status,
      );
      if (
        current.success &&
        interventionOrder[input.status] < interventionOrder[current.data]
      )
        throw new ServiceError(
          409,
          "An intervention status cannot move backwards.",
        );
      await db
        .prepare(
          "INSERT INTO interventions VALUES (?,?,?,?,?) ON CONFLICT(facility_id) DO UPDATE SET status=excluded.status,note=excluded.note,actor=excluded.actor,updated_at=excluded.updated_at",
        )
        .run(
          input.facilityId,
          input.status,
          input.note,
          input.role,
          new Date().toISOString(),
        );
      await writeAudit(
        db,
        input.role,
        "intervention." + input.status,
        input.facilityId,
        JSON.stringify({ note: input.note }),
      );
      await bumpRevision(db);
      return { facilityId: input.facilityId, status: input.status };
    })
    .immediate();
}
