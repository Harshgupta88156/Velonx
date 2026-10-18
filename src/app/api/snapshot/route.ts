import { getDb, loadSnapshot, loadInterventions, type Db } from "@/lib/db";
import type { Snapshot } from "@/lib/types";
import { analyze } from "@/lib/intelligence";
import { handleError } from "@/lib/http";
import { config } from "@/lib/config";
import { assessDataQuality } from "@/lib/data-quality";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Derived = {
  key: string;
  intelligence: ReturnType<typeof analyze>;
  quality: ReturnType<typeof assessDataQuality>;
};
// Forecasting and quality checks are pure functions of the snapshot. Every
// write bumps the revision, so (connection, revision, analysis date) is a
// safe cache key and polling clients do not recompute unchanged results.
const derivedByConnection = new WeakMap<Db, Derived>();
function derive(db: Db, snapshot: Snapshot): Derived {
  const key = `${snapshot.revision}:${snapshot.asOf}`;
  const cached = derivedByConnection.get(db);
  if (cached?.key === key) return cached;
  const fresh = {
    key,
    intelligence: analyze(snapshot),
    quality: assessDataQuality(snapshot),
  };
  derivedByConnection.set(db, fresh);
  return fresh;
}
export async function GET() {
  try {
    const db = await getDb();
    const [snapshot, interventions] = await Promise.all([
      loadSnapshot(db),
      loadInterventions(db),
    ]);
    const { intelligence, quality } = derive(db, snapshot);
    return Response.json(
      {
        snapshot,
        intelligence,
        interventions,
        quality,
        demoMode: config().demoMode,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return handleError(e);
  }
}
