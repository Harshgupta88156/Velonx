import test from "node:test";
import assert from "node:assert/strict";
import { analyze, distanceKm, forecast } from "../src/lib/intelligence";
import type {
  Facility,
  HistoryPoint,
  Inventory,
  Snapshot,
} from "../src/lib/types";

const asOf = "2026-10-18";
function history(value: number | ((i: number) => number) = 10): HistoryPoint[] {
  return Array.from({ length: 42 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 6 + i)).toISOString().slice(0, 10),
    value: typeof value === "number" ? value : value(i),
  }));
}
function facility(id: string, lng = 73): Facility {
  return {
    id,
    name: id,
    type: "PHC",
    block: "demo",
    lat: 18,
    lng,
    beds: 10,
    occupied: 2,
    scheduledDoctors: 2,
    presentDoctors: 2,
    attendanceRecorded: true,
    dailyCapacity: 100,
    patientsToday: 30,
    updatedAt: asOf,
  };
}
function stock(
  id: string,
  facilityId: string,
  quantity: number,
  extra: Partial<Inventory> = {},
): Inventory {
  return {
    id,
    facilityId,
    quantity,
    medicineId: "m",
    reserved: 0,
    minimum: 20,
    expiry: "2027-01-01",
    version: 1,
    history: history(),
    ...extra,
  };
}
function snapshot(
  inventory: Inventory[],
  facilities = [facility("donor"), facility("a", 73.01), facility("b", 73.02)],
): Snapshot {
  return {
    facilities,
    inventory,
    medicines: [{ id: "m", name: "Medicine", unit: "tablets" }],
    footfall: {},
    diagnostics: [],
    transfers: [],
    audit: [],
    asOf,
    synthetic: true,
    revision: 1,
  };
}

test("weekly seasonal demand wins shared leakage-free walk-forward holdouts", () => {
  const result = forecast(
    history((i) => [2, 3, 5, 7, 11, 13, 17][i % 7]),
    7,
    asOf,
  );
  assert.equal(result.method, "seasonal-naive");
  assert.equal(result.mae, 0);
  assert.equal(result.validationPoints, 14);
  assert.equal(result.points[0].date, asOf);
  assert.deepEqual(
    result.points.map((p) => p.value),
    [2, 3, 5, 7, 11, 13, 17],
  );
  assert.match(result.intervalLabel, /not calibrated/);
});

test("future observations cannot affect a supplied analysis date", () => {
  const original = history();
  assert.deepEqual(
    forecast([...original, { date: "2026-11-01", value: 1e9 }], 7, asOf),
    forecast(original, 7, asOf),
  );
});

test("moving average and smoothing can win; MAE uses past-only training", () => {
  // 34 days: below the 35-day ridge minimum, so the three baselines compete alone.
  const noisy = history((i) => [8, 12, 9, 11, 10][i % 5]).slice(-34);
  const moving = forecast(noisy, 7, asOf);
  assert.equal(moving.method, "moving-average");
  const manualErrors = Array.from({ length: 14 }, (_, i) => {
    const index = noisy.length - 14 + i;
    const average =
      noisy.slice(index - 7, index).reduce((total, p) => total + p.value, 0) /
      7;
    return Math.abs(noisy[index].value - average);
  });
  assert.ok(
    Math.abs(moving.mae! - manualErrors.reduce((a, b) => a + b) / 14) < 1e-12,
  );
  const trend = forecast(
    history((i) => i).slice(-34),
    7,
    asOf,
  );
  assert.equal(trend.method, "exponential-smoothing");
  assert.ok(trend.mae! > 3 && trend.mae! < 3.34);
});

test("short, gapped, or stale history returns unknown without fabricated bands", () => {
  for (const input of [
    history().slice(-20),
    history().filter((_, i) => i !== 35),
    history().slice(0, -3),
  ]) {
    const result = forecast(input, 7, asOf);
    assert.equal(result.method, "insufficient-data");
    assert.equal(result.mae, null);
    assert.deepEqual(result.points, []);
  }
});

test("all projected bounds are nonnegative and ordered", () => {
  const result = forecast(
    history((i) => (i % 3 ? 0 : 20)),
    14,
    asOf,
  );
  assert.equal(result.points.length, 14);
  for (const point of result.points)
    assert.ok(
      point.lower! >= 0 &&
        point.value >= point.lower! &&
        point.upper! >= point.value,
    );
});

test("joint donor budget and recipient target prevent over-allocation", () => {
  const result = analyze(
    snapshot([
      stock("d", "donor", 300, { reserved: 50 }),
      stock("a", "a", 0),
      stock("b", "b", 0),
    ]),
  );
  const recommendations = result.recommendations;
  assert.equal(
    recommendations.reduce((n, r) => n + r.quantity, 0),
    180,
  ); // 300 - 50 reserved - 70 safety.
  assert.equal(
    recommendations
      .filter((r) => r.recipientId === "a")
      .reduce((n, r) => n + r.quantity, 0),
    140,
  );
  assert.equal(
    recommendations
      .filter((r) => r.recipientId === "b")
      .reduce((n, r) => n + r.quantity, 0),
    40,
  );
  assert.equal(recommendations.at(-1)!.donorDaysAfter, 7);
  assert.equal(recommendations[0].id, "donor:a:m");
});

test("minimum and empirical upper errors preserve conservative donor stock", () => {
  const result = analyze(
    snapshot([stock("d", "donor", 300, { minimum: 250 }), stock("a", "a", 0)]),
  );
  assert.equal(result.recommendations[0].quantity, 50);
  assert.equal(result.recommendations[0].donorSafetyStock, 250);
});

