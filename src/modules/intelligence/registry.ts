import type { Env } from "@/lib/config/env";
import { IntelligenceError, type ProviderId, type ProviderModel } from "./contracts";

const nvidiaModel = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i;
const cloudflareModel = /^@cf\/[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i;

/** Only explicitly reviewed, entitled and configured models enter the registry. */
export function buildRegistry(config: Env): ReadonlyArray<ProviderModel> {
  if (!config.AI_FEATURES_ENABLED || !config.AI_ORCHESTRATOR_ENABLED) return [];
  const models: ProviderModel[] = [];
  if (config.AI_NVIDIA_ENABLED) {
    if (
      !config.AI_NVIDIA_COMMERCIAL_APPROVED ||
      !config.NVIDIA_API_KEY ||
      !config.AI_NVIDIA_MODEL ||
      !nvidiaModel.test(config.AI_NVIDIA_MODEL)
    )
      throw new IntelligenceError("not_configured");
    models.push({
      provider: "nvidia",
      model: config.AI_NVIDIA_MODEL,
      key: config.NVIDIA_API_KEY,
      supportsTools: config.AI_NVIDIA_TOOLS_VERIFIED,
    });
  }
  if (config.AI_CLOUDFLARE_ENABLED) {
    if (
      !config.CLOUDFLARE_API_TOKEN ||
      !config.CLOUDFLARE_ACCOUNT_ID ||
      !/^[a-f0-9]{32}$/i.test(config.CLOUDFLARE_ACCOUNT_ID) ||
      !config.AI_CLOUDFLARE_MODEL ||
      !cloudflareModel.test(config.AI_CLOUDFLARE_MODEL)
    )
      throw new IntelligenceError("not_configured");
    models.push({
      provider: "cloudflare",
      model: config.AI_CLOUDFLARE_MODEL,
      key: config.CLOUDFLARE_API_TOKEN,
      accountId: config.CLOUDFLARE_ACCOUNT_ID,
      supportsTools: config.AI_CLOUDFLARE_TOOLS_VERIFIED,
    });
  }
  return models;
}
/** Selection is deterministic; provider failure never triggers an implicit retry or fallback. */
export function selectProvider(
  models: ReadonlyArray<ProviderModel>,
  capability: "text" | "tools",
  requested?: ProviderId
): ProviderModel {
  const candidates = requested
    ? models.filter((model) => model.provider === requested)
    : [
        ...models.filter((model) => model.provider === "cloudflare"),
        ...models.filter((model) => model.provider === "nvidia"),
      ];
  if (!candidates.length) throw new IntelligenceError("not_configured");
  const selected = candidates.find((model) => capability === "text" || model.supportsTools);
  if (!selected) throw new IntelligenceError("unsupported_capability");
  return selected;
}
