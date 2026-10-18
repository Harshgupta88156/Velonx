import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { ServiceError } from "./service";
import { config } from "./config";

const WRITE_LIMIT = 60;
const WRITE_WINDOW_MS = 60_000;
const writeLog = new Map<string, number[]>();
/** Per-instance sliding-window limit on writes per client address. On
 * serverless hosting each instance keeps its own window, so this is a basic
 * abuse brake, not a global quota. */
export function rateLimit(request: Request, now = Date.now()) {
  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  const recent = (writeLog.get(client) ?? []).filter(
    (time) => now - time < WRITE_WINDOW_MS,
  );
  if (recent.length >= WRITE_LIMIT)
    throw new ServiceError(429, "Too many changes. Wait a minute and retry.");
  recent.push(now);
  writeLog.set(client, recent);
  if (writeLog.size > 10_000) writeLog.clear();
}
export function authorizeRequest(request: Request) {
  rateLimit(request);
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
  const settings = config();
  if (!settings.demoMode) {
    const expected = settings.adminKey;
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
const MAX_BODY_BYTES = 16_384;
export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ServiceError(415, "Use application/json.");
  // Reject declared oversize bodies before reading; then enforce on actual bytes.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
    throw new ServiceError(413, "Request too large.");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES)
    throw new ServiceError(413, "Request too large.");
  const text = new TextDecoder().decode(bytes);
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
    "DistrictCare request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    { error: "Unable to complete the request. Please refresh and try again." },
    { status: 500 },
  );
}
