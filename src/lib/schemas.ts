import { z } from "zod";
export const themeSchema = z.enum([
  "nature",
  "innovation",
  "education",
  "community",
  "wellbeing",
  "culture",
]);
export const contributionSchema = z.object({
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
  theme: themeSchema,
  consent: z.literal(true),
  idempotencyKey: z.string().uuid(),
  visitor_type: z.enum(["first", "returning"]).default("first"),
});
export const aiLeafSchema = z.object({
  safe: z.boolean(),
  category: themeSchema,
  leaf_message: z.string().trim().min(1).max(100),
  visitor_reply: z.string().trim().min(20).max(360),
  chamber_id: z.number().int().min(1).max(4),
  confidence: z.number().min(0).max(1),
  moderation_flags: z.array(z.string().max(80)).max(10),
});
export type ContributionInput = z.infer<typeof contributionSchema>;

export const leafAgentSchema = z.object({
  safe: z.boolean(),
  category: themeSchema,
  leaf_message: z.string().trim().min(1).max(100),
  visitor_reply: z.string().trim().min(20).max(360),
  chamber_id: z.number().int().min(1).max(4),
  confidence: z.number().min(0).max(1),
  moderation_flags: z.array(z.string().max(80)).max(10),
});
export type LeafAgentOutput = z.infer<typeof leafAgentSchema>;
