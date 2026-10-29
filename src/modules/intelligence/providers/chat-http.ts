import { z } from "zod";
import {
  IntelligenceError,
  type InferenceRequest,
  type InferenceResult,
  type ProviderModel,
  type ToolCall,
} from "../contracts";

/** Same wire format, independent fixed NVIDIA / Cloudflare endpoints. No caller URLs. */
const rawCompletion = z
  .object({
    choices: z
      .array(
        z
          .object({
            finish_reason: z.enum(["stop", "tool_calls", "length", "content_filter"]),
            message: z
              .object({
                content: z.string().max(120_000).nullable(),
                tool_calls: z
                  .array(
                    z
                      .object({
                        id: z.string().min(1).max(128),
                        type: z.literal("function"),
                        function: z
                          .object({
                            name: z.string().min(1).max(64),
                            arguments: z.string().max(32_000),
                          })
                          .passthrough(),
                      })
                      .passthrough()
                  )
                  .max(8)
                  .optional(),
              })
              .passthrough(),
          })
          .passthrough()
      )
      .length(1),
    usage: z
      .object({
        prompt_tokens: z.number().int().nonnegative().nullable().optional(),
        completion_tokens: z.number().int().nonnegative().nullable().optional(),
        total_tokens: z.number().int().nonnegative().nullable().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

function endpoint(model: ProviderModel) {
  if (model.provider === "nvidia") return "https://integrate.api.nvidia.com/v1/chat/completions";
  if (model.provider === "cloudflare" && model.accountId && /^[a-f0-9]{32}$/i.test(model.accountId))
    return (
      "https://api.cloudflare.com/client/v4/accounts/" + model.accountId + "/ai/v1/chat/completions"
    );
  throw new IntelligenceError("not_configured");
}

/** Keep database/domain tool names unchanged; only the provider-facing Cloudflare wire
 * identifier uses an underscore. This is deterministic across both chat rounds. */
function wireToolName(model: ProviderModel, name: string) {
  return model.provider === "cloudflare" ? name.replaceAll(".", "_") : name;
}

function allowedWireTools(model: ProviderModel, input: InferenceRequest) {
  const mapped = new Map<string, string>();
  for (const tool of input.tools) {
    const wire = wireToolName(model, tool.name);
    // Fail before a network call rather than accepting an ambiguous name.
    if (mapped.has(wire)) throw new IntelligenceError("invalid_request");
    mapped.set(wire, tool.name);
  }
  return mapped;
}

function toWireMessage(message: InferenceRequest["messages"][number], model: ProviderModel) {
  if (message.role === "tool")
    return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
  if (message.role === "assistant")
    return {
      role: "assistant",
      // Several Cloudflare Workers AI model schemas reject null assistant content
      // on the follow-up request, even when tool_calls are present. Preserve the
      // OpenAI-compatible null value for NVIDIA; Cloudflare receives an empty string.
      content: model.provider === "cloudflare" && message.content === null ? "" : message.content,
      ...(message.toolCalls.length
        ? {
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: "function",
              function: {
                name: wireToolName(model, call.name),
                arguments: JSON.stringify(call.arguments),
              },
            })),
          }
        : {}),
    };
  return { role: message.role, content: message.content };
}
function translateStatus(status: number): IntelligenceError {
  if (status === 401 || status === 403) return new IntelligenceError("authentication", status);
  if (status === 402) return new IntelligenceError("quota_exhausted", status);
  if (status === 429) return new IntelligenceError("rate_limited", status);
  if (status >= 500) return new IntelligenceError("provider_unavailable", status);
  return new IntelligenceError("provider_error", status);
}
async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new IntelligenceError("invalid_response");
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > 256_000) throw new IntelligenceError("invalid_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > 256_000) {
      await reader.cancel();
      throw new IntelligenceError("invalid_response");
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, position);
    position += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new IntelligenceError("invalid_response");
  }
}
function normalize(raw: unknown, model: ProviderModel, input: InferenceRequest): InferenceResult {
  const parsed = rawCompletion.safeParse(raw);
  if (!parsed.success) throw new IntelligenceError("invalid_response");
  const choice = parsed.data.choices[0]!;
  const calls: ToolCall[] = [];
  const permitted = allowedWireTools(model, input);
  const ids = new Set<string>();
  for (const candidate of choice.message.tool_calls ?? []) {
    if (
      !model.supportsTools ||
      input.capability !== "tools" ||
      !permitted.has(candidate.function.name) ||
      ids.has(candidate.id)
    )
      throw new IntelligenceError("invalid_response");
    ids.add(candidate.id);
    let args: unknown;
    try {
      args = JSON.parse(candidate.function.arguments);
    } catch {
      throw new IntelligenceError("invalid_response");
    }
    if (!args || typeof args !== "object" || Array.isArray(args))
      throw new IntelligenceError("invalid_response");
    calls.push({
      id: candidate.id,
      name: permitted.get(candidate.function.name)!,
      arguments: args as Record<string, unknown>,
    });
  }
  if ((choice.finish_reason === "tool_calls") !== calls.length > 0)
    throw new IntelligenceError("invalid_response");
  if (choice.message.content === null && !calls.length && choice.finish_reason === "stop")
    throw new IntelligenceError("invalid_response");
  const usage = parsed.data.usage;
  return {
    provider: model.provider,
    model: model.model, // Never trust a provider-echoed model identifier.
    content: choice.message.content,
    toolCalls: calls,
    finishReason: choice.finish_reason,
    usage: {
      inputTokens: usage?.prompt_tokens ?? null,
      outputTokens: usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
    },
  };
}
/** Single bounded non-streaming call. Never retries or fails over into a billable request. */
export async function chatCompletion(
  model: ProviderModel,
  input: InferenceRequest,
  options: {
    request?: typeof fetch;
    signal?: AbortSignal;
  } = {}
): Promise<InferenceResult> {
  if (input.capability === "tools" && !model.supportsTools)
    throw new IntelligenceError("unsupported_capability");
  if (options.signal?.aborted) throw new IntelligenceError("cancelled");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    // Detect Cloudflare wire-name collisions before any paid provider call.
    allowedWireTools(model, input);
    const body = JSON.stringify({
      model: model.model,
      stream: false,
      messages: input.messages.map((message) => toWireMessage(message, model)),
      max_tokens: input.maxOutputTokens,
      temperature: input.temperature,
      ...(input.responseFormat
        ? { response_format: input.responseFormat }
        : {}),
      ...(input.capability === "tools"
        ? {
            tools: input.tools.map((tool) => ({
              type: "function",
              function: {
                name: wireToolName(model, tool.name),
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
            // Ember's first round must return facts from at least one tool.
            tool_choice: "required",
          }
        : {}),
    });
    const response = await (options.request ?? fetch)(endpoint(model), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + model.key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw translateStatus(response.status);
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json"))
      throw new IntelligenceError("invalid_response");
    return normalize(await boundedJson(response), model, input);
  } catch (error) {
    if (error instanceof IntelligenceError) throw error;
    if (options.signal?.aborted) throw new IntelligenceError("cancelled");
    if (controller.signal.aborted) throw new IntelligenceError("timeout");
    throw new IntelligenceError("provider_unavailable");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
