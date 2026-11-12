import { z } from "zod";
import { consumeRate, db } from "@/server/db";
import {
  isAdmin,
  verifyPassword,
  createAdminCookie,
  cookie,
} from "@/server/auth";
import {
  readJson,
  requireSameOrigin,
  errorResponse,
  AppError,
  noStore,
  ipFromRequest,
} from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return Response.json(
    {
      authenticated: isAdmin(request),
      configured: Boolean(process.env.ADMIN_PASSWORD),
    },
    { headers: noStore },
  );
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    // Per-IP rate limit on sign-in attempts (in addition to the global admin:login limit).
    const ip = ipFromRequest(request);
    await consumeRate(`admin:login:${ip}`, 5, 600000);
    if (!process.env.ADMIN_PASSWORD)
      throw new AppError(
        "Run npm run setup and restart the server to enable staff sign-in.",
        503,
      );
    const failed = await db.query(
      "SELECT count,expires FROM rate_limits WHERE key='admin:login'",
    );
    const row = failed.rows[0];
    if (
      row &&
      Number(row.expires) > Date.now() &&
      Number(row.count) >= 10
    )
      return Response.json(
        { error: "Too many sign-in attempts. Please wait a few minutes." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(
                1,
                Math.ceil((Number(row.expires) - Date.now()) / 1000),
              ),
            ),
          },
        },
      );
    const data = z
      .object({ password: z.string().min(1).max(256) })
      .safeParse(await readJson(request));
    if (!data.success || !verifyPassword(data.data.password)) {
      await consumeRate("admin:login", 10, 600000);
      throw new AppError("That password did not match.", 401);
    }
    await db.query("DELETE FROM rate_limits WHERE key='admin:login'");
    return Response.json(
      { authenticated: true },
      { headers: { ...noStore, "Set-Cookie": createAdminCookie(request) } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    return Response.json(
      { authenticated: false },
      {
        headers: {
          ...noStore,
          "Set-Cookie": cookie("gmc_admin", "", request, 0),
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
