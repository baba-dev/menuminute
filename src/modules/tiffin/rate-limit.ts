import { createHash } from "node:crypto";
import { redisClient } from "@/lib/redis";
import { tiffinFlagEnabled } from "./contracts";

type Operation = "week" | "quote";
const WINDOW_SECONDS = 60;

/** Per verified source, per minute. The week response is large, unauthenticated and uncached. */
export const TIFFIN_SOURCE_LIMIT: Record<Operation, number> = { week: 60, quote: 30 };
/** Per verified source and token, per minute. */
export const TIFFIN_SOURCE_TOKEN_LIMIT: Record<Operation, number> = { week: 40, quote: 20 };
/** Per token across all sources, per minute. */
export const TIFFIN_TOKEN_LIMIT = 120;
/** Across all sources, per minute: a ceiling on the load the unauthenticated routes can place on PostgreSQL. */
export const TIFFIN_GLOBAL_LIMIT: Record<Operation, number> = { week: 3000, quote: 1500 };

/** Counters are incremented in one Redis operation; the most specific quota is charged first. */
const script = `
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], ARGV[1]) end
  if count > tonumber(ARGV[i + 1]) then return 0 end
end
return 1
`;

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);

type Counter = { key: string; max: number };
async function reserve(counters: Counter[]) {
  const client = await redisClient("cache");
  const allowed = await client.eval(script, {
    keys: counters.map(({ key }) => key),
    arguments: [String(WINDOW_SECONDS), ...counters.map(({ max }) => String(max))],
  });
  return Number(allowed) === 1;
}

/**
 * Run before reading a body or touching PostgreSQL. `source` must come from verifiedOrderSource.
 * Rejects (callers answer 503) when Redis is unavailable: the limiter fails closed.
 */
export function reserveTiffinPublicSource(operation: Operation, source: string) {
  return reserve([
    { key: `tiffin:edge:${operation}:ip:${hash(source)}`, max: TIFFIN_SOURCE_LIMIT[operation] },
    { key: `tiffin:edge:${operation}:global`, max: TIFFIN_GLOBAL_LIMIT[operation] },
  ]);
}

/** Run only for a syntactically valid token (<= 128 chars) so arbitrary input cannot mint keys. */
export function reserveTiffinPublicToken(operation: Operation, source: string, token: string) {
  const capability = hash(token);
  return reserve([
    {
      key: `tiffin:cap:${operation}:source:${hash(source)}:${capability}`,
      max: TIFFIN_SOURCE_TOKEN_LIMIT[operation],
    },
    { key: `tiffin:cap:${operation}:token:${capability}`, max: TIFFIN_TOKEN_LIMIT },
  ]);
}

/** Route-level flag check: unset, off or malformed all read as "feature absent" (plain 404). */
export function tiffinRoutesEnabled(): boolean {
  try {
    return tiffinFlagEnabled();
  } catch {
    return false;
  }
}
