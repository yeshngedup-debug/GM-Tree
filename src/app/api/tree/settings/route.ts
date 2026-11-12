import { getTreeSettings, consumeRate } from "@/server/db";
import { noStore, ipFromRequest } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const rate = await consumeRate(
      `tree:settings:${ipFromRequest(request)}`,
      60,
      60000,
    );
    if (!rate.allowed) {
      return Response.json(
        { error: "Please slow down.", code: "RATE_LIMITED", retryAfter: rate.retryAfter },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfter) } },
      );
    }
  } catch {
    /* Fail open: if rate-limit store is unavailable, allow the request. */
  }
  return Response.json({ settings: await getTreeSettings() }, {
    headers: noStore,
  });
}
