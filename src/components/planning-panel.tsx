"use client";
import { useState } from "react";
import type { Intelligence, Locale, Snapshot } from "@/lib/types";
import { resilience } from "@/lib/resilience";
import { planningMessages as copy } from "./planning-panel.messages";

const addDays = (v: string, n: number) =>
  new Date(Date.parse(v) + n * 864e5).toISOString().slice(0, 10);

export default function PlanningPanel({
  snapshot,
  intelligence,
  locale,
}: {
  snapshot: Snapshot;
  intelligence: Intelligence;
  locale: Locale;
}) {
  const c = copy[locale];
  const r = resilience(snapshot, intelligence);
  const recs = intelligence.recommendations;
  const [index, setIndex] = useState(0);
  const rec = recs[Math.min(index, Math.max(0, recs.length - 1))];
  const [qty, setQty] = useState<number | null>(null);
  const q = rec ? Math.min(qty ?? rec.quantity, rec.quantity) : 0;
  const find = (facilityId: string) =>
    intelligence.inventory.find(
      (i) => i.facilityId === facilityId && i.medicineId === rec?.medicineId,
    );
  const rIns = rec && find(rec.recipientId),
    dIns = rec && find(rec.donorId);
  const cover = (avail?: number, demand?: number) =>
    avail !== undefined && demand
      ? Math.round((avail / demand) * 10) / 10
      : null;
  const name = (id: string) =>
    snapshot.facilities.find((f) => f.id === id)?.name ?? id;
  const med = (id: string) =>
    snapshot.medicines.find((m) => m.id === id)?.name ?? id;
  const donorAfter = dIns ? dIns.available - q : 0;
  const timeline = intelligence.inventory
    .filter(
      (i) =>
        i.shortageDate &&
        Date.parse(i.shortageDate) <= Date.parse(snapshot.asOf) + 14 * 864e5,
    )
    .sort((a, b) => a.shortageDate!.localeCompare(b.shortageDate!));
  const fmt = (n: number | null) =>
    n === null ? "—" : n.toLocaleString(locale);
  return (
    <div className="planning-stack">
      <section className="panel" aria-labelledby="res-title">
        <div className="panel-heading">
          <div>
            <h2 id="res-title">{c.resTitle}</h2>
            <p className="muted">{c.resNote}</p>
          </div>
          <strong className="score-value">
            {r.score === null ? c.na : r.score}
          </strong>
        </div>
        <ul className="panel-list">
          {r.components.map((x) => (
            <li key={x.key} className="split-row">
              <span>{c[x.key]}</span>
              <strong>
                {x.score === null
                  ? c.na
                  : `${x.score}% (${x.numerator} ${c.of} ${x.denominator})`}
              </strong>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel" aria-labelledby="what-title">
        <div className="panel-heading">
          <div>
            <h2 id="what-title">{c.whatTitle}</h2>
            <p className="muted">{c.whatNote}</p>
          </div>
        </div>
        <div className="panel-pad what-if">
          {!rec ? (
            <p className="muted">{c.none}</p>
          ) : (
            <>
              <select
                aria-label={c.whatTitle}
                value={index}
                onChange={(e) => {
                  setIndex(Number(e.target.value));
                  setQty(null);
                }}
                className="what-if-select"
              >
                {recs.map((x, i) => (
                  <option key={x.id} value={i}>
                    {med(x.medicineId)}: {name(x.donorId)} →{" "}
                    {name(x.recipientId)}
                  </option>
                ))}
              </select>
              <label className="what-if-range">
                {c.quantity}: <strong>{q}</strong>
                <input
                  type="range"
                  min={0}
                  max={rec.quantity}
                  value={q}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="range-input"
                />
              </label>
              <div className="what-if-results">
                <span>
                  {c.recipient}:{" "}
                  <strong>
                    {fmt(
                      cover(
                        rIns ? rIns.available : undefined,
                        rIns?.dailyDemand,
                      ),
                    )}{" "}
                    →{" "}
                    {fmt(
                      cover(
                        rIns ? rIns.available + q : undefined,
                        rIns?.dailyDemand,
                      ),
                    )}{" "}
                    {c.days}
                  </strong>
                </span>
                <span>
                  {c.donor}:{" "}
                  <strong>
                    {fmt(cover(dIns?.available, dIns?.dailyDemand))} →{" "}
                    {fmt(cover(donorAfter, dIns?.dailyDemand))} {c.days}
                  </strong>
                </span>
              </div>
              <span
                className={
                  donorAfter >= rec.donorSafetyStock ? "teal-text" : "red-text"
                }
              >
                {donorAfter >= rec.donorSafetyStock ? c.safety : c.breach}
              </span>
            </>
          )}
        </div>
      </section>
      <section className="panel" aria-labelledby="time-title">
        <div className="panel-heading">
          <div>
            <h2 id="time-title">{c.timeTitle}</h2>
            <p className="muted">{c.timeNote}</p>
          </div>
        </div>
        {!timeline.length ? (
          <p className="muted panel-pad">{c.noTime}</p>
        ) : (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label={c.tableRegion}
          >
            <table>
              <thead>
                <tr>
                  <th>{c.timeTitle.split(" (")[0]}</th>
                  <th>{c.date}</th>
                  <th>{c.act}</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((i) => (
                  <tr key={i.inventoryId}>
                    <td>
                      {med(i.medicineId)} · {name(i.facilityId)}
                    </td>
                    <td>{i.shortageDate}</td>
                    <td>{addDays(i.shortageDate!, -1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
