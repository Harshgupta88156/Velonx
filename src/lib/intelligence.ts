import type {
  Attribution,
  Forecast,
  HistoryPoint,
  Intelligence,
  InventoryInsight,
  Snapshot,
} from "./types";

const DAY = 86_400_000;
const day = (value: string) => new Date(value).toISOString().slice(0, 10);
const addDays = (value: string, count: number) =>
  new Date(Date.parse(day(value)) + count * DAY).toISOString().slice(0, 10);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const mean = (values: number[]) => sum(values) / values.length;
const positive = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;
type Method = Exclude<Forecast["method"], "insufficient-data">;
const methods: Method[] = [
  "seasonal-naive",
  "moving-average",
  "exponential-smoothing",
  "ridge-regression",
];
const RIDGE_MIN_VALUES = 35; // 14 validation origins + at least 14 training rows + 7 lag days
const RIDGE_LAMBDA = 1;
const features = [
  { feature: "lastDay", label: "Yesterday's demand" },
  { feature: "sameWeekdayLastWeek", label: "Same weekday last week" },
  { feature: "weekMean", label: "7-day mean" },
] as const;
const featureRow = (v: number[], t: number) => [
  v[t - 1],
  v[t - 7],
  mean(v.slice(t - 7, t)),
];

/** Ridge regression on standardized lag features, solved in closed form.
 * Returns null when there are too few rows to fit. Prediction is linear, so
 * exact SHAP values are w_j * (x_j - mean_j) (independent-feature form). */
function fitRidge(values: number[]) {
  const rows: number[][] = [];
  const targets: number[] = [];
  for (let t = 7; t < values.length; t++) {
    rows.push(featureRow(values, t));
    targets.push(values[t]);
  }
  if (rows.length < 14) return null;
  const k = features.length;
  const mu = Array.from({ length: k }, (_, j) => mean(rows.map((r) => r[j])));
  const sd = Array.from(
    { length: k },
    (_, j) => Math.sqrt(mean(rows.map((r) => (r[j] - mu[j]) ** 2))) || 1,
  );
  const yMean = mean(targets);
  const z = rows.map((r) => r.map((x, j) => (x - mu[j]) / sd[j]));
  const a = Array.from({ length: k }, (_, i) =>
    Array.from({ length: k + 1 }, (_, j) =>
      j === k
        ? sum(z.map((r, n) => r[i] * (targets[n] - yMean)))
        : sum(z.map((r) => r[i] * r[j])) + (i === j ? RIDGE_LAMBDA : 0),
    ),
  );
  for (let c = 0; c < k; c++) {
    let pivot = c;
    for (let r = c + 1; r < k; r++)
      if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let j = c; j <= k; j++) a[r][j] -= f * a[c][j];
    }
  }
  const w = a.map((row, i) => row[k] / row[i]); // per standardized feature
  const coef = w.map((value, j) => value / sd[j]);
  const next = (x: number[]) =>
    yMean +
    x.reduce((acc, value, j) => acc + w[j] * ((value - mu[j]) / sd[j]), 0);
  return { mu, coef, yMean, next };
}
function ridgePredict(values: number[], horizon: number): number[] {
  const model = fitRidge(values);
  if (!model) return Array(horizon).fill(mean(values.slice(-7)));
  const series = [...values];
  const out: number[] = [];
  for (let i = 0; i < horizon; i++) {
    const value = positive(model.next(featureRow(series, series.length)));
    series.push(value);
    out.push(value);
  }
  return out;
}
export function explainRidge(values: number[]): Attribution | null {
  const model = fitRidge(values);
  if (!model) return null;
  const x = featureRow(values, values.length);
  return {
    baseline: model.yMean,
    prediction: model.next(x),
    contributions: features.map((f, j) => ({
      ...f,
      input: x[j],
      shap: model.coef[j] * (x[j] - model.mu[j]),
    })),
  };
}

function predict(values: number[], method: Method, horizon: number): number[] {
  if (method === "ridge-regression") return ridgePredict(values, horizon);
  if (method === "seasonal-naive")
    return Array.from(
      { length: horizon },
      (_, i) => values[values.length - 7 + (i % 7)],
    );
  if (method === "moving-average")
    return Array(horizon).fill(mean(values.slice(-7)));
  const level = values
    .slice(1)
    .reduce((previous, value) => 0.3 * value + 0.7 * previous, values[0]);
  return Array(horizon).fill(level);
}