test("pending inbound shipments consume replenishment budget without changing physical days", () => {
  for (const status of ["approved", "dispatched"] as const) {
    const data = snapshot([stock("d", "donor", 500), stock("a", "a", 0)]);
    data.transfers.push({
      id: "pending",
      donorId: "other",
      recipientId: "a",
      medicineId: "m",
      quantity: 100,
      status,
      createdAt: asOf,
      updatedAt: asOf,
      approvedBy: "admin",
      reason: "demo",
    });
    const result = analyze(data);
    assert.equal(
      result.recommendations.reduce((n, row) => n + row.quantity, 0),
      40,
    );
    assert.equal(
      result.inventory.find((row) => row.facilityId === "a")!.daysRemaining,
      0,
    );
    data.transfers[0].quantity = 140;
    assert.deepEqual(analyze(data).recommendations, []);
    data.transfers[0].status = "cancelled";
    assert.equal(analyze(data).recommendations[0].quantity, 140);
  }
});

test("expired, distant, unknown, and too-soon-expiring donors are infeasible", () => {
  for (const extra of [
    { expiry: "2026-10-17" },
    { expiry: "2026-11-02" },
    { history: [] },
  ]) {
    const result = analyze(
      snapshot([stock("d", "donor", 500, extra), stock("a", "a", 0)]),
    );
    assert.deepEqual(result.recommendations, []);
  }
  const distant = analyze(
    snapshot(
      [stock("d", "donor", 500), stock("a", "a", 0)],
      [facility("donor", 74), facility("a", 73)],
    ),
  );
  assert.deepEqual(distant.recommendations, []);
  assert.ok(distanceKm(facility("x", 74), facility("y", 73)) > 60);
});

test("expired stock is unavailable; zero and unknown demand avoid infinite days", () => {
  const result = analyze(
    snapshot([
      stock("expired", "a", 999, { expiry: "2026-10-17" }),
      stock("zero", "b", 50, { history: history(0) }),
      stock("unknown", "donor", 20, { history: [] }),
    ]),
  );
  assert.equal(result.inventory[0].available, 0);
  assert.equal(result.inventory[0].risk, "critical");
  assert.equal(result.inventory[1].daysRemaining, null);
  assert.equal(result.inventory[1].risk, "healthy");
  assert.equal(result.inventory[2].risk, "unknown");
  assert.equal(result.inventory[2].replenishment, 0);
});

test("missing attendance reduces completeness without claiming absenteeism", () => {
  const f = { ...facility("a"), attendanceRecorded: false, presentDoctors: 0 };
  const result = analyze(snapshot([stock("a", "a", 500)], [f]));
  assert.equal(result.risks[0].score, 0);
  assert.ok(
    result.risks[0].reasons.some((r) => r.code === "attendance-not-recorded"),
  );
  assert.ok(
    !result.risks[0].reasons.some((r) => r.code === "verified-staffing-gap"),
  );
  assert.equal(result.risks[0].completeness, 0.6);
});

test("zero physical stock is critical while missing history stays explicit", () => {
  const result = analyze(snapshot([stock("a", "a", 0, { history: [] })]));
  assert.equal(result.inventory[0].risk, "critical");
  assert.equal(result.inventory[0].forecast.method, "insufficient-data");
  assert.equal(result.inventory[0].replenishment, 0);
  assert.ok(
    result.risks
      .find((row) => row.facilityId === "a")!
      .reasons.some((reason) => reason.code === "medicine-data-missing"),
  );
});

test("stale and unknown diagnostic records reduce completeness without inferred outage", () => {
  const data = snapshot([stock("a", "a", 500)], [facility("a")]);
  data.diagnostics = [
    {
      id: "old",
      facilityId: "a",
      name: "Lab",
      equipment: "down",
      reagents: false,
      updatedAt: "2026-10-10",
      downtimeHours: 12,
    },
    {
      id: "unknown",
      facilityId: "a",
      name: "X-ray",
      equipment: "unknown",
      reagents: false,
      updatedAt: asOf,
      downtimeHours: 0,
    },
  ];
  const risk = analyze(data).risks[0];
  assert.equal(risk.score, 0);
  assert.ok(
    risk.reasons.some((reason) => reason.code === "diagnostic-data-stale"),
  );
  assert.ok(
    risk.reasons.some((reason) => reason.code === "diagnostic-data-missing"),
  );
  assert.ok(
    !risk.reasons.some((reason) => reason.code === "diagnostic-unavailable"),
  );
  assert.equal(risk.completeness, 0.8);
});

test("risk score exposes bed/load/verified staffing/diagnostic contributors", () => {
  const f = {
    ...facility("a"),
    occupied: 10,
    patientsToday: 120,
    presentDoctors: 1,
  };
  const data = snapshot([stock("a", "a", 0)], [f]);
  data.diagnostics.push({
    id: "lab",
    facilityId: "a",
    name: "Lab",
    equipment: "down",
    reagents: true,
    updatedAt: asOf,
    downtimeHours: 3,
  });
  const risk = analyze(data).risks[0];
  assert.equal(risk.score, 100);
  assert.equal(risk.level, "critical");
  assert.equal(risk.reasons.length, 5);
  assert.deepEqual(analyze(data), analyze(data));
});

test("ridge model is eligible from 35 days and its SHAP values sum to prediction minus baseline", () => {
  assert.notEqual(forecast(history((i) => i).slice(-34), 7, asOf).method, "ridge-regression");
  const trend = forecast(history((i) => i), 7, asOf);
  assert.equal(trend.method, "ridge-regression");
  assert.ok(trend.mae! < 1);
  const a = trend.attribution!;
  const total = a.contributions.reduce((acc, c) => acc + c.shap, 0);
  assert.ok(Math.abs(a.baseline + total - a.prediction) < 1e-9);
  assert.ok(Math.abs(trend.points[0].value - Math.max(0, a.prediction)) < 1e-9);
});
