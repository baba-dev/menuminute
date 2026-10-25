import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { getPool } from "@/db";
import { env } from "@/lib/config/env";
import { redisClient } from "@/lib/redis";

type Operation = "submit" | "tracking";
const WINDOW_SECONDS = 60;

/** All counters are incremented in one Redis operation; fail closed on Redis failure. */
const script = `
local allowed = 1
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], ARGV[1]) end
  if count > tonumber(ARGV[i + 1]) then allowed = 0 end
end
return allowed
`;

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);

export class UntrustedOrderSourceError extends Error {
  constructor() {
    super("Order edge identity is unavailable");
  }
}

/**
 * Only an authenticated reverse proxy may assert client identity.
 * Ignore user-supplied CF-Connecting-IP, X-Real-IP and X-Forwarded-For entirely.
 * The proxy MUST overwrite both private headers, never forward their incoming values.
 */
export function verifiedOrderSource(
  request: Request,
  secret: string | undefined = env.ORDER_EDGE_SHARED_SECRET
): string {
  const assertedSecret = request.headers.get("x-menuminute-edge-key");
  const ip = request.headers.get("x-menuminute-client-ip");
  if (
    !secret ||
    secret.length < 32 ||
    !assertedSecret ||
    !ip ||
    ip !== ip.trim() ||
    isIP(ip) === 0
  ) {
    throw new UntrustedOrderSourceError();
  }
  const expected = Buffer.from(secret, "utf8");
  const actual = Buffer.from(assertedSecret, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new UntrustedOrderSourceError();
  }
  return ip;
}

type Counter = { key: string; max: number };
async function reserve(counters: Counter[]) {
  const client = await redisClient("cache");
  const allowed = await client.eval(script, {
    keys: counters.map(({ key }) => key),
    arguments: [String(WINDOW_SECONDS), ...counters.map(({ max }) => String(max))],
  });
  return Number(allowed) === 1;
}

/** Run this before reading request bodies or parsing untrusted QR tokens. */
export async function reserveOrderSource(operation: Operation, source: string) {
  return reserve([
    {
      key: `orders:edge:${operation}:global`,
      max: operation === "submit" ? 500 : 4000,
    },
    {
      key: `orders:edge:${operation}:ip:${hash(source)}`,
      max: operation === "submit" ? 35 : 150,
    },
  ]);
}

/**
 * QR and outlet limits apply only after a syntactically bounded token and,
 * for submissions, a valid public outlet have been resolved. Unbounded
 * arbitrary tokens cannot create Redis keys.
 */
export async function reserveOrderCapability(
  operation: Operation,
  source: string,
  token: string,
  outletId?: string
) {
  const capability = hash(token);
  const counters: Counter[] = [
    {
      key: `orders:cap:${operation}:token:${capability}`,
      max: operation === "submit" ? 180 : 2000,
    },
    {
      key: `orders:cap:${operation}:source:${hash(source)}:${capability}`,
      max: operation === "submit" ? 15 : 120,
    },
  ];
  if (operation === "submit") {
    if (!outletId) throw new Error("An outlet is required for order submission limits");
    counters.push({
      key: `orders:cap:submit:outlet:${hash(outletId)}`,
      max: 120,
    });
  }
  return reserve(counters);
}

/** Cheap token-to-outlet scope lookup; authoritative order checks remain in PostgreSQL. */
export async function publicOrderOutlet(token: string): Promise<string | null> {
  const row = await getPool().query<{ id: string | null }>(
    "select app_private.public_order_outlet($1) as id",
    [token]
  );
  return row.rows[0]?.id ?? null;
}
