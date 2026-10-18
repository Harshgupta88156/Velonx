import { ClipboardList } from "lucide-react";
import type { AuditEvent } from "@/lib/types";
import type { MessageKey } from "@/messages";
import { Empty } from "./ui/primitives";

const labels: Record<string, MessageKey> = {
  "transfer.approved": "approved",
  "transfer.dispatched": "dispatched",
  "transfer.received": "received",
  "transfer.cancelled": "cancelled",
  "inventory.adjusted": "updateStock",
  "inventory.quarantined": "quarantine",
};
const roleLabel = (actor: string): MessageKey =>
  actor === "inventory"
    ? "inventoryRole"
    : actor === "officer"
      ? "officer"
      : "administrator";

/** Immutable audit trail, newest first, with transfer and stock details
 * rendered from the structured event payload. */
export default function ActivityLog({
  audit,
  tr,
  date,
  fmt,
  facilityName,
  medicineName,
}: {
  audit: AuditEvent[];
  tr: (key: MessageKey) => string;
  date: (value: string, withTime?: boolean) => string;
  fmt: (n: number) => string;
  facilityName: (id: string) => string;
  medicineName: (id: string) => string;
}) {
  const eventDetail = (event: AuditEvent) => {
    try {
      const detail = JSON.parse(event.detail) as Record<string, unknown>;
      if (detail.donor && detail.recipient)
        return `${facilityName(String(detail.donor))} → ${facilityName(String(detail.recipient))} · ${medicineName(String(detail.medicine))} · ${fmt(Number(detail.quantity))} ${tr("units")}`;
      if (detail.before !== undefined && detail.after !== undefined)
        return `${tr("quantity")}: ${String(detail.before)} → ${String(detail.after)} · ${String(detail.reason ?? "")}`;
      if (detail.facilityId) return facilityName(String(detail.facilityId));
      if (detail.quantity !== undefined)
        return `${tr("quantity")}: ${String(detail.quantity)}`;
      return tr("success");
    } catch {
      return event.detail;
    }
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{tr("activity")}</h2>
        <span className="small-tag">{audit.length}</span>
      </div>
      <div className="activity-list">
        {audit.map((event) => (
          <article key={event.id}>
            <span className="audit-icon">
              <ClipboardList size={18} />
            </span>
            <div>
              <strong>{tr(labels[event.action] ?? "update")}</strong>
              <p>{eventDetail(event)}</p>
              <small>
                {tr(roleLabel(event.actor))} · {event.entityId}
              </small>
            </div>
            <time>{date(event.at, true)}</time>
          </article>
        ))}
        {!audit.length && <Empty>{tr("noActivity")}</Empty>}
      </div>
    </section>
  );
}
