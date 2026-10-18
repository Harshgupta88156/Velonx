import test from "node:test";
import assert from "node:assert/strict";
import { assessDataQuality } from "../src/lib/data-quality";
import { createSeed } from "../src/lib/seed";
import type { HistoryPoint } from "../src/lib/types";

test("seed reports all 56 series; missing attendance never means absence", () => {
  const data = createSeed("2026-10-18");
  const report = assessDataQuality(data);
  assert.equal(report.summary.historySeries, 56);
  assert.equal(report.summary.forecastEligibleSeries, 56);
  assert.equal(report.summary.missingAttendanceFacilities, 1);
  assert.equal(report.summary.invalidObservations, 0);
  assert.equal(report.summary.missingDays, 0);
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.code === "attendance-missing" && issue.facilityId === "ichhawar",
    ),
  );
  assert.ok(report.issues.every((issue) => !issue.code.includes("absence")));
  assert.equal(report.summary.unknownDiagnosticRecords, 1);
  assert.equal(report.summary.staleRecords, 4);
  assert.equal(report.summary.issueCount, report.issues.length);
});

test("invalid, duplicate, future and missing observations are counted without zero imputation", () => {
  const data = createSeed("2026-10-18");
  data.inventory[0].history = [
    { date: "2026-10-14", value: 0 },
    { date: "2026-10-14T10:00:00Z", value: 3 },
    { date: "2026-10-17", value: 5 },
    { date: "bad", value: 4 },
    { date: "2026-02-30", value: 1 },
    { date: "2026-10-16", value: NaN },
    { date: "2026-10-15", value: -1 },
    { date: "2026-10-20", value: 1 },
    { date: "2026-10-12", value: null } as unknown as HistoryPoint,
  ];
  const before = structuredClone(data);
  const report = assessDataQuality(data);
  assert.equal(report.summary.invalidObservations, 5);
  assert.equal(report.summary.duplicateObservations, 1);
  assert.equal(report.summary.futureObservations, 1);
  assert.equal(report.summary.missingDays, 2);
  const series = report.series.find(
    (series) => series.recordId === data.inventory[0].id,
  )!;
  assert.equal(series.validUniqueDays, 2);
  assert.equal(series.contiguousDays, 1);
  assert.equal(series.forecastEligible, false);
  assert.deepEqual(data, before);
});

test("latest contiguous history and asOf freshness determine forecast eligibility", () => {
  const data = createSeed("2026-10-18");
  data.inventory[0].history = data.inventory[0].history.slice(0, -3);
  data.inventory[1].history = data.inventory[1].history.slice(-21);
  data.inventory[2].history = data.inventory[2].history.slice(-20);
  const report = assessDataQuality(data);
  assert.equal(report.summary.forecastEligibleSeries, 54);
  assert.equal(
    report.series.find((series) => series.recordId === data.inventory[1].id)!
      .forecastEligible,
    true,
  );
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.code === "history-stale" &&
        issue.recordId === data.inventory[0].id,
    ),
  );
});

test("date-end age boundary, missing records and unknown diagnostic state are explicit", () => {
  const data = createSeed("2026-10-18");
  const f = data.facilities[0];
  f.updatedAt = "2026-10-18T23:59:59Z";
  data.diagnostics = data.diagnostics.filter(
    (record) => record.facilityId !== f.id,
  );
  data.inventory = data.inventory.filter(
    (record) => record.facilityId !== f.id,
  );
  delete data.footfall[f.id];
  const report = assessDataQuality(data);
  assert.ok(
    report.issues.some(
      (issue) =>
        issue.code === "diagnostic-records-missing" &&
        issue.facilityId === f.id,
    ),
  );
  assert.equal(
    report.issues.filter(
      (issue) =>
        issue.code === "inventory-record-missing" && issue.facilityId === f.id,
    ).length,
    6,
  );
  assert.ok(
    !report.issues.some(
      (issue) =>
        issue.code === "clinical-timestamp-future" && issue.facilityId === f.id,
    ),
  );
  assert.equal(
    report.series.find(
      (series) => series.domain === "opd" && series.facilityId === f.id,
    )!.observations,
    0,
  );
  assert.throws(
    () => assessDataQuality({ ...data, asOf: "2026-02-30" }),
    RangeError,
  );
  assert.throws(() => assessDataQuality({ ...data, asOf: "bad" }), RangeError);
});
