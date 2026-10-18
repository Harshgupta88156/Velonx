import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await (await getDb()).prepare("SELECT 1").get();
    return Response.json({ status: "ok", synthetic: true });
  } catch (error) {
    // Log the cause for operators; the response stays generic.
    console.error(
      "DistrictCare health check failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
