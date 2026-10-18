import { interventionSchema, setIntervention } from "@/lib/service";
import { authorizeRequest, jsonBody, handleError } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    authorizeRequest(request);
    return Response.json(
      await setIntervention(interventionSchema.parse(await jsonBody(request))),
    );
  } catch (e) {
    return handleError(e);
  }
}
