import { z } from "zod";
import {
  adminLeaves,
  treeStats,
  setLeafStatus,
  seedDemo,
  clearDemo,
} from "@/server/db";
import { refreshReflection, aiMode, aiModel } from "@/server/services/ai";
import { requireAdmin } from "@/server/auth";
import {
  readJson,
  requireSameOrigin,
  verifyCsrfToken,
  errorResponse,
  AppError,
  noStore,
} from "@/server/http";
import { visitor } from "@/server/auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return Response.json(
      {
        leaves: await adminLeaves(),
        stats: await treeStats(),
        ai: aiMode(),
        model: aiModel(),
      },
      { headers: noStore },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    id: z.string().uuid(),
    status: z.enum(["approved", "hidden"]),
  }),
  z.object({ action: z.literal("seed") }),
  z.object({ action: z.literal("clear_demo") }),
  z.object({ action: z.literal("reflect") }),
]);
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const session = visitor(request);
    verifyCsrfToken(request, session.id);
    requireAdmin(request);
    const result = actionSchema.safeParse(await readJson(request));
    if (!result.success) throw new AppError("Invalid staff action.");
    const input = result.data;
    if (input.action === "status") {
      if (!(await setLeafStatus(input.id, input.status)))
        throw new AppError("Leaf not found or already updated.", 404);
    }
    if (input.action === "seed") await seedDemo();
    if (input.action === "clear_demo") await clearDemo();
    await refreshReflection();
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
