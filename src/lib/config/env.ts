/**
 * Environment configuration with validation.
 * Fails fast at startup if required variables are missing.
 */
import { z } from "zod";

const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().default("./data/menuminute.sqlite"),
  AUTH_SECRET: z
    .string()
    .min(16, "AUTH_SECRET must be at least 16 characters")
    .default("dev-secret-change-in-production-use-openssl-rand-base64-32"),

  // AI Integrations (optional)
  GEMINI_API_KEY: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(),

  // Cloudflare (optional)
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default("menuminute-media"),
  R2_ENDPOINT: z.string().optional(),

  // Pexels (optional)
  PEXELS_API_KEY: z.string().optional(),

  // Feature Flags
  AI_FEATURES_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  IMAGE_GENERATION_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment configuration:\n", result.error.flatten().fieldErrors);
    // In production, refuse to start
    if (process.env["NODE_ENV"] === "production") {
      process.exit(1);
    }
  }

  return result.success ? result.data : envSchema.parse(process.env);
}

// Parse once — will throw if required fields are missing
export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
