import { createHash } from "node:crypto";
import { redisClient } from "@/lib/redis";
export async function allowAuthRequest(req: Request): Promise<boolean> {
  const path = new URL(req.url).pathname.replace(/^\/api\/auth/, "");
  const budgets: Record<string, number> = {
    "/sign-up/email": 5,
    "/sign-in/email": 15,
    "/request-password-reset": 5,
    "/send-verification-email": 5,
  };
  if (!(path in budgets)) return true;
  const length = Number(req.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length > 16384) return false;
  const raw = await req.clone().text();
  if (Buffer.byteLength(raw, "utf8") > 16384) return false;
  let body: { email?: unknown };
  try {
    body = JSON.parse(raw) as { email?: unknown };
  } catch {
    return true;
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254) return true;
  const fingerprint = createHash("sha256").update(email).digest("hex");
  const source = req.headers.get("x-real-ip");
  const sourceFingerprint = source ? createHash("sha256").update(source).digest("hex") : null;
  const keys = [`auth:rate:${path}:${fingerprint}`];
  if (sourceFingerprint) keys.push(`auth:source:${path}:${sourceFingerprint}`);
  const script = `local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],600) end;
  local source=0; if #KEYS==2 then source=redis.call('INCR',KEYS[2]); if source==1 then redis.call('EXPIRE',KEYS[2],600) end end; return {count,source}`;
  const redis = await redisClient("cache");
  const counts = (await redis.eval(script, { keys, arguments: [] })) as number[];
  return (
    Number(counts[0]) <= budgets[path]! &&
    (!sourceFingerprint || Number(counts[1]) <= budgets[path]! * 8)
  );
}

/** Fail closed: no unbounded OTP guessing on a stolen session/password. */
export async function allowStepUpAttempt(userId: string, sessionId: string): Promise<boolean> {
  const subject = createHash("sha256")
    .update(userId + ":" + sessionId)
    .digest("hex");
  const redis = await redisClient("cache");
  const key = "auth:step-up:" + subject;
  const count = await redis.eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],600) end; return n",
    { keys: [key], arguments: [] }
  );
  return Number(count) <= 5;
}
