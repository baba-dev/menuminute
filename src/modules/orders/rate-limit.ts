import { createHash } from "node:crypto";
import { redisClient } from "@/lib/redis";

const WINDOW_SECONDS = 60;
const script = `
local total = redis.call('INCR', KEYS[1])
if total == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
if KEYS[2] == KEYS[1] then return {total, 0} end
local source = redis.call('INCR', KEYS[2])
if source == 1 then redis.call('EXPIRE', KEYS[2], ARGV[1]) end
return {total, source}
`;

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);

/** Redis-backed limits shared across Next.js processes; never log raw IPs or guest tokens. */
export async function enforcePublicOrderLimit(
  operation: "submit" | "tracking",
  capability: string,
  request: Request
): Promise<boolean> {
  const source = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip");
  const scope = `orders:limit:${operation}:${hash(capability)}`;
  const sourceScope = source ? `${scope}:${hash(source)}` : scope;
  const client = await redisClient("cache");
  const result = (await client.eval(script, {
    keys: [scope, sourceScope],
    arguments: [String(WINDOW_SECONDS)],
  })) as number[];
  const globalLimit = operation === "submit" ? 180 : 2000;
  const sourceLimit = operation === "submit" ? 15 : 120;
  return Number(result[0]) <= globalLimit && (!source || Number(result[1]) <= sourceLimit);
}