/** Daily observations only. Missing days are not assumed to have zero demand.
 * Validation uses exactly 14 rolling one-step origins, each refitted using only
 * observations before its target. All methods share the same origins and a
 * minimum initial training window of 7 days. Ties prefer seasonal naive.
 * Bands are +/- the selected model's empirical 90th-percentile absolute
 * one-step holdout error. They are descriptive, not calibrated coverage.
 */
export function forecast(
  history: HistoryPoint[],
  horizon = 7,
  asOf?: string,
): Forecast {
  const cutoff = asOf ? day(asOf) : undefined;
  const observations = new Map<string, number>();
  for (const point of history) {
    if (
      !Number.isFinite(Date.parse(point.date)) ||
      !Number.isFinite(point.value) ||
      point.value < 0
    )
      continue;
    const date = day(point.date);
    if (!cutoff || date <= cutoff) observations.set(date, point.value);
  }
  const sorted = [...observations].sort(([a], [b]) => a.localeCompare(b));
  // Use only the most recent contiguous suffix, so a gap cannot shift weekdays.
  let start = sorted.length - 1;
  while (start > 0 && addDays(sorted[start - 1][0], 1) === sorted[start][0])
    start--;
  const recent = sorted.slice(Math.max(0, start));
  const last = recent.at(-1)?.[0];
  const stale = !!(
    last &&
    cutoff &&
    last !== cutoff &&
    last !== addDays(cutoff, -1)
  );
  const values = recent.map(([, value]) => value);
  if (values.length < 21 || stale)
    return {
      method: "insufficient-data",
      points: [],
      mae: null,
      validationPoints: 0,
      trainingPoints: values.length,
      intervalLabel: stale
        ? "Latest observation is older than yesterday; no forecast issued."
        : "At least 21 consecutive daily observations are required (7 training + 14 validation).",
    };
  const candidates = methods
    .filter(
      (method) =>
        method !== "ridge-regression" || values.length >= RIDGE_MIN_VALUES,
    )
    .map((method) => {
      const errors = values.slice(-14).map((actual, index) => {
        const training = values.slice(0, values.length - 14 + index);
        return Math.abs(actual - predict(training, method, 1)[0]);
      });
      return { method, errors, mae: mean(errors) };
    });
  candidates.sort((a, b) => a.mae - b.mae);
  const selected = candidates[0];
  const ordered = [...selected.errors].sort((a, b) => a - b);
  const radius = ordered[Math.ceil(0.9 * ordered.length) - 1];
  const count = Number.isFinite(horizon)
    ? Math.max(0, Math.min(365, Math.floor(horizon)))
    : 7;
  return {
    method: selected.method,
    mae: selected.mae,
    validationPoints: 14,
    trainingPoints: values.length,
    attribution:
      selected.method === "ridge-regression"
        ? (explainRidge(values) ?? undefined)
        : undefined,
    points: predict(values, selected.method, count).map((value, index) => ({
      date: addDays(last!, index + 1),
      value: Math.max(0, value),
      lower: Math.max(0, value - radius),
      upper: Math.max(0, value + radius),
    })),
    intervalLabel:
      "Empirical error envelope: ±90th percentile absolute error from 14 rolling one-step holdouts; multi-day coverage is not calibrated.",
  };
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const h =
    Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) *
      Math.cos(radians(b.lat)) *
      Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function analyze(snapshot: Snapshot): Intelligence {
  const asOf = day(snapshot.asOf);
  const inventory: InventoryInsight[] = snapshot.inventory.map((row) => {
    const expired =
      !Number.isFinite(Date.parse(row.expiry)) || day(row.expiry) < asOf;
    const available = expired
      ? 0
      : positive(row.quantity - positive(row.reserved));
    const projection = forecast(row.history, 14, asOf);
    const known = projection.method !== "insufficient-data";
    const dailyDemand = known ? mean(projection.points.map((p) => p.value)) : 0;
    const conservativeWeek = sum(
      projection.points.slice(0, 7).map((p) => p.upper ?? p.value),
    );
    const target = Math.max(
      positive(row.minimum),
      sum(projection.points.map((p) => p.value)),
      conservativeWeek,
    );
    const daysRemaining =
      known && dailyDemand > 0 ? available / dailyDemand : null;
    const risk =
      available === 0 || available < positive(row.minimum)
        ? "critical"
        : !known
          ? "unknown"
          : daysRemaining !== null && daysRemaining < 3
            ? "critical"
            : available < conservativeWeek
              ? "warning"
              : "healthy";
    return {
      inventoryId: row.id,
      facilityId: row.facilityId,
      medicineId: row.medicineId,
      available,
      dailyDemand,
      daysRemaining,
      shortageDate:
        daysRemaining === null
          ? null
          : addDays(asOf, Math.floor(daysRemaining)),
      risk,
      forecast: { ...projection, points: projection.points.slice(0, 7) },
      replenishment: known ? Math.max(0, Math.ceil(target - available)) : 0,
      expired,
    };
  });
  const facilities = new Map(snapshot.facilities.map((f) => [f.id, f]));
  const rows = new Map(snapshot.inventory.map((row) => [row.id, row]));
  const remaining = new Map(
    inventory.map((row) => [row.inventoryId, row.available]),
  );
  const recommendations: Intelligence["recommendations"] = [];
  const recipients = inventory
    .filter((row) => row.risk === "critical" || row.risk === "warning")
    .sort(
      (a, b) =>
        (a.risk === b.risk
          ? (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity)
          : a.risk === "critical"
            ? -1
            : 1) || a.inventoryId.localeCompare(b.inventoryId),
    );
  for (const recipient of recipients) {
    const recipientFacility = facilities.get(recipient.facilityId);
    if (!recipientFacility) continue;
    // Pending inbound shipments consume the target budget, but are not usable
    // physical stock until receipt. This prevents another approval overfilling it.
    const inbound = sum(
      snapshot.transfers
        .filter(
          (transfer) =>
            transfer.recipientId === recipient.facilityId &&
            transfer.medicineId === recipient.medicineId &&
            (transfer.status === "approved" ||
              transfer.status === "dispatched"),
        )
        .map((transfer) => positive(transfer.quantity)),
    );
    let needed = Math.max(0, recipient.replenishment - inbound);
    const donors = inventory
      .filter(
        (donor) =>
          donor.facilityId !== recipient.facilityId &&
          donor.medicineId === recipient.medicineId &&
          donor.risk !== "unknown" &&
          !donor.expired,
      )
      .map((donor) => ({
        donor,
        distance: facilities.has(donor.facilityId)
          ? distanceKm(facilities.get(donor.facilityId)!, recipientFacility)
          : Infinity,
      }))
      .filter(
        ({ donor, distance }) =>
          Number.isFinite(distance) &&
          distance <= 60 &&
          day(rows.get(donor.inventoryId)!.expiry) > addDays(asOf, 15),
      )
      .sort(
        (a, b) =>
          a.distance - b.distance ||
          a.donor.inventoryId.localeCompare(b.donor.inventoryId),
      );
    for (const { donor, distance } of donors) {
      if (needed <= 0) break;
      const donorRow = rows.get(donor.inventoryId)!;
      const safety = Math.ceil(
        Math.max(
          positive(donorRow.minimum),
          sum(donor.forecast.points.map((p) => p.upper ?? p.value)),
        ),
      );
      // Suggested inbound shipments cannot finance another suggested shipment.
      const donorAvailable = Math.min(
        donor.available,
        remaining.get(donor.inventoryId)!,
      );
      const quantity = Math.floor(
        Math.min(needed, Math.max(0, donorAvailable - safety)),
      );
      if (quantity <= 0) continue;
      const recipientBefore = remaining.get(recipient.inventoryId)!;
      remaining.set(donor.inventoryId, donorAvailable - quantity);
      remaining.set(recipient.inventoryId, recipientBefore + quantity);
      needed -= quantity;
      recommendations.push({
        id: `${donor.facilityId}:${recipient.facilityId}:${donor.medicineId}`,
        donorId: donor.facilityId,
        recipientId: recipient.facilityId,
        medicineId: donor.medicineId,
        quantity,
        distanceKm: distance,
        donorDaysAfter:
          donor.dailyDemand > 0
            ? (donorAvailable - quantity) / donor.dailyDemand
            : null,
        recipientDaysBefore:
          recipient.dailyDemand > 0
            ? recipientBefore / recipient.dailyDemand
            : null,
        recipientDaysAfter:
          recipient.dailyDemand > 0
            ? (recipientBefore + quantity) / recipient.dailyDemand
            : null,
        donorSafetyStock: safety,
        urgency: recipient.risk as "critical" | "warning",
        explanation: `Toward 14 days of forecast demand; retain at least ${safety} units at donor (minimum or conservative 7-day demand). Existing reservations and earlier recommendations are deducted. Assumes next-day arrival; expiry must exceed arrival by 14 days.`,
        donorInventoryVersion: donorRow.version,
        recipientInventoryVersion: rows.get(recipient.inventoryId)!.version,
      });
    }
  }
  const risks: Intelligence["risks"] = snapshot.facilities.map((facility) => {
    const medicines = inventory.filter((row) => row.facilityId === facility.id);
    const diagnostics = snapshot.diagnostics.filter(
      (row) => row.facilityId === facility.id,
    );
    const reasons: Intelligence["risks"][number]["reasons"] = [];
    let score = 0;
    if (medicines.some((row) => row.risk === "critical")) {
      score += 35;
      reasons.push({ code: "medicine-critical" });
    } else if (medicines.some((row) => row.risk === "warning")) {
      score += 20;
      reasons.push({ code: "medicine-warning" });
    }
    if (medicines.some((row) => row.forecast.method === "insufficient-data"))
      reasons.push({ code: "medicine-data-missing" });
    if (facility.beds > 0 && facility.occupied / facility.beds >= 0.85) {
      const occupancy = facility.occupied / facility.beds;
      score += occupancy >= 1 ? 25 : 15;
      reasons.push({ code: "bed-pressure", value: occupancy });
    }
    if (
      facility.dailyCapacity > 0 &&
      facility.patientsToday / facility.dailyCapacity > 1
    ) {
      score += 20;
      reasons.push({
        code: "patient-load",
        value: facility.patientsToday / facility.dailyCapacity,
      });
    }
    if (
      facility.attendanceRecorded &&
      facility.scheduledDoctors > 0 &&
      facility.presentDoctors < facility.scheduledDoctors
    ) {
      score += 10;
      reasons.push({
        code: "verified-staffing-gap",
        value: Math.max(0, facility.scheduledDoctors - facility.presentDoctors),
      });
    }
    if (!facility.attendanceRecorded)
      reasons.push({ code: "attendance-not-recorded" });
    const analysisTime =
      Date.parse(snapshot.asOf) +
      (/^\d{4}-\d{2}-\d{2}$/.test(snapshot.asOf) ? DAY - 1 : 0);
    const diagnosticsFresh = diagnostics.filter(
      (row) =>
        Number.isFinite(Date.parse(row.updatedAt)) &&
        analysisTime - Date.parse(row.updatedAt) <= 2 * DAY &&
        Date.parse(row.updatedAt) <= analysisTime,
    );
    if (
      diagnostics.length === 0 ||
      diagnostics.some((row) => row.equipment === "unknown")
    )
      reasons.push({ code: "diagnostic-data-missing" });
    if (diagnosticsFresh.length !== diagnostics.length)
      reasons.push({ code: "diagnostic-data-stale" });
    if (
      diagnosticsFresh.some(
        (row) =>
          row.equipment === "down" ||
          (row.equipment === "operational" && !row.reagents),
      )
    ) {
      score += 10;
      reasons.push({ code: "diagnostic-unavailable" });
    }
    const completeness =
      [
        medicines.length > 0 &&
          medicines.every((row) => row.forecast.method !== "insufficient-data"),
        facility.beds > 0,
        facility.dailyCapacity > 0,
        facility.attendanceRecorded,
        diagnostics.length > 0 &&
          diagnosticsFresh.length === diagnostics.length &&
          diagnostics.every((row) => row.equipment !== "unknown"),
      ].filter(Boolean).length / 5;
    return {
      facilityId: facility.id,
      score,
      level: score >= 50 ? "critical" : score >= 20 ? "watch" : "stable",
      reasons,
      completeness,
    };
  });
  return {
    inventory,
    recommendations,
    risks,
    footfall: Object.fromEntries(
      snapshot.facilities.map((f) => [
        f.id,
        forecast(snapshot.footfall[f.id] ?? [], 7, asOf),
      ]),
    ),
  };
}
