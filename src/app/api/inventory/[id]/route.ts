import { inventorySchema, updateInventory } from "@/lib/service";
import { authorizeRequest, jsonBody, handleError } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(request);
    return Response.json(
      await updateInventory(
        (await params).id,
        inventorySchema.parse(await jsonBody(request)),
      ),
    );
  } catch (e) {
    return handleError(e);
  }
}
