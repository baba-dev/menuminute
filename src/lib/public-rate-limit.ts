import { createHash } from "node:crypto";
import { env } from "@/lib/config/env";
import { redisClient } from "@/lib/redis";
import { verifiedOrderSource } from "@/modules/orders/rate-limit";

// Atomically enforce client and global ceilings without amplifying blocked clients.
const fixedWindowScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
if count > tonumber(ARGV[2]) then return {0, count, ttl} end
local global = redis.call('INCR', KEYS[2])
if global == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end
if global > tonumber(ARGV[3]) then return {0, count, redis.call('TTL', KEYS[2])} end
return {1, count, ttl}
`;
export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

// Never trust client-origin forwarding headers; reuse the signed edge proof used by orders.
export function publicClientIdentity(request: Request) {
  return verifiedOrderSource(request);
}

export async function consumePublicMediaLimit(identity: string): Promise<RateLimitDecision> {
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 32);
  const client = await redisClient("cache");
  const result = (await client.eval(fixedWindowScript, {
    keys: [`rate:public-media:${digest}`, "rate:public-media:global"],
    arguments: [
      String(env.PUBLIC_MEDIA_RATE_LIMIT_WINDOW_SECONDS),
      String(env.PUBLIC_MEDIA_RATE_LIMIT_MAX),
      String(env.PUBLIC_MEDIA_RATE_LIMIT_GLOBAL_MAX),
    ],
  })) as [number, number, number];
  const count = Number(result[1]);
  return {
    allowed: Number(result[0]) === 1,
    limit: env.PUBLIC_MEDIA_RATE_LIMIT_MAX,
    remaining: Math.max(0, env.PUBLIC_MEDIA_RATE_LIMIT_MAX - count),
    retryAfterSeconds: Math.max(1, Number(result[2])),
  };
}
