import { z } from "zod";
import { requireAdmin } from "@/server/auth";
import { listSubmissions, deleteSubmission } from "@/server/db";
import {
  errorResponse,
  noStore,
  AppError,
  requireSameOrigin,
  verifyCsrfToken,
  readJson,
} from "@/server/http";
import { visitor } from "@/server/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const params = new URL(request.url).searchParams;
    const result = z
      .object({
        page: z.coerce.number().int().min(1).max(100000),
        query: z.string().max(200),
        outcome: z.enum(["all", "approved", "rejected"]),
      })
      .safeParse({
        page: params.get("page") || 1,
        query: params.get("query") || "",
        outcome: params.get("outcome") || "all",
      });
    if (!result.success) throw new AppError("Invalid history filter.");
    return Response.json(await listSubmissions(result.data), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const session = visitor(request);
    verifyCsrfToken(request, session.id);
    requireAdmin(request);
    const data = z
      .object({ id: z.string().uuid() })
      .safeParse(await readJson(request));
    if (!data.success) throw new AppError("Invalid message.");
    if (!(await deleteSubmission(data.data.id)))
      throw new AppError("Message not found.", 404);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
