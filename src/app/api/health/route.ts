import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await (await getDb()).prepare("SELECT 1").get();
    return Response.json({ status: "ok", synthetic: true });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
