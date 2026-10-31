import { z } from "zod";

/** Provider-neutral chat contract. There is deliberately no tool executor in PR A. */
const text = z.string().max(16_000);
const toolName = z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/);
const argumentsObject = z.record(z.string(), z.unknown());
export const toolCall = z
  .object({
    id: z.string().min(1).max(128),
    name: toolName,
    arguments: argumentsObject,
  })
  .strict();
export const message = z.discriminatedUnion("role", [
  z.object({ role: z.literal("system"), content: text }).strict(),
  z.object({ role: z.literal("user"), content: text }).strict(),
  z
    .object({
      role: z.literal("assistant"),
      content: text.nullable(),
      toolCalls: z.array(toolCall).max(8).default([]),
    })
    .strict(),
  z
    .object({
      role: z.literal("tool"),
      toolCallId: z.string().min(1).max(128),
      content: text,
    })
    .strict(),
]);
export const toolDefinition = z
  .object({
    name: toolName,
    description: z.string().min(1).max(1_000),
    parameters: argumentsObject.refine(
      (v) => v["type"] === "object",
      "Object JSON Schema required"
    ),
  })
  .strict();
export const inferenceRequest = z
  .object({
    messages: z.array(message).min(1).max(48),
    tools: z.array(toolDefinition).max(8).default([]),
    capability: z.enum(["text", "tools"]).default("text"),
    // Opt-in only: existing Ember tool calls remain unchanged.
    responseFormat: z
      .union([
        z.object({ type: z.literal("json_object") }).strict(),
        z
          .object({
            type: z.literal("json_schema"),
            json_schema: z.record(z.string(), z.unknown()),
          })
          .strict(),
      ])
      .optional(),
    maxOutputTokens: z.number().int().min(1).max(4096).default(512),
    temperature: z.number().min(0).max(1).default(0.2),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.capability === "tools" && value.responseFormat)
      ctx.addIssue({
        code: "custom",
        path: ["responseFormat"],
        message: "Structured text output cannot accompany tool calls",
      });
    if (value.capability === "tools" && !value.tools.length)
      ctx.addIssue({
        code: "custom",
        path: ["tools"],
        message: "Tools capability requires definitions",
      });
    if (value.capability !== "tools" && value.tools.length)
      ctx.addIssue({
        code: "custom",
        path: ["capability"],
        message: "Tool definitions require tools capability",
      });
    if (new Set(value.tools.map((t) => t.name)).size !== value.tools.length)
      ctx.addIssue({ code: "custom", path: ["tools"], message: "Duplicate tool name" });
    if (JSON.stringify(value).length > 120_000)
      ctx.addIssue({ code: "custom", message: "Request exceeds bounded size" });
  });
export type InferenceRequest = z.infer<typeof inferenceRequest>;
export type InferenceMessage = z.infer<typeof message>;
export type ToolCall = z.infer<typeof toolCall>;
export type ProviderId = "nvidia" | "cloudflare";
export type InferenceResult = {
  provider: ProviderId;
  model: string;
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: "stop" | "tool_calls" | "length" | "content_filter";
  usage: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
};
export type ProviderModel = {
  provider: ProviderId;
  model: string;
  supportsTools: boolean;
  key: string;
  accountId?: string;
};
export type ProviderAdapter = (
  model: ProviderModel,
  input: InferenceRequest,
  options?: {
    request?: typeof fetch;
    signal?: AbortSignal;
  }
) => Promise<InferenceResult>;
export type FailureCode =
  | "disabled"
  | "not_configured"
  | "unsupported_capability"
  | "invalid_request"
  | "authentication"
  | "quota_exhausted"
  | "rate_limited"
  | "provider_unavailable"
  | "provider_error"
  | "invalid_response"
  | "timeout"
  | "cancelled";
export class IntelligenceError extends Error {
  constructor(
    readonly code: FailureCode,
    readonly httpStatus?: number,
    /** Operator-facing diagnostic only (never shown to end users, never a secret). */
    readonly reason?: string
  ) {
    super(code);
    this.name = "IntelligenceError";
  }
}
