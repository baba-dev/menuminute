import type { z } from "zod";
import type { Env } from "@/lib/config/env";
import { nvidiaAdapter } from "./providers/nvidia";
import { cloudflareAdapter } from "./providers/cloudflare";
import {
  inferenceRequest,
  IntelligenceError,
  type InferenceResult,
  type ProviderId,
} from "./contracts";
import { buildRegistry, selectProvider } from "./registry";

export type HubInput = z.input<typeof inferenceRequest> & {
  provider?: ProviderId;
  signal?: AbortSignal;
};
/**
 * Server-side provider boundary, not a public API or a tool execution loop.
 * A future authorized orchestrator supplies scoped messages, budgets and audited tool definitions.
 */
export function createProviderHub(config: Env, request: typeof fetch = fetch) {
  const models = buildRegistry(config);
  return {
    available(): ReadonlyArray<{ provider: ProviderId; model: string; supportsTools: boolean }> {
      return models.map(({ provider, model, supportsTools }) => ({
        provider,
        model,
        supportsTools,
      }));
    },
    async infer(input: HubInput): Promise<InferenceResult> {
      if (!config.AI_FEATURES_ENABLED || !config.AI_ORCHESTRATOR_ENABLED)
        throw new IntelligenceError("disabled");
      if (input.signal?.aborted) throw new IntelligenceError("cancelled");
      const { provider, signal, ...requestData } = input;
      const validated = inferenceRequest.safeParse(requestData);
      if (!validated.success) throw new IntelligenceError("invalid_request");
      const model = selectProvider(models, validated.data.capability, provider);
      return model.provider === "nvidia"
        ? nvidiaAdapter(model, validated.data, { request, signal })
        : cloudflareAdapter(model, validated.data, { request, signal });
    },
  };
}
export type ProviderHub = ReturnType<typeof createProviderHub>;
