import { requireAdmin } from "@/server/auth";
import { treeSettingsSchema } from "@/lib/tree-settings";
import { consumeRate, getTreeSettings, saveTreeSettings } from "@/server/db";
import {
  AppError,
  errorResponse,
  noStore,
  readJson,
  requireSameOrigin,
  ipFromRequest,
} from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return Response.json({ settings: await getTreeSettings() }, {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PUT(request: Request) {
  try {
    requireSameOrigin(request);
    requireAdmin(request);
    const ip = ipFromRequest(request);
    await consumeRate(`admin:tree:${ip}`, 30, 60000);
    const result = treeSettingsSchema.safeParse(await readJson(request));
    if (!result.success)
      throw new AppError(
        "Check the tree settings: " + result.error.issues[0].message,
      );
    await saveTreeSettings(result.data);
    return Response.json({ settings: result.data }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    requireAdmin(request);
    const ip = ipFromRequest(request);
    await consumeRate(`admin:tree:${ip}`, 30, 60000);
    const headline = treeSettingsSchema
      .pick({ headline: true })
      .strict()
      .safeParse(await readJson(request));
    if (!headline.success)
      throw new AppError("Use a display title between 1 and 90 characters.");
    const settings = { ...(await getTreeSettings()), headline: headline.data.headline };
    await saveTreeSettings(settings);
    return Response.json({ settings }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
