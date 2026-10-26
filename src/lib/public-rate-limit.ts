import { createHash } from "node:crypto";
import { env } from "@/lib/config/env";
import { redisClient } from "@/lib/redis";

const fixedWindowScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
`;

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export function publicClientIdentity(request: Request) {
  // Production Nginx overwrites X-Forwarded-For and the application only listens on loopback.
  // Never use the complete header as a Redis key or log it as customer data.
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unresolved";
}

export async function consumePublicMediaLimit(identity: string): Promise<RateLimitDecision> {
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 32);
  const client = await redisClient("cache");
  const result = (await client.eval(fixedWindowScript, {
    keys: [`rate:public-media:${digest}`],
    arguments: [String(env.PUBLIC_MEDIA_RATE_LIMIT_WINDOW_SECONDS)],
  })) as [number, number];
  const count = Number(result[0]);
  const retryAfterSeconds = Math.max(1, Number(result[1]));
  return {
    allowed: count <= env.PUBLIC_MEDIA_RATE_LIMIT_MAX,
    limit: env.PUBLIC_MEDIA_RATE_LIMIT_MAX,
    remaining: Math.max(0, env.PUBLIC_MEDIA_RATE_LIMIT_MAX - count),
    retryAfterSeconds,
  };
}
