import { z } from "zod";
import { interpretLeaf, type LeafAgentOutput } from "@/server/services/leaf-agent";
import {
  AppError,
  readJson,
  requireSameOrigin,
  verifyCsrfToken,
  errorResponse,
  noStore,
  ipFromRequest,
} from "@/server/http";
import { consumeRate } from "@/server/db";
import { visitor } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const interpretSchema = z.object({
  aspiration: z
    .string()
    .normalize("NFKC")
    .trim()
    .min(3, "Write at least 3 characters.")
    .max(200, "Keep your hope within 200 characters.")
    .refine(
      (value) =>
        !/[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/.test(value),
      "Please remove hidden or control characters.",
    ),
  themeHint: z
    .enum(["nature", "innovation", "education", "community", "wellbeing", "culture"])
    .optional(),
});

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

    // Per-IP rate limit for interpretation
    const ip = ipFromRequest(request);
    const aiRate = await consumeRate(
      "ai:interpret:" + ip,
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

    const result = interpretSchema.safeParse(await readJson(request));
    if (!result.success) {
      throw new AppError(
        result.error.issues[0]?.message ||
          "Please check your message and try again.",
      );
    }

    const { aspiration, themeHint } = result.data;
    const output = await interpretLeaf(aspiration, themeHint);

    return respond(output, 200);
  } catch (error) {
    const response = errorResponse(error);
    if (session.cookie) response.headers.set("Set-Cookie", session.cookie);
    return response;
  }
}
