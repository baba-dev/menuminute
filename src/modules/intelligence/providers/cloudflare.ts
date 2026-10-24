import { IntelligenceError, type ProviderAdapter } from "../contracts";
import { chatCompletion } from "./chat-http";

/** Server-only Cloudflare Workers AI adapter (OpenAI-compatible endpoint). */
export const cloudflareAdapter: ProviderAdapter = (model, input, options) => {
  if (model.provider !== "cloudflare") throw new IntelligenceError("not_configured");
  return chatCompletion(model, input, options);
};
