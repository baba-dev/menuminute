import { describe, expect, it, vi } from "vitest";
import { nvidiaAdapter } from "@/modules/intelligence/providers/nvidia";
import { cloudflareAdapter } from "@/modules/intelligence/providers/cloudflare";
import type { InferenceRequest, ProviderModel } from "@/modules/intelligence/contracts";

const nvidiaModel: ProviderModel = {
  provider: "nvidia",
  model: "nvidia/nemotron-3.5-super-vl-120b-a12b",
  key: "isolated-test-nvidia-key",
  supportsTools: false,
};
const cloudflareModel: ProviderModel = {
  provider: "cloudflare",
  model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  key: "isolated-test-cloudflare-key",
  accountId: "a".repeat(32),
  supportsTools: false,
};
const request: InferenceRequest = {
  capability: "text",
  tools: [],
  responseFormat: { type: "json_object" },
  messages: [
    { role: "system", content: "Return valid JSON." },
    { role: "user", content: "Select paneer." },
  ],
  maxOutputTokens: 2048,
  temperature: 0.2,
};

describe("NVIDIA structured concierge output profile", () => {
  it("opts out of reasoning only for the concierge, not regular NVIDIA or Cloudflare calls", async () => {
    const payloads: Array<Record<string, unknown>> = [];
    const fake = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(
        JSON.stringify({
          choices: [
            { finish_reason: "stop", message: { content: '{"recommendations":[]}' } },
          ],
        }),
        { headers: { "content-type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    await nvidiaAdapter(nvidiaModel, request, {
      request: fake,
      reasoningEffort: "none",
    });
    await nvidiaAdapter(nvidiaModel, request, { request: fake });
    await cloudflareAdapter(cloudflareModel, request, {
      request: fake,
      reasoningEffort: "none",
    });

    expect(payloads).toHaveLength(3);
    expect(payloads[0]).toMatchObject({
      model: nvidiaModel.model,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      max_tokens: 2048,
    });
    expect(payloads[1]).not.toHaveProperty("reasoning_effort");
    expect(payloads[2]).not.toHaveProperty("reasoning_effort");
    expect(fake).toHaveBeenCalledTimes(3);
  });
});
