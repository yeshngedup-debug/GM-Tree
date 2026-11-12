import { noStore, ipFromRequest } from "@/server/http";
import { aiMode } from "@/server/services/ai";
import { asyncRevision, databaseKind, consumeRate } from "@/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const rate = await consumeRate(
      `health:${ipFromRequest(request)}`,
      30,
      60000,
    );
    if (!rate.allowed) {
      return Response.json(
        { status: "rate_limited", retryAfter: rate.retryAfter },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfter) } },
      );
    }
  } catch {
    /* Fail open: if rate-limit store is unavailable, allow the request. */
  }
  try {
    await asyncRevision();
    return Response.json(
      {
        status: "ok",
        database: databaseKind,
        ai: aiMode(),
        serverTime: new Date().toISOString(),
      },
      { headers: noStore },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: noStore },
    );
  }
}
