import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { ServiceError } from "./service";

export function authorizeRequest(request: Request) {
  const origin = request.headers.get("origin");
  // Next may normalize request.url to localhost behind its Node server/proxy.
  // Host is the browser's requested authority; do not trust forwarded-host here.
  const expectedHost = request.headers.get("host") || new URL(request.url).host;
  if (origin) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new ServiceError(403, "Cross-origin mutation blocked.");
    }
    if (
      parsed.host !== expectedHost ||
      !["http:", "https:"].includes(parsed.protocol)
    )
      throw new ServiceError(403, "Cross-origin mutation blocked.");
  }
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ServiceError(403, "Cross-origin mutation blocked.");
  if (process.env.DEMO_MODE === "false") {
    const expected = process.env.ADMIN_KEY;
    const supplied = request.headers.get("x-admin-key");
    if (
      !expected ||
      !supplied ||
      Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
    )
      throw new ServiceError(
        401,
        "Administrator API key required. The browser demo is read-only in protected mode.",
      );
  }
}
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ServiceError(415, "Use application/json.");
  const text = await request.text();
  if (text.length > 16_384) throw new ServiceError(413, "Request too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ServiceError(400, "Invalid JSON.");
  }
}
export function handleError(error: unknown) {
  if (error instanceof ServiceError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  console.error(
    "Velonx request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    { error: "Unable to complete the request. Please refresh and try again." },
    { status: 500 },
  );
}
