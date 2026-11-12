import { z } from "zod";
import { themes } from "@/lib/catalog";
import { currentReflection, saveReflection, asyncRevision } from "@/server/db";
import {
  AppError,
  readJson,
  requireSameOrigin,
  verifyCsrfToken,
  errorResponse,
  noStore,
  ipFromRequest,
} from "@/server/http";
import { visitor } from "@/server/auth";
import { consumeRate } from "@/server/db";
import { generateTreeReflection, generateTreeReflectionAI } from "@/server/services/tree-reflection-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reflectionSchema = z.object({
  themeCounts: z.record(z.string(), z.number().nonnegative()),
  audienceDescription: z.string().min(1, "Audience description is required."),
  hasDemoLeaves: z.boolean().default(false),
  totalLeaves: z.number().nonnegative().default(0),
  save: z.boolean().default(false),
});

export async function GET() {
  return Response.json(
    { reflection: await currentReflection() },
    { headers: noStore },
  );
}

export async function POST(request: Request): Promise<Response> {
  const session = visitor(request);
  const respond = (
    body: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ) =>
    Response.json(body, {
      status,
      headers: {
        ...noStore,
        ...(session.cookie ? { "Set-Cookie": session.cookie } : {}),
        ...headers,
      },
    });

  try {
    requireSameOrigin(request);
    verifyCsrfToken(request, session.id);

    // Per-IP rate limit for reflection generation
    const ip = ipFromRequest(request);
    const aiRate = await consumeRate(
      "ai:reflection:" + ip,
      Number(process.env.AI_RATE_LIMIT) || 30,
      60000,
    );
    if (!aiRate.allowed) {
      throw new AppError(
        "AI provider busy. Please try again shortly.",
        429,
        "AI_RATE_LIMITED",
        { "Retry-After": String(aiRate.retryAfter) },
      );
    }

    const result = reflectionSchema.safeParse(await readJson(request));
    if (!result.success) {
      throw new AppError(
        result.error.issues[0]?.message ||
          "Please check your input and try again.",
      );
    }

    const { themeCounts, audienceDescription, hasDemoLeaves, totalLeaves, save } =
      result.data;

    // Validate theme IDs
    const validThemes = [
      "nature",
      "innovation",
      "education",
      "community",
      "wellbeing",
      "culture",
    ];
    for (const themeId of Object.keys(themeCounts)) {
      if (!validThemes.includes(themeId)) {
        throw new AppError(
          `Unknown theme: ${themeId}.`,
          400,
          "INVALID_THEME",
        );
      }
    }

    const output = await generateTreeReflectionAI({
      themeCounts: themeCounts as Record<typeof themes[number]["id"], number>,
      audienceDescription,
      hasDemoLeaves,
      totalLeaves,
    });

    if (save) {
      const rev = await asyncRevision();
      await saveReflection(
        { body: output.reflection, mode: "offline", created_at: new Date().toISOString() },
        rev,
      );
    }

    return respond(output, 200);
  } catch (error) {
    const response = errorResponse(error);
    if (session.cookie) response.headers.set("Set-Cookie", session.cookie);
    return response;
  }
}
