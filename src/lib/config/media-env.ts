import path from "node:path";
import { z } from "zod";

export const mediaEnvShape = {
  MEDIA_STORAGE: z.enum(["local", "r2"]),
  MEDIA_ROOT: z.string().optional(),
  MEDIA_OUTLET_BUDGET_BYTES: z.coerce
    .number()
    .int()
    .min(5 * 1024 * 1024)
    .default(100 * 1024 * 1024),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).max(63).default("menuminute-media"),
  R2_ENDPOINT: z.string().url().optional(),
} as const;

export type MediaEnvInput = {
  MEDIA_STORAGE: "local" | "r2";
  MEDIA_ROOT?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_ENDPOINT?: string;
};

export function validateMediaEnv(value: MediaEnvInput, ctx: z.RefinementCtx) {
  if (value.MEDIA_STORAGE === "local") {
    if (!value.MEDIA_ROOT || !path.isAbsolute(value.MEDIA_ROOT)) {
      ctx.addIssue({
        code: "custom",
        path: ["MEDIA_ROOT"],
        message: "Local media storage requires an absolute root",
      });
    }
    return;
  }

  for (const key of ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const) {
    if (!value[key]) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "R2 media storage requires this value",
      });
    }
  }

  if (value.R2_ENDPOINT) {
    const endpoint = new URL(value.R2_ENDPOINT);
    if (
      endpoint.protocol !== "https:" ||
      !endpoint.hostname.endsWith(".r2.cloudflarestorage.com") ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.pathname !== "/"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["R2_ENDPOINT"],
        message: "Use a canonical Cloudflare R2 account HTTPS endpoint",
      });
    }
  }
}

export const mediaEnvSchema = z.object(mediaEnvShape).superRefine(validateMediaEnv);

export function parseMediaEnv(input: Record<string, unknown>) {
  const result = mediaEnvSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid media configuration: ${[
        ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
      ].join(", ")}`
    );
  }
  return result.data;
}

export const mediaEnv = parseMediaEnv(process.env);
export type MediaEnv = z.infer<typeof mediaEnvSchema>;
