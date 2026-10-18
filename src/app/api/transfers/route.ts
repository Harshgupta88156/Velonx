import { approvalSchema, approveTransfer } from "@/lib/service";
import { authorizeRequest, jsonBody, handleError } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    authorizeRequest(request);
    return Response.json(
      approveTransfer(approvalSchema.parse(await jsonBody(request))),
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}
