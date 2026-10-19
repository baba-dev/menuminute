import { it, expect } from "vitest";
import { authServer } from "../src/lib/auth";
import { admin } from "./helpers";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { drainAuthTestMessages } from "../src/lib/auth-email";
async function request(path: string, body?: unknown, cookie?: string) {
  return authServer.handler(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  );
}
it("creates database sessions and revokes them without cached JWT authority", async () => {
  const email = `${nanoid()}@auth.invalid`.toLowerCase();
  drainAuthTestMessages();
  const signup = await request("sign-up/email", {
    name: "Owner",
    email,
    password: "test-password-123",
  });
  expect(signup.status).toBe(200);
  expect(signup.headers.get("set-cookie")).toBeNull();
  const emails = drainAuthTestMessages();
  expect(emails).toHaveLength(1);
  const link = emails[0]!.text.match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeTruthy();
  expect((await authServer.handler(new Request(link!))).status).toBe(302);
  const signedIn = await request("sign-in/email", { email, password: "test-password-123" });
  expect(signedIn.status).toBe(200);
  const cookie = signedIn.headers.get("set-cookie")!.split(";")[0]!;
  expect((await request("get-session", undefined, cookie)).status).toBe(200);
  const data = await (await request("get-session", undefined, cookie)).json();
  expect(data.user.email).toBe(email);
  await admin(async (_db, pool) => {
    await pool.query("delete from sessions where user_id=$1", [data.user.id]);
  });
  expect(await (await request("get-session", undefined, cookie)).json()).toBeNull();
});
it("retains imported bcrypt credentials and rejects wrong passwords", async () => {
  const id = nanoid(),
    email = `${id}@legacy.invalid`.toLowerCase();
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'Legacy',$2,true)",
      [id, email]
    );
    await pool.query(
      "insert into accounts(id,account_id,provider_id,user_id,password) values($1,$2,'credential',$2,$3)",
      [nanoid(), id, await bcrypt.hash("legacy-password", 12)]
    );
  });
  expect((await request("sign-in/email", { email, password: "legacy-password" })).status).toBe(200);
  expect((await request("sign-in/email", { email, password: "wrong-password" })).status).toBe(401);
});
it("rejects untrusted origins on authentication writes", async () => {
  const res = await authServer.handler(
    new Request("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { origin: "https://untrusted.invalid", "content-type": "application/json" },
      body: JSON.stringify({
        name: "Owner",
        email: `${nanoid()}@auth.invalid`.toLowerCase(),
        password: "test-password-123",
      }),
    })
  );
  expect(res.status).toBe(403);
});
