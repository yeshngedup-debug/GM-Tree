import { listLeaves, snapshot, consumeRate } from "@/server/db";
import { AppError, errorResponse, noStore, ipFromRequest } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const rate = await consumeRate(
      `leaves:${ipFromRequest(request)}`,
      120,
      60000,
    );
    if (!rate.allowed) {
      return Response.json(
        { error: "Please slow down.", code: "RATE_LIMITED", retryAfter: rate.retryAfter },
        { status: 429, headers: { ...noStore, "Retry-After": String(rate.retryAfter) } },
      );
    }
    const params = new URL(request.url).searchParams;
    if (!params.has("limit") && !params.has("cursor"))
      return Response.json(await snapshot(), { headers: noStore });
    const limit = Math.min(120, Math.max(1, Number(params.get("limit") || 60)));
    if (!Number.isInteger(limit)) throw new AppError("Invalid page size.");
    let cursor: { created_at: string; id: string } | undefined;
    if (params.has("cursor")) {
      try {
        cursor = JSON.parse(
          Buffer.from(params.get("cursor")!, "base64url").toString(),
        );
      } catch {
        throw new AppError("Invalid cursor.");
      }
      if (
        !cursor ||
        typeof cursor.id !== "string" ||
        typeof cursor.created_at !== "string"
      )
        throw new AppError("Invalid cursor.");
    }
    const leaves = await listLeaves(limit + 1, cursor);
    const more = leaves.length > limit;
    if (more) leaves.pop();
    const last = leaves.at(-1);
    return Response.json(
      {
        leaves,
        nextCursor:
          more && last
            ? Buffer.from(
                JSON.stringify({ created_at: last.created_at, id: last.id }),
              ).toString("base64url")
            : null,
      },
      { headers: noStore },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
