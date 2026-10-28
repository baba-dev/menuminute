import { redisClient } from "@/lib/redis";
import type { PublicProduct } from "./service";

const TOKEN_OUTLET_TTL_SECONDS = 86400; // 24 hours
const MENU_CACHE_TTL_SECONDS = 300; // 5 minutes
const VERSION_KEY_TTL_SECONDS = 604800; // 7 days

function tokenOutletKey(token: string): string {
  return `cache:token-outlet:${token}`;
}

function outletVersionKey(outletId: string): string {
  return `cache:outlet-version:${outletId}`;
}

function menuCacheKey(token: string, version: string, locale: string | null): string {
  return `cache:public-menu:${token}:${version}:${locale ?? "default"}`;
}

export async function getCachedPublicProduct(
  token: string,
  locale: string | null
): Promise<PublicProduct | null> {
  try {
    const redis = await redisClient("cache");
    const outletId = await redis.get(tokenOutletKey(token));
    if (!outletId) return null;

    const version = (await redis.get(outletVersionKey(outletId))) || "1";
    const cached = await redis.get(menuCacheKey(token, version, locale));
    if (!cached) return null;

    const parsed = JSON.parse(cached) as PublicProduct;
    // Always refresh the current dynamic instant so schedules and opening hours are live
    parsed.now = new Date().toISOString();
    return parsed;
  } catch {
    // Gracefully degrade to direct database query on Redis downtime
    return null;
  }
}

export async function setCachedPublicProduct(
  token: string,
  locale: string | null,
  data: PublicProduct
): Promise<void> {
  try {
    const redis = await redisClient("cache");
    const outletId = data.outlet.id;
    if (!outletId) return;

    // Persist token -> outlet association
    await redis.set(tokenOutletKey(token), outletId, { EX: TOKEN_OUTLET_TTL_SECONDS });

    const versionKey = outletVersionKey(outletId);
    let version = await redis.get(versionKey);
    if (!version) {
      version = "1";
      await redis.set(versionKey, version, { EX: VERSION_KEY_TTL_SECONDS });
    }

    await redis.set(
      menuCacheKey(token, version, locale),
      JSON.stringify(data),
      { EX: MENU_CACHE_TTL_SECONDS }
    );
  } catch {
    // Non-blocking cache write failure
  }
}

/**
 * Atomically invalidates all cached menus, service points, and translations for an outlet.
 * Incrementing the outlet version immediately diverts subsequent reads to fetch fresh data from PostgreSQL.
 */
export async function invalidateOutletMenuCache(outletId: string): Promise<void> {
  if (!outletId) return;
  try {
    const redis = await redisClient("cache");
    const versionKey = outletVersionKey(outletId);
    await redis.incr(versionKey);
    await redis.expire(versionKey, VERSION_KEY_TTL_SECONDS);
  } catch {
    // Non-blocking cache invalidation failure
  }
}
