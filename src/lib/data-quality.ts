import { forecast } from './intelligence';
import type { HistoryPoint, Snapshot } from './types';

export type QualityDomain = 'inventory' | 'attendance' | 'diagnostics' | 'facility' | 'opd';
export type QualityIssue = {
  id: string; facilityId: string; domain: QualityDomain; code: string;
  severity: 'attention' | 'review'; count: number; recordId?: string;
};
export type QualityReport = {
  summary: {
    historySeries: number; forecastEligibleSeries: number; duplicateObservations: number;
    invalidObservations: number; missingDays: number; futureObservations: number;
    missingAttendanceFacilities: number; unknownDiagnosticRecords: number; staleRecords: number; issueCount: number;
  };
  issues: QualityIssue[];
  series: {
    facilityId: string; domain: 'opd' | 'inventory'; recordId: string;
    observations: number; validUniqueDays: number; contiguousDays: number;
    firstDate: string | null; lastDate: string | null; missingDays: number;
    duplicateObservations: number; invalidObservations: number; futureObservations: number; forecastEligible: boolean;
  }[];
};
const DAY = 86_400_000;
const calendarDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  // Date.parse normalizes February 30; a quality assessment must flag it.
  if (new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return new Date(value).toISOString().slice(0, 10);
};

/** A read-only report; never fills missing days or replaces unknown values.
 * Observation counts can overlap: a future observation with invalid demand is
 * both future and invalid. Duplicate observations count extras beyond the first
 * valid timestamp for each UTC calendar date, independently of demand validity.
 * Missing days count internal gaps between first/last usable, nonfuture dates;
 * series boundaries are not invented. staleRecords counts clinical timestamped
 * facility/diagnostic records only; stale history is a separate series issue.
 * Dates must be unambiguous ISO dates or zoned timestamps, with valid calendar
 * components. Eligibility uses the forecasting engine after excluding invalid
 * observations, so malformed dates cannot gain eligibility via Date.parse.
 */
