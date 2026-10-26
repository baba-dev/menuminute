import { randomUUID, createHash } from "node:crypto";
import { redisClient } from "@/lib/redis";

const LEASE_MS = 18_000;
const TTL_SECONDS = 45;
const LIMITS = [2, 40, 160] as const;
const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);

// All three sets are checked and reserved atomically across web processes.
// Stale leases expire by Redis server time; no unbounded process-local maps.
const acquireScript = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
for i = 1, #KEYS do
  redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', now)
  if redis.call('ZCARD', KEYS[i]) >= tonumber(ARGV[i + 1]) then return 0 end
end
for i = 1, #KEYS do
  redis.call('ZADD', KEYS[i], now + tonumber(ARGV[5]), ARGV[1])
  redis.call('EXPIRE', KEYS[i], tonumber(ARGV[6]))
end
return 1
`;
// A stream must still own all three leases to renew; a lost lease fails closed.
const renewScript = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
for i = 1, #KEYS do
  redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', now)
  if not redis.call('ZSCORE', KEYS[i], ARGV[1]) then return 0 end
end
for i = 1, #KEYS do
  redis.call('ZADD', KEYS[i], 'XX', now + tonumber(ARGV[2]), ARGV[1])
  redis.call('EXPIRE', KEYS[i], tonumber(ARGV[3]))
end
return 1
`;
const releaseScript = `
for i = 1, #KEYS do
  redis.call('ZREM', KEYS[i], ARGV[1])
  if redis.call('ZCARD', KEYS[i]) == 0 then redis.call('DEL', KEYS[i]) end
end
return 1
`;
export type KitchenStreamLease = {
  renew: () => Promise<boolean>;
  release: () => Promise<void>;
};
/** Active-session, per-outlet and server-fleet admission limits. */
export async function acquireKitchenStream(
  userId: string,
  sessionId: string,
  outletId: string
): Promise<KitchenStreamLease | null> {
  const id = randomUUID();
  const keys = [
    `kitchen:sse:session:${hash(userId + ":" + sessionId + ":" + outletId)}`,
    `kitchen:sse:outlet:${hash(outletId)}`,
    "kitchen:sse:fleet",
  ];
  const client = await redisClient("cache");
  const admitted = Number(
    await client.eval(acquireScript, {
      keys,
      arguments: [id, ...LIMITS.map(String), String(LEASE_MS), String(TTL_SECONDS)],
    })
  );
  if (admitted !== 1) return null;
  let released = false;
  return {
    async renew() {
      if (released) return false;
      return (
        Number(
          await (
            await redisClient("cache")
          ).eval(renewScript, {
            keys,
            arguments: [id, String(LEASE_MS), String(TTL_SECONDS)],
          })
        ) === 1
      );
    },
    async release() {
      if (released) return;
      released = true;
      await (await redisClient("cache")).eval(releaseScript, { keys, arguments: [id] });
    },
  };
}
