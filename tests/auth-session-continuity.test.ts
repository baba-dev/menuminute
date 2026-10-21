import { describe, expect, it } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { authServer } from "../src/lib/auth";
import {
  REMEMBERED_SESSION_SECONDS,
  SESSION_REFRESH_SECONDS,
} from "../src/lib/auth-session-policy";
import { admin } from "./helpers";
import { getPool } from "../src/db";

const origin = "http://localhost:3000";
async function syntheticAccount() {
  const id = crypto.randomUUID();
  const email = "session-" + id + "@auth.invalid";
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'Session fixture',$2,true)",
      [id, email]
    );
    await pool.query(
      "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
      [crypto.randomUUID(), id, await hashPassword("session-fixture-password")]
    );
  });
  return { id, email };
}
function browserCookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .filter(Boolean)
    .join("; ");
}
async function signIn(email: string, rememberMe: boolean) {
  return authServer.handler(
    new Request(origin + "/api/auth/sign-in/email", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ email, password: "session-fixture-password", rememberMe }),
    })
  );
}
async function getSession(cookie: string) {
  return authServer.handler(new Request(origin + "/api/auth/get-session", { headers: { cookie } }));
}
describe("session persistence and browser renewal", () => {
  it("uses a 30-day sliding database session and a persistent first-party cookie when remembered", async () => {
    expect(REMEMBERED_SESSION_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(SESSION_REFRESH_SECONDS).toBe(24 * 60 * 60);
    const { email, id } = await syntheticAccount();
    const login = await signIn(email, true);
    expect(login.status).toBe(200);
    const tokenCookie = login.headers.getSetCookie().find((c) => c.includes("session_token="));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/max-age=2592000/i);
    expect(tokenCookie).toMatch(/httponly/i);
    expect(tokenCookie).toMatch(/samesite=lax/i);
    const cookie = browserCookies(login);
    const first = await getSession(cookie);
    expect((await first.json()).user.email).toBe(email);
    const before = await getPool().query<{ expires_at: Date }>(
      "select expires_at from sessions where user_id=$1",
      [id]
    );
    expect(before.rows[0]!.expires_at.getTime()).toBeGreaterThan(
      Date.now() + 29 * 24 * 60 * 60 * 1000
    );
    // Exercise the actual adapter renewal across independent HTTP requests.
    await admin(async (_db, pool) => {
      await pool.query(
        "update sessions set updated_at=now()-interval '2 days', expires_at=now()+interval '1 day' where user_id=$1",
        [id]
      );
    });
    const renewed = await getSession(cookie);
    expect(renewed.status).toBe(200);
    expect((await renewed.json()).user.email).toBe(email);
    const after = await getPool().query<{ expires_at: Date }>(
      "select expires_at from sessions where user_id=$1",
      [id]
    );
    expect(after.rows[0]!.expires_at.getTime()).toBeGreaterThan(
      Date.now() + 29 * 24 * 60 * 60 * 1000
    );
    expect(renewed.headers.getSetCookie().some((c) => c.includes("session_token="))).toBe(true);
  });
  it("uses a browser-session-only cookie when Remember Me is unchecked", async () => {
    const { email } = await syntheticAccount();
    const login = await signIn(email, false);
    expect(login.status).toBe(200);
    const cookie = login.headers.getSetCookie().find((c) => c.includes("session_token="));
    expect(cookie).toBeDefined();
    expect(cookie).not.toMatch(/max-age=|expires=/i);
    expect((await (await getSession(browserCookies(login))).json()).user.email).toBe(email);
  });
  it("never authenticates a revoked database session from the old signed cookie", async () => {
    const { email, id } = await syntheticAccount();
    const login = await signIn(email, true);
    const cookie = browserCookies(login);
    await admin(async (_db, pool) => {
      await pool.query("delete from sessions where user_id=$1", [id]);
    });
    expect(await (await getSession(cookie)).json()).toBeNull();
  });
});
