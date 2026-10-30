import type { Env } from "@/lib/config/env";
import { IntelligenceError, type InferenceMessage, type ProviderId } from "./contracts";

export type SpendPolicy = {
  reservationMicroUsd: number;
  dailyCapMicroUsd: number;
  inputPriceMicroUsdMtok: number;
  outputPriceMicroUsdMtok: number;
};

const MAX_PRICE = 1_000_000_000;
const MICRO_PER_MILLION = 1_000_000n;
function valid(value: number | undefined): value is number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0 && value <= MAX_PRICE;
}
function charge(input: number, output: number, inputPrice: number, outputPrice: number) {
  return Number(
    (BigInt(input) * BigInt(inputPrice) +
      BigInt(output) * BigInt(outputPrice) +
      MICRO_PER_MILLION - 1n) /
      MICRO_PER_MILLION
  );
}

/**
 * Deliberately conservative admission reservation, not a provider invoice.
 * An input token consumes at least one UTF-8 byte; add 4096 token-equivalents
 * for provider wrappers and fixed message overhead. The adapter's output cap
 * (including Nemotron's 2048-tool-token floor) is reserved before transmission.
 * Actual provider-reported tokens replace the reservation on successful settlement.
 */
export function assistantSpendPolicy(
  config: Env,
  provider: ProviderId,
  model: string,
  messages: InferenceMessage[],
  tools: ReadonlyArray<unknown>,
  requestedOutputTokens: number
): SpendPolicy {
  const nvidia = provider === "nvidia";
  const expectedModel = nvidia ? config.AI_NVIDIA_MODEL : config.AI_CLOUDFLARE_MODEL;
  const inputPrice = nvidia
    ? config.AI_EMBER_NVIDIA_INPUT_MICROUSD_MTOK
    : config.AI_EMBER_CLOUDFLARE_INPUT_MICROUSD_MTOK;
  const outputPrice = nvidia
    ? config.AI_EMBER_NVIDIA_OUTPUT_MICROUSD_MTOK
    : config.AI_EMBER_CLOUDFLARE_OUTPUT_MICROUSD_MTOK;
  const cap = nvidia
    ? config.AI_EMBER_NVIDIA_DAILY_CAP_MICROUSD
    : config.AI_EMBER_CLOUDFLARE_DAILY_CAP_MICROUSD;
  if (
    !model ||
    model !== expectedModel ||
    !valid(inputPrice) ||
    !valid(outputPrice) ||
    !valid(cap) ||
    !Number.isSafeInteger(requestedOutputTokens) ||
    requestedOutputTokens < 1 ||
    requestedOutputTokens > 4096
  ) {
    throw new IntelligenceError("not_configured");
  }
  const serialized = JSON.stringify({ messages, tools });
  const inputLimit = Buffer.byteLength(serialized, "utf8") + 4096;
  if (inputLimit > 1_000_000) throw new IntelligenceError("invalid_request");
  const outputLimit =
    nvidia &&
    model === "nvidia/nemotron-3.5-super-vl-120b-a12b" &&
    tools.length > 0
      ? Math.max(requestedOutputTokens, 2048)
      : requestedOutputTokens;
  // A nonzero reservation also caps explicitly priced sub-micro-USD requests.
  const reserve = Math.max(1, charge(inputLimit, outputLimit, inputPrice, outputPrice));
  if (!Number.isSafeInteger(reserve) || reserve > cap)
    throw new IntelligenceError("quota_exhausted");
  return {
    reservationMicroUsd: reserve,
    dailyCapMicroUsd: cap,
    inputPriceMicroUsdMtok: inputPrice,
    outputPriceMicroUsdMtok: outputPrice,
  };
}
