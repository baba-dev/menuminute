import { createHash } from "node:crypto";
import { env } from "@/lib/config/env";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { redisClient } from "@/lib/redis";
import { isDemoActor } from "./guard";

/** Visitors of the shared demo account get a short, capped Ember allowance. */
export const DEMO_EMBER_PROMPT_CHARS = 280;
const WINDOW_SECONDS = 600;

export type DemoEmberLimits = { dailyTurns: number; sourceTurns: number };
export const demoEmberLimits = (): DemoEmberLimits => ({
  dailyTurns: env.DEMO_AI_DAILY_TURNS,
  sourceTurns: env.DEMO_AI_SOURCE_TURNS_PER_10MIN,
});

/**
 * Per-source and global-daily admission for the public demo's Ember. Real provider cost is bounded by
 * `dailyTurns` times the per-turn reservation. Fails closed if Redis is unavailable. No-op for every
 * other user. The shared provider daily cap still applies on top of this.
 */
export async function enforceDemoEmber(
  req: Request,
  userId: string,
  kind: "conversation" | "turn",
  prompt?: string,
  limits: DemoEmberLimits = demoEmberLimits()
): Promise<void> {
  if (!isDemoActor(userId)) return;
  if (kind === "turn" && (prompt?.length ?? 0) > DEMO_EMBER_PROMPT_CHARS)
    throw new ValidationError(
      `Demo questions are limited to ${DEMO_EMBER_PROMPT_CHARS} characters. Please shorten it.`
    );
  const source = req.headers.get("x-real-ip") ?? "missing-source";
  const sourceKey = `demo:ember:${kind}:src:${createHash("sha256").update(source).digest("hex")}`;
  const day = new Date().toISOString().slice(0, 10);
  let counts: number[];
  try {
    const redis = await redisClient("cache");
    const script = `local s=redis.call('INCR',KEYS[1]); if s==1 then redis.call('EXPIRE',KEYS[1],${WINDOW_SECONDS}) end;
      local d=0; if ARGV[1]=='turn' then d=redis.call('INCR',KEYS[2]); if d==1 then redis.call('EXPIRE',KEYS[2],90000) end end;
      return {s,d}`;
    counts = (await redis.eval(script, {
      keys: [sourceKey, `demo:ember:day:${day}`],
      arguments: [kind],
    })) as number[];
  } catch {
    throw new ForbiddenError("Ember is unavailable in the demo right now. Please try again later.");
  }
  const perSource =
    kind === "turn" ? limits.sourceTurns : Math.max(2, Math.ceil(limits.sourceTurns / 2));
  if (Number(counts[0]) > perSource)
    throw new ForbiddenError(
      "Demo limit: you have asked Ember a lot in the last few minutes. Please wait a little and try again."
    );
  if (kind === "turn" && Number(counts[1]) > limits.dailyTurns)
    throw new ForbiddenError(
      "Demo limit: Ember's free demo allowance for today is used up. Sample answers are shown instead."
    );
}
