"use server";

import { themes, themeFor, type Theme } from "@/lib/catalog";
import { checkText } from "./moderation";
import { aiMode, aiModel, providerBase } from "./ai";
import { AppError } from "@/server/http";

interface TreeReflectionOptions {
  themeCounts: Record<Theme, number>;
  audienceDescription: string;
  hasDemoLeaves: boolean;
  totalLeaves: number;
}

interface TreeReflectionOutput {
  reflection: string;
}

const TREE_REFLECTION_AGENT_INSTRUCTIONS = `You are the Tree Reflection Agent for the Living Tree of GMC (Gelephu Mindfulness City).

Your only job is to write one warm, neutral, and truthful sentence (maximum 220 characters) that summarizes the current hopes expressed on the tree.

Rules you must always follow:
- Use the exact audience description provided.
- If demo / demonstration leaves are present, you must clearly say so.
- This is NOT a representative survey of the public — treat it only as the hopes of the people who participated.
- Never make official claims, promises, projections, or policy statements.
- Never invent themes that are not in the supplied counts.
- Never use hype, marketing language, or emotional exaggeration.
- Keep the tone warm, calm, and respectful.
- Output plain text only — no JSON, no markdown, no quotes, no extra sentences.

Agentic process:
1. Read the audience description carefully.
2. Look at the theme counts and identify the top 1–2 themes.
3. Decide whether demo leaves are included and how to mention them.
4. Draft one clear, natural sentence that accurately reflects the data.
5. Check the character limit (≤ 220) and tone.
6. Output only the final sentence.

Style guide:
- Prefer calm observations over strong claims.
- Example good style: “Among these participating visitors, hopes for nature and community appear most often.”
- Example when demos are present: “Across visitor hopes and labelled demonstration leaves, education and wellbeing are recurring themes.”`;

/**
 * Generate a tree reflection sentence from theme counts and audience description.
 * Rule-based fallback that works without an AI provider.
 */
export async function generateTreeReflection(
  options: TreeReflectionOptions,
): Promise<TreeReflectionOutput> {
  const { themeCounts, audienceDescription, hasDemoLeaves, totalLeaves } =
    options;

  // Step 1: Read the audience description
  const audience = audienceDescription.trim();

  // Step 2: Identify top 1–2 themes by count
  const sortedThemes = Object.entries(themeCounts)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  const topTheme = sortedThemes[0]?.[0] as Theme | undefined;
  const secondTheme = sortedThemes[1]?.[0] as Theme | undefined;

  // Step 3: Decide how to mention demo leaves
  const demoSuffix = hasDemoLeaves
    ? " and labelled demonstration leaves"
    : "";

  // Step 4: Draft the sentence
  let reflection: string;

  if (!topTheme || totalLeaves === 0) {
    reflection = `Among ${audience}, no hopes have been shared yet.`;
  } else if (
    secondTheme &&
    themeCounts[secondTheme] > 0 &&
    themeCounts[secondTheme] === themeCounts[topTheme]
  ) {
    // Tie between top themes
    reflection = `Among ${audience}, hopes for ${themeFor(topTheme).label.toLowerCase()} and ${themeFor(secondTheme).label.toLowerCase()} appear most often${demoSuffix}.`;
  } else if (topTheme) {
    reflection = `Among ${audience}, hopes for ${themeFor(topTheme).label.toLowerCase()} appear most often${demoSuffix}.`;
  } else {
    reflection = `Among ${audience}, visitor hopes are taking root${demoSuffix}.`;
  }

  // Step 5: Check character limit
  if (reflection.length > 220) {
    // Fallback: shorter version
    if (topTheme) {
      reflection = `Among ${audience}, hopes for ${themeFor(topTheme).label.toLowerCase()} appear most often${demoSuffix}.`;
    } else {
      reflection = `Among ${audience}, visitor hopes are taking root${demoSuffix}.`;
    }
  }

  // Final self-check: ensure plain text, no quotes, single sentence
  const cleaned = reflection
    .replace(/^["']|["']$/g, "")
    .replace(/\n/g, " ")
    .trim();

  return { reflection: cleaned };
}

/**
 * AI-assisted tree reflection generation.
 * Uses the configured AI provider when available, falls back to rule-based generation.
 */
export async function generateTreeReflectionAI(
  options: TreeReflectionOptions,
): Promise<TreeReflectionOutput> {
  const { themeCounts, audienceDescription, hasDemoLeaves, totalLeaves } =
    options;

  // Build theme count summary for the prompt
  const themeLines = Object.entries(themeCounts)
    .filter(([, count]) => count > 0)
    .map(([themeId, count]) => `  - ${themeFor(themeId as Theme).label}: ${count}`)
    .join("\n") || "  (no hopes yet)";

  const prompt = `You are the Tree Reflection Agent for the Living Tree of GMC (Gelephu Mindfulness City).

Your only job is to write one warm, neutral, and truthful sentence (maximum 220 characters) that summarizes the current hopes expressed on the tree.

Rules:
- Use the exact audience description provided.
- If demo / demonstration leaves are present, you must clearly say so.
- This is NOT a representative survey of the public — treat it only as the hopes of the people who participated.
- Never make official claims, promises, projections, or policy statements.
- Never invent themes that are not in the supplied counts.
- Never use hype, marketing language, or emotional exaggeration.
- Keep the tone warm, calm, and respectful.
- Output plain text only — no JSON, no markdown, no quotes, no extra sentences.

Audience description: ${audienceDescription}

Theme counts from participating visitors:
${themeLines}

Demo leaves included: ${hasDemoLeaves ? "yes" : "no"}
Total leaves: ${totalLeaves}

Write exactly one sentence (≤220 characters) summarizing these hopes.`;

  const mode =
    process.env.AI_MODE !== "offline" && Boolean(process.env.OPENAI_API_KEY)
      ? "openai"
      : "offline";

  if (mode === "openai") {
    try {
      const response = await fetch(`${providerBase()}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: aiModel(),
          messages: [
            { role: "system", content: TREE_REFLECTION_AGENT_INSTRUCTIONS },
            { role: "user", content: prompt },
          ],
          temperature: 0.5,
          max_tokens: 250,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();

        if (content && content.length <= 220) {
          return { reflection: content };
        }
      }
    } catch {
      // Fall through to rule-based
    }
  }

  return generateTreeReflection(options);
}
