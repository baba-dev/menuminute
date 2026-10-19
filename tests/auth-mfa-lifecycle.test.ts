import { createHmac } from "node:crypto";
import { it, expect } from "vitest";
import { nanoid } from "nanoid";
import { authServer } from "../src/lib/auth";
import { drainAuthTestMessages } from "../src/lib/auth-email";
import { confirmStepUp } from "../src/lib/step-up";
import { getPool } from "../src/db";

const root = "http://localhost:3000";
// Isolated CI-only authenticator: the secret is supplied by the test enrollment response.
function totp(uri: string, offset = 0) {
  const config = new URL(uri);
  const secret = config.searchParams.get("secret");
  if (!secret) throw new Error("Missing synthetic TOTP secret");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const letter of secret.toUpperCase().replace(/=+$/, "")) {
    const digit = alphabet.indexOf(letter);
    if (digit < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const step = BigInt(Math.floor(Date.now() / 30000) + offset);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(step);
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const index = hmac[hmac.length - 1]! & 15;
  return ((hmac.readUInt32BE(index) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}
function collectCookies(response: Response, existing = "") {
  const jar = new Map(
    existing
      .split("; ")
      .filter(Boolean)
      .map((part) => {
        const n = part.indexOf("=");
        return [part.slice(0, n), part.slice(n + 1)] as const;
      })
  );
  for (const value of response.headers.getSetCookie()) {
    const item = value.split(";")[0]!;
    const pos = item.indexOf("=");
    const name = item.slice(0, pos);
    const content = item.slice(pos + 1);
    if (/max-age=0|expires=Thu, 01 Jan 1970/i.test(value) || !content) jar.delete(name);
    else jar.set(name, content);
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}
function send(path: string, body: unknown, cookie = "") {
  return authServer.handler(
    new Request(root + "/api/auth/" + path, {
      method: "POST",
      headers: {
        origin: root,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    })
  );
}
it("enrolls a real TOTP, requires it at sign-in, accepts a backup code and verifies privileged step-up on the active session", async () => {
  drainAuthTestMessages();
  const email = nanoid() + "@test.invalid";
  const password = "mfa-lifecycle-123";
  const signup = await send("sign-up/email", { name: "Security fixture", email, password });
  expect(signup.status).toBe(200);
  const message = drainAuthTestMessages().find((m) => m.subject.includes("Verify"));
  expect(message).toBeDefined();
  const link = message!.text.match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeTruthy();
  expect((await authServer.handler(new Request(link!))).status).toBe(302);
  const login = await send("sign-in/email", { email, password });
  expect(login.status).toBe(200);
  let cookie = collectCookies(login);
  const session = await authServer.handler(
    new Request(root + "/api/auth/get-session", { headers: { cookie } })
  );
  const active = (await session.json()) as {
    user: { id: string; twoFactorEnabled: boolean };
    session: { id: string };
  };
  expect(active.user.twoFactorEnabled).toBe(false);
  const enroll = await send("two-factor/enable", { password, method: "totp" }, cookie);
  expect(enroll.status).toBe(200);
  const setup = (await enroll.json()) as { totpURI: string; backupCodes: string[] };
  expect(setup.totpURI).toContain("otpauth://totp/");
  expect(setup.backupCodes.length).toBeGreaterThan(0);
  cookie = collectCookies(enroll, cookie);
  const confirmed = await send(
    "two-factor/verify-totp",
    { code: totp(setup.totpURI), trustDevice: false },
    cookie
  );
  expect(confirmed.status).toBe(200);
  cookie = collectCookies(confirmed, cookie);
  const row = await getPool().query<{ two_factor_enabled: boolean }>(
    "select two_factor_enabled from users where id=$1",
    [active.user.id]
  );
  expect(row.rows[0]?.two_factor_enabled).toBe(true);
  const verifiedSession = await authServer.handler(
    new Request(root + "/api/auth/get-session", { headers: { cookie } })
  );
  const enrolledSession = (await verifiedSession.json()) as {
    user: { id: string };
    session: { id: string };
  };
  expect(enrolledSession.user.id).toBe(active.user.id);
  expect(enrolledSession.session.id).toBeTruthy();
  const secretResponse = await send("two-factor/get-totp-uri", { password }, cookie);
  expect(secretResponse.status).toBe(200);
  const currentFactor = (await secretResponse.json()) as { totpURI: string };
  expect(totp(currentFactor.totpURI)).toBe(totp(setup.totpURI));
  const proof = await confirmStepUp(
    active.user.id,
    enrolledSession.session.id,
    password,
    totp(setup.totpURI),
    new Headers({ cookie, origin: root })
  );
  expect(proof).toBe(true);
  const accepted = await getPool().query("select 1 from auth_step_up where session_id=$1", [
    enrolledSession.session.id,
  ]);
  expect(accepted.rowCount).toBe(1);
  expect((await send("sign-out", {}, cookie)).status).toBe(200);
  const challenge = await send("sign-in/email", { email, password });
  expect(challenge.status).toBe(200);
  expect(((await challenge.json()) as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBe(
    true
  );
  const pending = collectCookies(challenge);
  const pendingSession = await authServer.handler(
    new Request(root + "/api/auth/get-session", { headers: { cookie: pending } })
  );
  expect(await pendingSession.json()).toBeNull();
  const recovered = await send(
    "two-factor/verify-backup-code",
    { code: setup.backupCodes[0], trustDevice: false },
    pending
  );
  expect(recovered.status).toBe(200);
  const authenticated = collectCookies(recovered, pending);
  const resumed = await authServer.handler(
    new Request(root + "/api/auth/get-session", { headers: { cookie: authenticated } })
  );
  expect(((await resumed.json()) as { user?: { id: string } })?.user?.id).toBe(active.user.id);
}, 30000);