export function assessDataQuality(snapshot: Snapshot): QualityReport {
  const asOf = calendarDate(snapshot.asOf);
  if (!asOf) throw new RangeError('A valid snapshot.asOf is required to assess data quality.');
  const analysisTime = Date.parse(snapshot.asOf) + (/^\d{4}-\d{2}-\d{2}$/.test(snapshot.asOf) ? DAY - 1 : 0);
  const report: QualityReport = { summary: {
    historySeries: 0, forecastEligibleSeries: 0, duplicateObservations: 0, invalidObservations: 0,
    missingDays: 0, futureObservations: 0, missingAttendanceFacilities: 0,
    unknownDiagnosticRecords: 0, staleRecords: 0, issueCount: 0,
  }, issues: [], series: [] };
  function issue(facilityId: string, domain: QualityDomain, code: string, count = 1, recordId?: string, severity: QualityIssue['severity'] = 'attention') {
    if (count <= 0) return;
    report.issues.push({ id: `${domain}:${facilityId}:${recordId ?? '-'}:${code}`, facilityId, domain, code, severity, count, ...(recordId ? { recordId } : {}) });
  }
  function history(facilityId: string, domain: 'opd' | 'inventory', recordId: string, observations: HistoryPoint[] | undefined) {
    report.summary.historySeries++;
    const points = Array.isArray(observations) ? observations : [];
    const dates = new Set<string>(), usable = new Set<string>();
    let invalid = 0, duplicates = 0, future = 0;
    for (const point of points) {
      const date = calendarDate(point?.date);
      const valueValid = typeof point?.value === 'number' && Number.isFinite(point.value) && point.value >= 0;
      if (!date || !valueValid) invalid++;
      if (!date) continue;
      if (dates.has(date)) duplicates++;
      dates.add(date);
      if (date > asOf!) { future++; continue; }
      if (valueValid) usable.add(date);
    }
    const ordered = [...usable].sort();
    const missing = ordered.length < 2 ? 0 : Math.round((Date.parse(ordered.at(-1)!) - Date.parse(ordered[0])) / DAY) + 1 - ordered.length;
    let contiguous = ordered.length ? 1 : 0;
    for (let i = ordered.length - 1; i > 0 && Date.parse(ordered[i]) - Date.parse(ordered[i - 1]) === DAY; i--) contiguous++;
    const latest = ordered.at(-1) ?? null;
    const eligible = forecast(points.filter(point => calendarDate(point?.date) !== null && typeof point?.value === 'number' && Number.isFinite(point.value) && point.value >= 0), 7, snapshot.asOf).method !== 'insufficient-data';
    report.summary.forecastEligibleSeries += Number(eligible);
    report.summary.invalidObservations += invalid;
    report.summary.duplicateObservations += duplicates;
    report.summary.futureObservations += future;
    report.summary.missingDays += missing;
    issue(facilityId, domain, 'history-invalid-observation', invalid, recordId);
    issue(facilityId, domain, 'history-duplicate-date', duplicates, recordId, 'review');
    issue(facilityId, domain, 'history-future-observation', future, recordId);
    issue(facilityId, domain, 'history-missing-days', missing, recordId);
    if (contiguous < 21) issue(facilityId, domain, 'history-insufficient-coverage', 1, recordId);
    if (latest && Date.parse(asOf!) - Date.parse(latest) > DAY) issue(facilityId, domain, 'history-stale', 1, recordId);
    report.series.push({ facilityId, domain, recordId, observations: points.length, validUniqueDays: ordered.length, contiguousDays: contiguous,
      firstDate: ordered[0] ?? null, lastDate: latest, missingDays: missing,
      duplicateObservations: duplicates, invalidObservations: invalid, futureObservations: future, forecastEligible: eligible });
  }
  function clinicalTimestamp(facilityId: string, domain: 'facility' | 'diagnostics', recordId: string, value: string) {
    const timestamp = calendarDate(value) ? Date.parse(value) : NaN;
    if (!Number.isFinite(timestamp)) issue(facilityId, domain, 'clinical-timestamp-invalid', 1, recordId);
    else if (timestamp > analysisTime) issue(facilityId, domain, 'clinical-timestamp-future', 1, recordId);
    else if (analysisTime - timestamp > 2 * DAY) {
      report.summary.staleRecords++;
      issue(facilityId, domain, 'clinical-record-stale', 1, recordId);
    }
  }
  const facilities = new Set(snapshot.facilities.map(facility => facility.id));
  for (const facility of snapshot.facilities) {
    history(facility.id, 'opd', facility.id, snapshot.footfall[facility.id]);
    clinicalTimestamp(facility.id, 'facility', facility.id, facility.updatedAt);
    if (facility.attendanceRecorded !== true) {
      report.summary.missingAttendanceFacilities++;
      issue(facility.id, 'attendance', 'attendance-missing', 1, facility.id);
    }
    if (!snapshot.diagnostics.some(record => record.facilityId === facility.id)) issue(facility.id, 'diagnostics', 'diagnostic-records-missing');
    if (snapshot.medicines.length === 0) issue(facility.id, 'inventory', 'medicine-catalogue-missing');
    for (const medicine of snapshot.medicines) {
      if (!snapshot.inventory.some(record => record.facilityId === facility.id && record.medicineId === medicine.id))
        issue(facility.id, 'inventory', 'inventory-record-missing', 1, medicine.id);
    }
  }
  for (const [facilityId, observations] of Object.entries(snapshot.footfall)) if (!facilities.has(facilityId)) {
    history(facilityId, 'opd', facilityId, observations);
    issue(facilityId, 'facility', 'facility-record-missing', 1, `opd:${facilityId}`);
  }
  for (const record of snapshot.inventory) {
    history(record.facilityId, 'inventory', record.id, record.history);
    if (!facilities.has(record.facilityId)) issue(record.facilityId, 'facility', 'facility-record-missing', 1, record.id);
    if (!snapshot.medicines.some(medicine => medicine.id === record.medicineId)) issue(record.facilityId, 'inventory', 'medicine-catalogue-missing', 1, record.id);
  }
  for (const record of snapshot.diagnostics) {
    clinicalTimestamp(record.facilityId, 'diagnostics', record.id, record.updatedAt);
    if (!facilities.has(record.facilityId)) issue(record.facilityId, 'facility', 'facility-record-missing', 1, record.id);
    if (record.equipment === 'unknown' || record.equipment == null) {
      report.summary.unknownDiagnosticRecords++;
      issue(record.facilityId, 'diagnostics', 'diagnostic-unknown', 1, record.id, 'review');
    }
  }
  report.summary.issueCount = report.issues.length;
  return report;
}

/** Select an existing report without reinterpreting or altering source data. */
export function scopeDataQuality(report: QualityReport, facilityIds: readonly string[]): QualityReport {
  const selected = new Set(facilityIds);
  const series = report.series.filter(row => selected.has(row.facilityId));
  const issues = report.issues.filter(row => selected.has(row.facilityId));
  const sum = (key: 'duplicateObservations'|'invalidObservations'|'missingDays'|'futureObservations') => series.reduce((n,row)=>n+row[key],0);
  return {series, issues, summary: {
    historySeries: series.length, forecastEligibleSeries: series.filter(row=>row.forecastEligible).length,
    duplicateObservations: sum('duplicateObservations'), invalidObservations: sum('invalidObservations'),
    missingDays: sum('missingDays'), futureObservations: sum('futureObservations'),
    missingAttendanceFacilities: new Set(issues.filter(row=>row.code==='attendance-missing').map(row=>row.facilityId)).size,
    unknownDiagnosticRecords: issues.filter(row=>row.code==='diagnostic-unknown').length,
    staleRecords: issues.filter(row=>row.code==='clinical-record-stale').length, issueCount: issues.length,
  }};
}
