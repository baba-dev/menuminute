import { z } from "zod";
const pgUrl = z
  .string()
  .url()
  .refine((v) => /^postgres(ql)?:\/\//.test(v), "PostgreSQL URL required");
const redisUrl = z
  .string()
  .url()
  .refine((v) => /^rediss?:\/\//.test(v), "Redis URL required");
const strictBoolean = z.enum(["true", "false"]).transform((v) => v === "true");
const smtpHostname = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      value === "localhost" ||
      (/^(?=.{1,253}$)(?!.*\.\.)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
        value
      ) &&
        !/^\d+(?:\.\d+){3}$/.test(value)),
    "SMTP hostname required"
  );
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url(),
    DATABASE_URL: pgUrl,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
    AUTH_SECRET: z.string().min(32),
    EMAIL_PROVIDER: z.enum(["smtp", "resend", "test"]).default("test"),
    EMAIL_FROM: z.string().trim().email().optional(),
    RESEND_API_KEY: z.string().trim().min(1).optional(),
    SMTP_HOST: smtpHostname.optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
    SMTP_SECURE: strictBoolean.optional(),
    SMTP_USER: z.string().trim().min(1).optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    AUTH_ALLOW_TEST_EMAIL: strictBoolean.default(false),
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
    AI_FEATURES_ENABLED: strictBoolean.default(false),
    IMAGE_GENERATION_ENABLED: strictBoolean.default(false),
    // Ember provider hub: independent activation from the existing review-only import engine.
    AI_ORCHESTRATOR_ENABLED: strictBoolean.default(false),
    AI_NVIDIA_ENABLED: strictBoolean.default(false),
    AI_NVIDIA_COMMERCIAL_APPROVED: strictBoolean.default(false),
    AI_NVIDIA_MODEL: z.string().max(128).optional(),
    AI_NVIDIA_TOOLS_VERIFIED: strictBoolean.default(false),
    AI_CLOUDFLARE_ENABLED: strictBoolean.default(false),
    AI_CLOUDFLARE_MODEL: z.string().max(128).optional(),
    AI_CLOUDFLARE_TOOLS_VERIFIED: strictBoolean.default(false),
  })
  .superRefine((e, ctx) => {
    if (e.AI_ORCHESTRATOR_ENABLED) {
      if (!e.AI_FEATURES_ENABLED)
        ctx.addIssue({
          code: "custom",
          path: ["AI_FEATURES_ENABLED"],
          message: "AI master flag required",
        });
      if (!e.AI_NVIDIA_ENABLED && !e.AI_CLOUDFLARE_ENABLED)
        ctx.addIssue({
          code: "custom",
          path: ["AI_ORCHESTRATOR_ENABLED"],
          message: "Enable an approved provider",
        });
      if (
        e.AI_NVIDIA_ENABLED &&
        (!e.AI_NVIDIA_COMMERCIAL_APPROVED ||
          !e.NVIDIA_API_KEY ||
          !e.AI_NVIDIA_MODEL ||
          !/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i.test(e.AI_NVIDIA_MODEL))
      )
        ctx.addIssue({
          code: "custom",
          path: ["AI_NVIDIA_MODEL"],
          message: "Approved NVIDIA model, key and commercial entitlement required",
        });
      if (
        e.AI_CLOUDFLARE_ENABLED &&
        (!e.CLOUDFLARE_ACCOUNT_ID ||
          !/^[a-f0-9]{32}$/i.test(e.CLOUDFLARE_ACCOUNT_ID) ||
          !e.CLOUDFLARE_API_TOKEN ||
          !e.AI_CLOUDFLARE_MODEL ||
          !/^@cf\/[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i.test(e.AI_CLOUDFLARE_MODEL))
      )
        ctx.addIssue({
          code: "custom",
          path: ["AI_CLOUDFLARE_MODEL"],
          message: "Configured Cloudflare Workers AI model/account/token required",
        });
    }
    if (e.REDIS_QUEUE_URL === e.REDIS_CACHE_URL)
      ctx.addIssue({
        code: "custom",
        path: ["REDIS_CACHE_URL"],
        message: "Separate queue/cache instances required",
      });
    if (
      e.EMAIL_PROVIDER === "test" &&
      (!e.AUTH_ALLOW_TEST_EMAIL ||
        new URL(e.APP_URL).hostname !== "localhost" ||
        new URL(e.DATABASE_URL).pathname !== "/menuminute_test")
    )
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_PROVIDER"],
        message: "Test mail requires explicit isolated localhost opt-in",
      });
    if (e.EMAIL_PROVIDER === "smtp") {
      const required = [
        ["EMAIL_FROM", e.EMAIL_FROM],
        ["SMTP_HOST", e.SMTP_HOST],
        ["SMTP_PORT", e.SMTP_PORT],
        ["SMTP_SECURE", e.SMTP_SECURE],
        ["SMTP_USER", e.SMTP_USER],
        ["SMTP_PASSWORD", e.SMTP_PASSWORD],
      ] as const;
      for (const [name, value] of required) {
        if (value === undefined)
          ctx.addIssue({ code: "custom", path: [name], message: `${name} is required for SMTP` });
      }
    }
    if (e.EMAIL_PROVIDER === "resend" && (!e.RESEND_API_KEY || !e.EMAIL_FROM))
      ctx.addIssue({
        code: "custom",
        path: [!e.EMAIL_FROM ? "EMAIL_FROM" : "RESEND_API_KEY"],
        message: "Resend credentials and verified sender are required",
      });
    if (e.NODE_ENV === "production") {
      if (e.EMAIL_PROVIDER === "test")
        ctx.addIssue({
          code: "custom",
          path: ["EMAIL_PROVIDER"],
          message: "Production email delivery is required",
        });
      if (e.EMAIL_PROVIDER === "smtp" && e.SMTP_SECURE !== true)
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_SECURE"],
          message: "Production SMTP requires implicit TLS",
        });
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
