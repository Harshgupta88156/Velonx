import { getDb, loadSnapshot, loadInterventions } from "@/lib/db";
import { analyze } from "@/lib/intelligence";
import { handleError } from "@/lib/http";
import { assessDataQuality } from "@/lib/data-quality";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = getDb();
    const snapshot = db.transaction(() => loadSnapshot(db))();
    return Response.json(
      {
        snapshot,
        intelligence: analyze(snapshot),
        interventions: loadInterventions(db),
        quality: assessDataQuality(snapshot),
        demoMode: process.env.DEMO_MODE !== "false",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
