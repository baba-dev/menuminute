import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { redisClient } from "@/lib/redis";

const WINDOW_SECONDS = 600;
const PER_SOURCE = 10;
const GLOBAL_PER_WINDOW = 400;

export type DemoEntryDecision = "allowed" | "busy" | "service" | "denied";

/** Fixed-window limiter for demo entry. Fails closed if Redis is unavailable. */
export async function demoEntryDecision(req: Request): Promise<DemoEntryDecision> {
  const source = req.headers.get("x-real-ip");
  if (!source || isIP(source) === 0) return "denied";
  const sourceKey = `demo:entry:src:${createHash("sha256").update(source).digest("hex")}`;
  try {
    const redis = await redisClient("cache");
    const script = `local a=redis.call('INCR',KEYS[1]); if a==1 then redis.call('EXPIRE',KEYS[1],${WINDOW_SECONDS}) end;
      local g=redis.call('INCR',KEYS[2]); if g==1 then redis.call('EXPIRE',KEYS[2],${WINDOW_SECONDS}) end;
      return {a,g}`;
    const [perSource, global] = (await redis.eval(script, {
      keys: [sourceKey, "demo:entry:global"],
    })) as number[];
    return Number(perSource) <= PER_SOURCE && Number(global) <= GLOBAL_PER_WINDOW
      ? "allowed" : "busy";
  } catch {
    // Fail closed, but distinguish service failure from a real entry limit.
    return "service";
  }
}

export async function allowDemoEntry(req: Request): Promise<boolean> {
  return (await demoEntryDecision(req)) === "allowed";
}
