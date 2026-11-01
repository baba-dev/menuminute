import { createHash } from "node:crypto";
import { redisClient } from "@/lib/redis";
import { env } from "@/lib/config/env";

const digest = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 32);
const SOURCE_SCRIPT = `
for i=1,#KEYS do
 if tonumber(redis.call('GET',KEYS[i]) or '0') >= tonumber(ARGV[i]) then return 0 end
end
for i=1,#KEYS do
 local n=redis.call('INCR',KEYS[i])
 if n==1 then redis.call('EXPIRE',KEYS[i],600) end
end
return 1
`;
const SPEND_SCRIPT = `
for i=1,#KEYS do
 local spend=tonumber(redis.call('GET',KEYS[i]) or '0')
 if spend + tonumber(ARGV[1]) > tonumber(ARGV[i+1]) then return 0 end
end
for i=1,#KEYS do
 redis.call('INCRBY',KEYS[i],ARGV[1])
 if redis.call('TTL',KEYS[i]) < 0 then redis.call('EXPIRE',KEYS[i],90000) end
end
return 1
`;
/** Source admission comes before expensive menu/QR lookups. No account identity required. */
export async function reserveConciergeSource(source: string): Promise<boolean> {
  const redis = await redisClient("cache");
  return (
    Number(
      await redis.eval(SOURCE_SCRIPT, {
        keys: [`concierge:admission:${digest(source)}`, "concierge:admission:global"],
        arguments: ["30", "3000"],
      })
    ) === 1
  );
}
export type ConciergeReservation = { keys: [string, string]; reserved: number };
export function conciergeQuote(input: unknown): number {
  // Upper bound: each provider token consumes at least one UTF-8 byte.
  const inputBytes = Buffer.byteLength(JSON.stringify(input), "utf8") + 8192;
  const amount = Math.ceil(
    (inputBytes * env.AI_DINING_CONCIERGE_INPUT_MICROUSD_MTOK +
      2048 * env.AI_DINING_CONCIERGE_OUTPUT_MICROUSD_MTOK) /
      1_000_000
  );
  return Math.max(1, amount);
}
/** Atomically reserve both outlet and global daily budgets before provider inference. */
export async function reserveConciergeSpend(
  outletId: string,
  amount: number
): Promise<ConciergeReservation | null> {
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const day = new Date().toISOString().slice(0, 10);
  const keys: [string, string] = [
    `concierge:spend:${day}:outlet:${digest(outletId)}`,
    `concierge:spend:${day}:global`,
  ];
  const redis = await redisClient("cache");
  const allowed = await redis.eval(SPEND_SCRIPT, {
    keys,
    arguments: [
      String(amount),
      String(env.AI_DINING_CONCIERGE_OUTLET_DAILY_CAP_MICROUSD),
      String(env.AI_DINING_CONCIERGE_DAILY_CAP_MICROUSD),
    ],
  });
  return Number(allowed) === 1 ? { keys, reserved: amount } : null;
}
/** Keep full reservations on failure or unknown usage. Refund only a verified overestimate. */
export async function settleConciergeSpend(
  reservation: ConciergeReservation,
  usage: { inputTokens: number | null; outputTokens: number | null }
): Promise<void> {
  const { inputTokens, outputTokens } = usage;
  if (
    inputTokens == null ||
    outputTokens == null ||
    !Number.isSafeInteger(inputTokens) ||
    !Number.isSafeInteger(outputTokens) ||
    inputTokens < 0 ||
    outputTokens < 0
  )
    return;
  const actual = Math.ceil(
    (inputTokens * env.AI_DINING_CONCIERGE_INPUT_MICROUSD_MTOK +
      outputTokens * env.AI_DINING_CONCIERGE_OUTPUT_MICROUSD_MTOK) /
      1_000_000
  );
  const refund = reservation.reserved - Math.max(1, actual);
  if (refund <= 0) return;
  const redis = await redisClient("cache");
  await redis.eval(
    "for i=1,#KEYS do local n=tonumber(redis.call('GET',KEYS[i]) or '0'); redis.call('SET',KEYS[i],math.max(0,n-tonumber(ARGV[1])),'KEEPTTL') end return 1",
    { keys: reservation.keys, arguments: [String(refund)] }
  );
}
