import { z } from "zod";
import {
  currentVisitorProfile,
  unlockVisitorHistory,
  visitorHistory,
  endVisitorSession,
  visitorLeafLinked,
  visitorOwner,
  linkVisitorLeaf,
} from "@/server/visitor-history";
import { visitor } from "@/server/auth";
import {
  AppError,
  errorResponse,
  noStore,
  readJson,
  requireSameOrigin,
  verifyCsrfToken,
} from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const credentials = z
  .object({
    action: z.enum(["remember", "signin"]),
    cid: z
      .string()
      .normalize("NFKC")
      .trim()
      .regex(/^\d{11}$/, "Enter your 11-digit CID."),
    pin: z.string().regex(/^\d{6}$/, "Use a private 6-digit PIN."),
    leafId: z.string().uuid().optional(),
    consent: z.boolean().optional(),
  })
  .strict();
export async function GET(request: Request) {
  try {
    const profile = await currentVisitorProfile(request);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .catch(1)
      .parse(new URL(request.url).searchParams.get("page") || 1);
    const linked = profile
      ? await visitorLeafLinked(
          profile,
          new URL(request.url).searchParams.get("leafId") || "",
        )
      : false;
    return Response.json(
      profile
        ? {
            ...(await visitorHistory(profile, page)),
            linked,
          }
        : { authenticated: false, voices: [], total: 0, page: 1, pages: 1 },
      { headers: noStore },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const session = visitor(request);
    verifyCsrfToken(request, session.id);
    const parsed = credentials.safeParse(await readJson(request));
    if (!parsed.success)
      throw new AppError(
        parsed.error.issues[0]?.message || "Check your CID and PIN.",
      );
    const input = parsed.data;
    if (
      input.action === "remember" &&
      (!input.leafId || input.consent !== true)
    )
      throw new AppError(
        "Choose to remember this voice before connecting your CID.",
      );
    const unlockedSession = await unlockVisitorHistory(request, input);
    const headers = new Headers(noStore);
    unlockedSession.cookies.forEach((value: string) =>
      headers.append("Set-Cookie", value),
    );
    return Response.json(await visitorHistory(unlockedSession.profile), {
      headers,
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
    const forget = new URL(request.url).searchParams.get("forget") === "true";
    const headers = new Headers(noStore);
    headers.append("Set-Cookie", await endVisitorSession(request, forget));
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const session = visitor(request);
    verifyCsrfToken(request, session.id);
    const profile = await currentVisitorProfile(request);
    if (!profile)
      throw new AppError("Unlock your history first.", 401, "HISTORY_LOCKED");
    const parsed = z
      .object({ leafId: z.string().uuid(), consent: z.literal(true) })
      .strict()
      .safeParse(await readJson(request));
    if (!parsed.success)
      throw new AppError("Choose a voice to connect to your history.");
    await linkVisitorLeaf(
      profile,
      parsed.data.leafId,
      visitorOwner(visitor(request).id),
    );
    return Response.json({ ok: true, linked: true }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
