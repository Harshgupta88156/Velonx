"use client";
import { useState } from "react";
import type { FacilityRisk, Facility, Locale } from "@/lib/types";
import type { Intervention } from "@/lib/db";
import { interventionMessages as copy } from "./interventions.messages";

const next = {
  open: "acknowledged",
  acknowledged: "in_progress",
  in_progress: "resolved",
} as const;

export default function Interventions({
  facilities,
  risks,
  interventions,
  isAdmin,
  busy,
  locale,
  onSave,
}: {
  facilities: Facility[];
  risks: FacilityRisk[];
  interventions: Intervention[];
  isAdmin: boolean;
  busy: boolean;
  locale: Locale;
  onSave: (
    facilityId: string,
    status: Intervention["status"],
    note: string,
  ) => void;
}) {
  const c = copy[locale];
  const [notes, setNotes] = useState<Record<string, string>>({});
  const flagged = risks.filter((r) => r.level !== "stable");
  const current = (id: string) =>
    interventions.find((i) => i.facilityId === id);
  return (
    <section
      className="panel interventions-panel"
      aria-labelledby="interventions-title"
    >
      <div className="panel-heading">
        <div>
          <h2 id="interventions-title">{c.title}</h2>
          <p className="muted">{c.help}</p>
        </div>
      </div>
      {!isAdmin && <p className="muted panel-pad-x">{c.adminOnly}</p>}
      {!flagged.length && <p className="muted panel-pad">{c.none}</p>}
      <ul className="panel-list intervention-list">
        {flagged.map((r) => {
          const cur = current(r.facilityId);
          const status = cur?.status ?? "open";
          const to = status === "resolved" ? null : next[status];
          const note = notes[r.facilityId] ?? "";
          return (
            <li key={r.facilityId} className="intervention-row">
              <strong>
                {facilities.find((f) => f.id === r.facilityId)?.name ??
                  r.facilityId}
              </strong>
              <span className="muted">
                {c[r.level as "critical" | "watch"]} · {r.score}
              </span>
              <span className="muted">{c[status]}</span>
              {isAdmin && to && (
                <>
                  <input
                    aria-label={c.note}
                    placeholder={c.note}
                    value={note}
                    className="intervention-note"
                    onChange={(e) =>
                      setNotes({ ...notes, [r.facilityId]: e.target.value })
                    }
                  />
                  <button
                    className="button secondary small"
                    disabled={busy || note.trim().length < 5}
                    onClick={() => {
                      onSave(r.facilityId, to, note.trim());
                      setNotes({ ...notes, [r.facilityId]: "" });
                    }}
                  >
                    {c.save}: {c[to]}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
