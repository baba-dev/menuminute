import { createHash } from "node:crypto";
import { redisClient } from "@/lib/redis";

const WINDOW_SECONDS = 600;
const SIGN_IN_PAIR_BUDGET = 15;
const SIGN_IN_SOURCE_BUDGET = SIGN_IN_PAIR_BUDGET * 8;
// A distributed-abuse backstop, not a routine account lockout threshold. Requests
// rejected by the pair/source budgets do not consume this victim-wide budget.
const SIGN_IN_EMAIL_BUDGET = 1000;

const EMAIL_BUDGETS: Record<string, number> = {
  "/sign-up/email": 5,
  "/request-password-reset": 5,
  "/send-verification-email": 5,
};

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function allowAuthRequest(req: Request): Promise<boolean> {
  const path = new URL(req.url).pathname.replace(/^\/api\/auth/, "");
  if (path !== "/sign-in/email" && !(path in EMAIL_BUDGETS)) return true;
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
  const emailFingerprint = fingerprint(email);
  const source = req.headers.get("x-real-ip");
  const sourceFingerprint = source ? fingerprint(source) : null;

  if (path === "/sign-in/email") {
    // Missing proxy identity shares one deliberately small source bucket instead
    // of bypassing the pair/source limits. Production Nginx overwrites X-Real-IP.
    const signInSourceFingerprint = sourceFingerprint ?? fingerprint("missing-source");
    const keys = [
      `auth:rate:${path}:${emailFingerprint}:${signInSourceFingerprint}`,
      `auth:source:${path}:${signInSourceFingerprint}`,
      `auth:email:${path}:${emailFingerprint}`,
    ];
    const script = `local pair=redis.call('INCR',KEYS[1]); if pair==1 then redis.call('EXPIRE',KEYS[1],${WINDOW_SECONDS}) end;
    local source=redis.call('INCR',KEYS[2]); if source==1 then redis.call('EXPIRE',KEYS[2],${WINDOW_SECONDS}) end;
    local email=tonumber(redis.call('GET',KEYS[3]) or '0');
    if pair<=tonumber(ARGV[1]) and source<=tonumber(ARGV[2]) then email=redis.call('INCR',KEYS[3]); if email==1 then redis.call('EXPIRE',KEYS[3],${WINDOW_SECONDS}) end end;
    return {pair,source,email}`;
    const redis = await redisClient("cache");
    const counts = (await redis.eval(script, {
      keys,
      arguments: [String(SIGN_IN_PAIR_BUDGET), String(SIGN_IN_SOURCE_BUDGET)],
    })) as number[];
    return (
      Number(counts[0]) <= SIGN_IN_PAIR_BUDGET &&
      Number(counts[1]) <= SIGN_IN_SOURCE_BUDGET &&
      Number(counts[2]) <= SIGN_IN_EMAIL_BUDGET
    );
  }

  const budget = EMAIL_BUDGETS[path]!;
  const keys = [`auth:rate:${path}:${emailFingerprint}`];
  if (sourceFingerprint) keys.push(`auth:source:${path}:${sourceFingerprint}`);
  const script = `local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],${WINDOW_SECONDS}) end;
  local source=0; if #KEYS==2 then source=redis.call('INCR',KEYS[2]); if source==1 then redis.call('EXPIRE',KEYS[2],${WINDOW_SECONDS}) end end; return {count,source}`;
  const redis = await redisClient("cache");
  const counts = (await redis.eval(script, { keys, arguments: [] })) as number[];
  return Number(counts[0]) <= budget && (!sourceFingerprint || Number(counts[1]) <= budget * 8);
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
