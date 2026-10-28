import { redisClient } from "@/lib/redis";
import { telemetry } from "@/lib/telemetry";
import { logger } from "@/lib/logger";
import type { PublicProduct } from "./service";

const TOKEN_OUTLET_TTL_SECONDS = 86400;
const MENU_CACHE_TTL_SECONDS = 180;
const REVOKED_TOKEN_TTL_SECONDS = MENU_CACHE_TTL_SECONDS * 2;

const tokenOutletKey = (token: string) => `cache:token-outlet:${token}`;
const revokedTokenKey = (token: string) => `cache:revoked-token:${token}`;
const outletVersionKey = (outletId: string) => `cache:outlet-version:${outletId}`;
const menuCacheKey = (token: string, version: string, locale: string | null) =>
  `cache:public-menu:${token}:${version}:${locale ?? "default"}`;

export type MenuCacheFence = { outletId: string; version: string };
export type MenuCacheRead = { data: PublicProduct | null; fence: MenuCacheFence | null };

// The entire lookup is atomic with respect to an invalidation or token revocation.
const readScript = `
if redis.call('EXISTS', KEYS[2]) == 1 then return {false, false, false} end
local outlet = redis.call('GET', KEYS[1])
if not outlet then return {false, false, false} end
local version = redis.call('GET', ARGV[1] .. outlet) or '0'
local payload = redis.call('GET', ARGV[2] .. version .. ':' .. ARGV[3])
return {outlet, version, payload or false}
`;

// A read that started before a mutation must not write into its successor generation.
const writeScript = `
if redis.call('EXISTS', KEYS[3]) == 1 then return 0 end
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
if (redis.call('GET', KEYS[2]) or '0') ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[4], ARGV[3], 'EX', ARGV[4])
return 1
`;

const rememberScript = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
local current = redis.call('GET', KEYS[1])
if current and current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 1
`;

function logCacheFailure(operation: string, error: unknown) {
  logger.error("[public-menu-cache] operation failed", error, { operation });
}

export async function getCachedPublicProduct(
  token: string,
  locale: string | null
): Promise<MenuCacheRead> {
  try {
    const redis = await redisClient("cache");
    const response = (await redis.eval(readScript, {
      keys: [tokenOutletKey(token), revokedTokenKey(token)],
      arguments: ["cache:outlet-version:", `cache:public-menu:${token}:`, locale ?? "default"],
    })) as Array<string | null>;
    const [outletId, version, payload] = response;
    if (!outletId || !version) {
      telemetry.recordCacheMiss();
      return { data: null, fence: null };
    }
    const fence = { outletId, version };
    if (!payload) {
      telemetry.recordCacheMiss();
      return { data: null, fence };
    }
    telemetry.recordCacheHit();
    const data = JSON.parse(payload) as PublicProduct;
    data.now = new Date().toISOString();
    return { data, fence };
  } catch (error) {
    logCacheFailure("read", error);
    // A Redis outage degrades to the authoritative PostgreSQL query.
    return { data: null, fence: null };
  }
}

export async function setCachedPublicProduct(
  token: string,
  locale: string | null,
  data: PublicProduct,
  fence: MenuCacheFence | null
): Promise<void> {
  try {
    const redis = await redisClient("cache");
    if (!fence) {
      // First visit establishes the association, but NEVER caches a database
      // snapshot acquired before its generation was known.
      await redis.eval(rememberScript, {
        keys: [tokenOutletKey(token), revokedTokenKey(token)],
        arguments: [data.outlet.id, String(TOKEN_OUTLET_TTL_SECONDS)],
      });
      return;
    }
    if (fence.outletId !== data.outlet.id) return;
    await redis.eval(writeScript, {
      keys: [
        tokenOutletKey(token),
        outletVersionKey(fence.outletId),
        revokedTokenKey(token),
        menuCacheKey(token, fence.version, locale),
      ],
      arguments: [
        fence.outletId,
        fence.version,
        JSON.stringify(data),
        String(MENU_CACHE_TTL_SECONDS),
      ],
    });
  } catch (error) {
    logCacheFailure("write", error);
  }
}

/** Call only after a successful database commit. Do not expire generation keys:
 * an expired generation could resurrect an older still-live payload. */
export async function invalidateOutletMenuCache(outletId: string): Promise<void> {
  if (!outletId) return;
  try {
    const redis = await redisClient("cache");
    await redis.incr(outletVersionKey(outletId));
  } catch (error) {
    logCacheFailure("invalidate", error);
  }
}

export async function invalidateOutletMenuCaches(outletIds: Iterable<string>): Promise<void> {
  const unique = [...new Set([...outletIds].filter(Boolean))];
  if (!unique.length) return;
  try {
    const redis = await redisClient("cache");
    const batch = redis.multi();
    for (const outletId of unique) batch.incr(outletVersionKey(outletId));
    await batch.exec();
  } catch (error) {
    logCacheFailure("invalidate-many", error);
  }
}

/** Tombstone the old token before it can be repopulated by an in-flight request. */
export async function revokeCachedQrToken(outletId: string, token: string): Promise<void> {
  if (!outletId || !token) return;
  try {
    const redis = await redisClient("cache");
    await redis
      .multi()
      .set(revokedTokenKey(token), "1", { EX: REVOKED_TOKEN_TTL_SECONDS })
      .del(tokenOutletKey(token))
      .incr(outletVersionKey(outletId))
      .exec();
  } catch (error) {
    logCacheFailure("revoke", error);
  }
}
