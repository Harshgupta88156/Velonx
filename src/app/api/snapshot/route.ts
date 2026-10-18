import { getDb, loadSnapshot, loadInterventions } from "@/lib/db";
import { analyze } from "@/lib/intelligence";
import { handleError } from "@/lib/http";
import { assessDataQuality } from "@/lib/data-quality";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const db = await getDb();
    const snapshot = await loadSnapshot(db);
    return Response.json(
      {
        snapshot,
        intelligence: analyze(snapshot),
        interventions: await loadInterventions(db),
        quality: assessDataQuality(snapshot),
        demoMode: process.env.DEMO_MODE !== "false",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
