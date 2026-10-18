import { getDb, loadSnapshot } from '@/lib/db';
import { exportFacilityDirectory, FhirExportError } from '@/lib/fhir';
import { handleError } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store' };
function invalidScope() {
  return Response.json({ resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Use a single existing facilityId, or omit facilityId to export the district directory.' }] }, { status: 400, headers });
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => key !== 'facilityId') || params.getAll('facilityId').length > 1) return invalidScope();
    const facilityId = params.get('facilityId');
    if (facilityId !== null && !/^[A-Za-z0-9.-]{1,64}$/.test(facilityId)) return invalidScope();
    const db = getDb();
    const snapshot = db.transaction(() => loadSnapshot(db))();
    if (facilityId !== null && !snapshot.facilities.some(facility => facility.id === facilityId)) return invalidScope();
    const scoped = facilityId === null ? snapshot : { ...snapshot, facilities: snapshot.facilities.filter(facility => facility.id === facilityId) };
    return Response.json(exportFacilityDirectory(scoped), { headers: { ...headers, 'Content-Disposition': 'attachment; filename="districtcare-facilities.fhir.json"' } });
  } catch (error) {
    if (error instanceof FhirExportError) return Response.json({ resourceType: 'OperationOutcome', issue: error.issues.map(issue => ({ severity: 'error', code: 'invalid', diagnostics: issue.message, expression: [issue.path] })) }, { status: 422, headers });
    return handleError(error);
  }
}
