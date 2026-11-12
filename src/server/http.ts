import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./db";

export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "INVALID_REQUEST",
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}
export async function readJson(
  request: Request,
  limit = 4096,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("Send JSON content.", 415);
  if (Number(request.headers.get("content-length")) > limit)
    throw new AppError("Your message is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("A request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new AppError("Your message is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("We could not read your message. Please try again.");
  }
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Next.js can use its internal bind address in request.url. The Host header
  // retains the address the browser actually opened (including LAN IPs).
  const expected = new URL(request.url);
  const host = request.headers.get("host");
  if (host) expected.host = host;
  if (origin && origin !== expected.origin)
    throw new AppError("Please submit from this site's form.", 403);
}

export function generateCsrfToken(sessionId: string) {
  return createHmac("sha256", sessionSecret)
    .update(`csrf:${sessionId}`)
    .digest("hex");
}

export function verifyCsrfToken(request: Request, sessionId: string) {
  const token = request.headers.get("x-csrf-token");
  const expected = generateCsrfToken(sessionId);
  if (!token || token.length !== expected.length)
    throw new AppError("Missing or invalid CSRF token.", 403, "CSRF_REQUIRED");
  if (!timingSafeEqual(Buffer.from(token), Buffer.from(expected)))
    throw new AppError("Missing or invalid CSRF token.", 403, "CSRF_REQUIRED");
}

export function ipFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: error.headers },
    );
  console.error(
    "Request failed:",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    {
      error: "Something went wrong. Your hope is safe to retry.",
      code: "SERVER_ERROR",
    },
    { status: 500 },
  );
}
export const noStore = { "Cache-Control": "no-store" };
