import { createHash, randomUUID } from "node:crypto";
import { contributionSchema, type ContributionInput } from "@/lib/schemas";
import {
  getByKey,
  insertLeaf,
  consumeRate,
  recordMetric,
  getTreeSettings,
  recordSubmission,
  rejectedSubmission,
  replyByKey,
} from "@/server/db";
import {
  createLeaf,
  offlineReply,
  refreshReflection,
} from "@/server/services/ai";
import { visitor } from "@/server/auth";
import {
  currentVisitorProfile,
  linkVisitorLeaf,
  visitorOwner,
} from "@/server/visitor-history";
import {
  AppError,
  readJson,
  requireSameOrigin,
  verifyCsrfToken,
  errorResponse,
  noStore,
} from "@/server/http";
import { after } from "next/server";
import type { ContributionReceipt } from "@/lib/catalog";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const globalFlights = globalThis as unknown as {
  gmcFlights?: Map<
    string,
    { hash: string; promise: Promise<ContributionReceipt> }
  >;
};
const flights = (globalFlights.gmcFlights ??= new Map());
async function processLeaf(
  input: ContributionInput,
  hash: string,
  owner: string,
  profile: string | null,
) {
  const aiRate = await consumeRate(
    "ai:provider",
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
  const { visitor_reply, ...generated } = await createLeaf(
    input.aspiration,
    input.theme,
  );
  const record = await insertLeaf(
    input.idempotencyKey,
    hash,
    {
      ...generated,
      id: randomUUID(),
      created_at: new Date().toISOString(),
      is_demo: false,
    },
    {
      ...input,
      reply: visitor_reply,
      owner_key: owner,
    },
  );
  if (!record) throw new AppError("Failed to insert leaf.", 500);
  if (record.status !== "approved")
    throw new AppError("This leaf has been removed from the public tree.", 410);
  if (profile) await linkVisitorLeaf(profile, record.leaf.id, owner);
  return {
    leaf: record.leaf,
    reply: (await replyByKey(input.idempotencyKey)) || visitor_reply,
    reply_mode: record.leaf.mode,
    mode: record.leaf.mode,
  };
}
export async function POST(request: Request) {
  let historyInput: ContributionInput | undefined;
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
    const result = contributionSchema.safeParse(await readJson(request));
    if (!result.success)
      throw new AppError(
        result.error.issues[0]?.message ||
          "Please check your message and consent.",
      );
    const input = result.data,
      hash = createHash("sha256")
        .update(
          JSON.stringify({ aspiration: input.aspiration, theme: input.theme }),
        )
        .digest("hex");
    const existing = await getByKey(input.idempotencyKey);
    if (existing) {
      if (existing.hash && existing.hash !== hash)
        throw new AppError(
          "This submission key was already used. Start a new hope.",
          409,
          "KEY_CONFLICT",
        );
      if (existing.status !== "approved")
        throw new AppError(
          "This leaf has been removed from the public tree.",
          410,
        );
      const savedReply = await replyByKey(input.idempotencyKey);
      return respond({
        leaf: existing.leaf,
        reply:
          savedReply ||
          offlineReply(input.aspiration, existing.leaf.category),
        reply_mode: savedReply ? existing.leaf.mode : "offline",
        mode: existing.leaf.mode,
      });
    }
    const inflight = flights.get(input.idempotencyKey);
    if (inflight) {
      if (inflight.hash !== hash)
        throw new AppError(
          "This submission key is processing another hope.",
          409,
          "KEY_CONFLICT",
        );
      return respond(await inflight.promise);
    }
    const rejected = await rejectedSubmission(input.idempotencyKey);
    if (rejected)
      throw new AppError(
        "This hope needs a revision. Edit your message before submitting again.",
        422,
        "MODERATION_REJECTED",
      );
    if (!(await getTreeSettings()).acceptingContributions)
      throw new AppError(
        "The tree is taking a short rest. Your hope is kept on this phone; please try again shortly.",
        503,
        "TREE_PAUSED",
      );
    const globalRate = await consumeRate(
      "submissions:global",
      Number(process.env.GLOBAL_RATE_LIMIT) || 60,
      60000,
    );
    const deviceRate = await consumeRate(
      `submissions:${session.id}`,
      Number(process.env.SUBMISSION_RATE_LIMIT) || 5,
      600000,
    );
    if (!globalRate.allowed || !deviceRate.allowed) {
      const retryAfter = !globalRate.allowed
        ? globalRate.retryAfter
        : deviceRate.retryAfter;
      return respond(
        {
          error:
            "The tree needs a short pause. Please try again in a little while.",
          code: "RATE_LIMITED",
          retryAfter,
        },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }
    historyInput = input;
    const promise = processLeaf(
      input,
      hash,
      visitorOwner(session.id),
      await currentVisitorProfile(request),
    );
    flights.set(input.idempotencyKey, { hash, promise });
    try {
      const receipt = await promise;
      after(async () => {
        await refreshReflection();
      });
      return respond(receipt, 201);
    } finally {
      flights.delete(input.idempotencyKey);
    }
  } catch (error) {
    if (error instanceof AppError && error.code === "MODERATION_REJECTED") {
      recordMetric("rejected");
      if (historyInput)
        recordSubmission(
          { ...historyInput, owner_key: visitorOwner(session.id) },
          "rejected",
          undefined,
          error.message,
        );
    }
    const response = errorResponse(error);
    if (session.cookie) response.headers.set("Set-Cookie", session.cookie);
    return response;
  }
}
