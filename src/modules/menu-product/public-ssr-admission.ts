import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { cache } from "react";
import { headers } from "next/headers";
import { redisClient } from "@/lib/redis";

/**
 * Server-rendered /m/... visits do not pass through the JSON API's limiter.
 * Apply a request-memoized admission before metadata OR page DB work.
 * The existing reverse proxy overwrites X-Real-IP; never use X-Forwarded-For.
 * Redis failure is fail-open for read-only menus, preserving restaurant access.
 */
export const admitPublicMenuRender = cache(async (): Promise<boolean> => {
  const source = (await headers()).get("x-real-ip");
  if (!source || isIP(source) === 0) return true;
  try {
    const hash = createHash("sha256").update(source).digest("hex").slice(0, 32);
    const redis = await redisClient("cache");
    const decision = await redis.eval(
      `for i=1,#KEYS do
        if tonumber(redis.call('GET',KEYS[i]) or '0') >= tonumber(ARGV[i]) then return 0 end
       end
       for i=1,#KEYS do
        local n=redis.call('INCR',KEYS[i])
        if n==1 then redis.call('EXPIRE',KEYS[i],60) end
       end
       return 1`,
      { keys: [`public-menu:ssr:ip:${hash}`, "public-menu:ssr:global"], arguments: ["240", "8000"] }
    );
    return Number(decision) === 1;
  } catch {
    // Read-only public QR menus remain accessible during cache/Redis outages.
    return true;
  }
});
