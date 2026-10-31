import { z } from "zod";
import { mediaEnvShape, validateMediaEnv } from "./media-env";
const pgUrl = z
  .string()
  .url()
  .refine((v) => /^postgres(ql)?:\/\//.test(v), "PostgreSQL URL required");
const redisUrl = z
  .string()
  .url()
  .refine((v) => /^rediss?:\/\//.test(v), "Redis URL required");
const strictBoolean = z.enum(["true", "false"]).transform((v) => v === "true");
const rolloutOutletIds = z
  .string()
  .max(6_500)
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  )
  .pipe(
    z
      .array(z.string().regex(/^[A-Za-z0-9_-]{1,128}$/))
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, "Outlet IDs must be unique")
  );
const smtpHostname = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      value === "localhost" ||
      value === "127.0.0.1" ||
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
    ORDER_EDGE_SHARED_SECRET: z.string().min(32).optional(),
    AUTH_ALLOW_TEST_EMAIL: strictBoolean.default(false),
    REDIS_QUEUE_URL: redisUrl,
    REDIS_CACHE_URL: redisUrl,
    PUBLIC_MEDIA_RATE_LIMIT_MAX: z.coerce.number().int().min(30).max(10_000).default(180),
    PUBLIC_MEDIA_RATE_LIMIT_GLOBAL_MAX: z.coerce
      .number()
      .int()
      .min(1000)
      .max(1_000_000)
      .default(12000),
    PUBLIC_MEDIA_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),
    ...mediaEnvShape,
    GEMINI_API_KEY: z.string().optional(),
    NVIDIA_API_KEY: z.string().optional(),
    CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
    CLOUDFLARE_API_TOKEN: z.string().optional(),
    PEXELS_API_KEY: z.string().optional(),
    AI_FEATURES_ENABLED: strictBoolean.default(false),
    IMAGE_GENERATION_ENABLED: strictBoolean.default(false),
    // Operational PWA phases F-G: both the master switch and the exact outlet allowlist are
    // required. This remains independent from POS/Kitchen product activation and permissions.
    PWA_OPERATIONAL_ENABLED: strictBoolean.default(false),
    PWA_OPERATIONAL_OUTLET_IDS: rolloutOutletIds,
    // H: opt-in push is independent of the guest offline and POS/Kitchen flags.
    PWA_PUSH_ENABLED: strictBoolean.default(false),
    PWA_PUSH_OUTLET_IDS: rolloutOutletIds,
    PWA_PUSH_VAPID_PUBLIC_KEY: z
      .string()
      .regex(/^[A-Za-z0-9_-]{87}$/)
      .optional(),
    PWA_PUSH_VAPID_PRIVATE_KEY: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .optional(),
    PWA_PUSH_VAPID_SUBJECT: z
      .string()
      .regex(/^mailto:[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/)
      .optional(),
    // Ember provider hub: independent activation from the existing review-only import engine.
    AI_ORCHESTRATOR_ENABLED: strictBoolean.default(false),
    AI_ASSISTANT_READ_ONLY_ENABLED: strictBoolean.default(false),
    AI_ASSISTANT_ACTIONS_ENABLED: strictBoolean.default(false),
    AI_NVIDIA_ENABLED: strictBoolean.default(false),
    AI_NVIDIA_COMMERCIAL_APPROVED: strictBoolean.default(false),
    AI_NVIDIA_MODEL: z.string().max(128).optional(),
    AI_NVIDIA_TOOLS_VERIFIED: strictBoolean.default(false),
    AI_CLOUDFLARE_ENABLED: strictBoolean.default(false),
    AI_CLOUDFLARE_MODEL: z.string().max(128).optional(),
    AI_CLOUDFLARE_TOOLS_VERIFIED: strictBoolean.default(false),
    // Operator-approved exact-model pricing in micro-USD per million tokens.
    // No defaults: Ember refuses inference until these rates and ceilings are set.
    AI_EMBER_NVIDIA_INPUT_MICROUSD_MTOK: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000_000)
      .optional(),
    AI_EMBER_NVIDIA_OUTPUT_MICROUSD_MTOK: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000_000)
      .optional(),
    AI_EMBER_NVIDIA_DAILY_CAP_MICROUSD: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000_000)
      .optional(),
    AI_EMBER_CLOUDFLARE_INPUT_MICROUSD_MTOK: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000_000)
      .optional(),
    AI_EMBER_CLOUDFLARE_OUTPUT_MICROUSD_MTOK: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000_000)
      .optional(),
    AI_EMBER_CLOUDFLARE_DAILY_CAP_MICROUSD: z.coerce
      .number()
      .int()
      .min(1)
      .max(1_000_000_000)
      .optional(),
    POS_STRIPE_ENABLED: strictBoolean.default(false),
    POS_STRIPE_SECRET_KEY: z
      .string()
      .trim()
      .regex(/^sk_(?:test|live)_[A-Za-z0-9]+$/)
      .optional(),
    POS_STRIPE_WEBHOOK_SECRET: z
      .string()
      .trim()
      .regex(/^whsec_[A-Za-z0-9]+$/)
      .optional(),
    COMMUNITY_EDITION: strictBoolean.default(false),
    RAZORPAY_ENABLED: strictBoolean.default(false),
    RAZORPAY_KITCHEN_ENABLED: strictBoolean.default(false),
    BILLING_DATABASE_URL: pgUrl.optional(),
    RAZORPAY_KEY_ID: z.string().trim().min(1).optional(),
    RAZORPAY_KEY_SECRET: z.string().trim().min(1).optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().trim().min(1).optional(),
    RAZORPAY_PLAN_ORDERING_ID: z.string().trim().min(1).optional(),
    RAZORPAY_PLAN_KITCHEN_ID: z.string().trim().min(1).optional(),
  })
  .superRefine((e, ctx) => {
    validateMediaEnv(e, ctx);
    if (
      e.PWA_PUSH_ENABLED &&
      (e.PWA_PUSH_OUTLET_IDS.length === 0 ||
        !e.PWA_PUSH_VAPID_PUBLIC_KEY ||
        !e.PWA_PUSH_VAPID_PRIVATE_KEY ||
        !e.PWA_PUSH_VAPID_SUBJECT)
    )
      ctx.addIssue({
        code: "custom",
        path: ["PWA_PUSH_ENABLED"],
        message: "Push requires approved outlet IDs, a P-256 VAPID key pair and contact subject",
      });
    if (e.PWA_OPERATIONAL_ENABLED && e.PWA_OPERATIONAL_OUTLET_IDS.length === 0)
      ctx.addIssue({
        code: "custom",
        path: ["PWA_OPERATIONAL_OUTLET_IDS"],
        message: "Operational PWA rollout requires at least one outlet ID",
      });
    if (e.AI_ASSISTANT_ACTIONS_ENABLED && !e.AI_ASSISTANT_READ_ONLY_ENABLED)
      ctx.addIssue({
        code: "custom",
        path: ["AI_ASSISTANT_ACTIONS_ENABLED"],
        message: "Confirmed actions require enabled read-only Ember",
      });
    if (
      e.AI_ASSISTANT_READ_ONLY_ENABLED &&
      (!e.AI_FEATURES_ENABLED ||
        !e.AI_ORCHESTRATOR_ENABLED ||
        !(
          (e.AI_NVIDIA_ENABLED && e.AI_NVIDIA_TOOLS_VERIFIED) ||
          (e.AI_CLOUDFLARE_ENABLED && e.AI_CLOUDFLARE_TOOLS_VERIFIED)
        ))
    )
      ctx.addIssue({
        code: "custom",
        path: ["AI_ASSISTANT_READ_ONLY_ENABLED"],
        message: "Ember requires the master flags and an enabled, verified tool-capable provider",
      });
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
    if (e.POS_STRIPE_ENABLED && (!e.POS_STRIPE_SECRET_KEY || !e.POS_STRIPE_WEBHOOK_SECRET))
      ctx.addIssue({
        code: "custom",
        path: [!e.POS_STRIPE_SECRET_KEY ? "POS_STRIPE_SECRET_KEY" : "POS_STRIPE_WEBHOOK_SECRET"],
        message: "Stripe secret and webhook signing secret are required",
      });
    if (
      e.RAZORPAY_ENABLED &&
      (!e.RAZORPAY_KEY_ID ||
        !e.RAZORPAY_KEY_SECRET ||
        !e.RAZORPAY_WEBHOOK_SECRET ||
        !e.RAZORPAY_PLAN_ORDERING_ID ||
        !e.BILLING_DATABASE_URL)
    )
      ctx.addIssue({
        code: "custom",
        path: ["RAZORPAY_ENABLED"],
        message:
          "Billing requires verified provider keys, an ordering plan, and an isolated billing database URL",
      });
    if (e.RAZORPAY_ENABLED && e.BILLING_DATABASE_URL === e.DATABASE_URL)
      ctx.addIssue({
        code: "custom",
        path: ["BILLING_DATABASE_URL"],
        message: "Billing must not reuse the application database identity",
      });
    if (e.RAZORPAY_KITCHEN_ENABLED && (!e.RAZORPAY_ENABLED || !e.RAZORPAY_PLAN_KITCHEN_ID))
      ctx.addIssue({
        code: "custom",
        path: ["RAZORPAY_KITCHEN_ENABLED"],
        message: "Kitchen subscriptions require a verified provider plan and enabled billing",
      });
    if (e.COMMUNITY_EDITION && e.RAZORPAY_ENABLED)
      ctx.addIssue({
        code: "custom",
        path: ["RAZORPAY_ENABLED"],
        message: "Community Edition cannot collect hosted subscriptions",
      });
    if (e.RAZORPAY_KEY_ID && (!e.RAZORPAY_KEY_SECRET || !e.RAZORPAY_WEBHOOK_SECRET))
      ctx.addIssue({
        code: "custom",
        path: [!e.RAZORPAY_KEY_SECRET ? "RAZORPAY_KEY_SECRET" : "RAZORPAY_WEBHOOK_SECRET"],
        message: "Razorpay key secret and webhook secret are required when key ID is configured",
      });
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
      if (
        e.SMTP_HOST === "127.0.0.1" &&
        (!e.AUTH_ALLOW_TEST_EMAIL ||
          new URL(e.APP_URL).hostname !== "localhost" ||
          new URL(e.DATABASE_URL).pathname !== "/menuminute_test")
      )
        ctx.addIssue({
          code: "custom",
          path: ["SMTP_HOST"],
          message: "Loopback SMTP is restricted to the isolated browser fixture",
        });
    }
    if (e.EMAIL_PROVIDER === "resend" && (!e.RESEND_API_KEY || !e.EMAIL_FROM))
      ctx.addIssue({
        code: "custom",
        path: [!e.EMAIL_FROM ? "EMAIL_FROM" : "RESEND_API_KEY"],
        message: "Resend credentials and verified sender are required",
      });
    if (e.NODE_ENV === "production") {
      if (!e.ORDER_EDGE_SHARED_SECRET)
        ctx.addIssue({
          code: "custom",
          path: ["ORDER_EDGE_SHARED_SECRET"],
          message: "Production orders require a trusted reverse-proxy identity secret",
        });
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
