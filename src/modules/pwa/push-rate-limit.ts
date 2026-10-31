import { createHash } from "node:crypto";
import { redisClient } from "@/lib/redis";
import { RateLimitError, UnavailableError } from "@/lib/errors";

/** Fail-closed account/session/outlet caps. No raw endpoint or identity in Redis keys. */
const reserveScript = `
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], ARGV[1]) end
  if count > tonumber(ARGV[i + 1]) then return 0 end
end
return 1
`;

function key(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export async function reservePushMutation(
  actor: { userId: string; sessionId: string },
  outletId: string
) {
  try {
    const client = await redisClient("cache");
    const decision = await client.eval(reserveScript, {
      keys: [
        `pwa:push:session:${key(actor.sessionId)}`,
        `pwa:push:actor:${key(actor.userId)}`,
        `pwa:push:outlet:${key(outletId)}`,
        "pwa:push:global",
      ],
      arguments: ["60", "12", "35", "200", "2000"],
    });
    if (Number(decision) !== 1) throw new RateLimitError(60);
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    throw new UnavailableError("Notification changes are temporarily unavailable.");
  }
}
