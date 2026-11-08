import { createHash } from "node:crypto";
import { redisClient } from "@/lib/redis";
import { RateLimitError, UnavailableError } from "@/lib/errors";

/**
 * Fail-closed caps for Google Play purchase endpoints. Each call may cost a Google Developer API request,
 * so an authenticated owner is bounded per account and per organization, plus a global ceiling.
 * Keys hold only hashes, never tokens or raw identities.
 */
const reserveScript = `
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], ARGV[1]) end
  if count > tonumber(ARGV[i + 1]) then return 0 end
end
return 1
`;
const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);

export async function reservePlayPurchaseCall(
  kind: "intent" | "verify",
  actorId: string,
  organizationId: string
): Promise<void> {
  try {
    const client = await redisClient("cache");
    const decision = await client.eval(reserveScript, {
      keys: [
        `billing:play:${kind}:actor:${digest(actorId)}`,
        `billing:play:${kind}:org:${digest(organizationId)}`,
        `billing:play:${kind}:global`,
      ],
      // 10-minute window; verify also runs a restore sweep, so allow a handful of tokens per visit.
      arguments: ["600", "30", "60", "2000"],
    });
    if (Number(decision) !== 1) throw new RateLimitError(600);
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    throw new UnavailableError("Purchases are temporarily unavailable. Please try again shortly.");
  }
}
