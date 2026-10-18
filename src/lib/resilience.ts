import type { Intelligence, Snapshot } from "./types";

export type ResilienceComponent = {
  key: "stock" | "beds" | "staffing" | "laboratory";
  score: number | null; // 0-100, null when no data
  numerator: number;
  denominator: number;
};
export type Resilience = { score: number | null; components: ResilienceComponent[] };

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

/** Transparent prototype policy: four equally weighted shares, each a simple
 * count over current records. Unknown/missing records are excluded from the
 * denominator, never counted as good or bad. Not a clinical or staff-performance measure. */
export function resilience(snapshot: Snapshot, intelligence: Intelligence): Resilience {
  const stock = intelligence.inventory.filter((i) => i.risk !== "unknown");
  const bedFacilities = snapshot.facilities.filter((f) => f.beds > 0);
  const staffed = snapshot.facilities.filter((f) => f.attendanceRecorded && f.scheduledDoctors > 0);
  const labs = snapshot.diagnostics.filter((d) => d.equipment !== "unknown");
  const raw = [
    { key: "stock" as const, n: stock.filter((i) => i.risk === "healthy").length, d: stock.length },
    { key: "beds" as const, n: bedFacilities.filter((f) => f.occupied / f.beds < 0.85).length, d: bedFacilities.length },
    { key: "staffing" as const, n: staffed.filter((f) => f.presentDoctors / f.scheduledDoctors >= 0.8).length, d: staffed.length },
    { key: "laboratory" as const, n: labs.filter((d) => d.equipment === "operational" && d.reagents).length, d: labs.length },
  ];
  const components = raw.map((c) => ({ key: c.key, score: pct(c.n, c.d), numerator: c.n, denominator: c.d }));
  const known = components.filter((c) => c.score !== null);
  const score = known.length
    ? Math.round((known.reduce((a, c) => a + c.score!, 0) / known.length) * 10) / 10
    : null;
  return { score, components };
}
