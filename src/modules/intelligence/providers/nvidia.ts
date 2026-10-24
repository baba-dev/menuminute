import { IntelligenceError, type ProviderAdapter } from "../contracts";
import { chatCompletion } from "./chat-http";

/** Server-only NVIDIA NIM adapter. The endpoint and key never come from model output. */
export const nvidiaAdapter: ProviderAdapter = (model, input, options) => {
  if (model.provider !== "nvidia") throw new IntelligenceError("not_configured");
  return chatCompletion(model, input, options);
};
