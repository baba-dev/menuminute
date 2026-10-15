import { z } from "zod";
const pgUrl = z
  .string()
  .url()
  .refine((v) => /^postgres(ql)?:\/\//.test(v), "PostgreSQL URL required");
const redisUrl = z
  .string()
  .url()
  .refine((v) => /^rediss?:\/\//.test(v), "Redis URL required");
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url(),
    DATABASE_URL: pgUrl,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
    AUTH_SECRET: z.string().min(32),
    REDIS_QUEUE_URL: redisUrl,
    REDIS_CACHE_URL: redisUrl,
    GEMINI_API_KEY: z.string().optional(),
    NVIDIA_API_KEY: z.string().optional(),
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    CLOUDFLARE_API_TOKEN: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z.string().default("menuminute-media"),
    R2_ENDPOINT: z.string().optional(),
    PEXELS_API_KEY: z.string().optional(),
    AI_FEATURES_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    IMAGE_GENERATION_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  })
  .superRefine((e, ctx) => {
    if (e.REDIS_QUEUE_URL === e.REDIS_CACHE_URL)
      ctx.addIssue({
        code: "custom",
        path: ["REDIS_CACHE_URL"],
        message: "Separate queue/cache instances required",
      });
    if (e.NODE_ENV === "production") {
      if (new URL(e.APP_URL).protocol !== "https:")
        ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "Production HTTPS required" });
      if (/secret|change|example|test|development|placeholder/i.test(e.AUTH_SECRET))
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_SECRET"],
          message: "Generate a unique production secret",
        });
    }
  });
export function parseEnv(input: Record<string, unknown>) {
  const result = envSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid configuration: ${[...new Set(result.error.issues.map((i) => i.path.join(".")))].join(", ")}`
    );
  return result.data;
}
export const env = parseEnv(process.env);
export type Env = z.infer<typeof envSchema>;
