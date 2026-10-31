import { z } from "zod";

export const conciergePreferencesSchema = z.object({
  mode: z.enum(["bite", "single", "feast"]),
  mood: z.enum(["comfort", "bold", "fresh", "indulgent", "adventure", "quick"]),
  guests: z.number().int().min(1).max(12),
  budgetMinor: z.number().int().min(0).max(2147483647),
  diet: z.enum(["all", "vegetarian", "vegan", "gluten_free", "nut_free", "dairy_free"]),
  spice: z.enum(["any", "mild", "medium", "hot"]),
  avoid: z.string().trim().max(120).default(""),
  craving: z.string().trim().max(240).default(""),
  refinement: z.string().trim().max(240).default(""),
}).strict();
export type ConciergePreferences = z.infer<typeof conciergePreferencesSchema>;

export const conciergeRecommendationSchema = z.object({
  title: z.string().trim().min(3).max(100),
  introduction: z.string().trim().max(260),
  items: z.array(z.object({dishId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/), quantity: z.number().int().min(1).max(12)}).strict()).min(1).max(12),
}).strict();
export type ConciergeRecommendation = z.infer<typeof conciergeRecommendationSchema>;

export const conciergeResponseSchema = z.object({
  recommendations: z.array(conciergeRecommendationSchema).max(3),
  source: z.enum(["nvidia", "curated"]),
  fingerprint: z.string().min(1),
  notice: z.string().max(280).nullable(),
}).strict();
export type ConciergeResponse = z.infer<typeof conciergeResponseSchema>;
