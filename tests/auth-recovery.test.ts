import { it, expect } from "vitest";
import { authServer } from "../src/lib/auth";
import { drainAuthTestMessages } from "../src/lib/auth-email";
import { nanoid } from "nanoid";
import { TERMS_VERSION } from "../src/content/legal";
const root = "http://localhost:3000";
function send(path: string, body: unknown) {
  return authServer.handler(
    new Request(root + "/api/auth/" + path, {
      method: "POST",
      headers: { origin: root, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}
it("verifies email only with a delivered single-use token; recovery revokes old sessions", async () => {
  drainAuthTestMessages();
  const email = nanoid() + "@test.invalid";
  const signup = await send("sign-up/email", {
    name: "Recovered Owner",
    email,
    password: "original-test-123",
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: new Date(),
  });
  expect(signup.status).toBe(200);
  // Deferred verification: an unverified account can sign in; verification only flips the flag.
  const early = await send("sign-in/email", { email, password: "original-test-123" });
  expect(early.status).toBe(200);
  const mail = drainAuthTestMessages().find((m) => m.subject.includes("Verify"));
  expect(mail).toBeDefined();
  const link = mail!.text.match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeTruthy();
  expect((await authServer.handler(new Request(link!))).status).toBe(302);
  const reused = await authServer.handler(new Request(link!));
  expect(reused.status === 200 && !reused.headers.get("location")?.includes("error")).toBe(false);
  const login = await send("sign-in/email", { email, password: "original-test-123" });
  expect(login.status).toBe(200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  expect(
    (await send("request-password-reset", { email, redirectTo: root + "/reset-password" })).status
  ).toBe(200);
  const resetMail = drainAuthTestMessages().find((m) => m.subject.includes("Reset"));
  expect(resetMail).toBeDefined();
  const resetUrl = new URL(resetMail!.text.match(/https?:\/\/\S+/)![0]!);
  const forwarded = await authServer.handler(new Request(resetUrl));
  const destination = new URL(forwarded.headers.get("location") ?? resetUrl.toString(), root);
  const token =
    destination.searchParams.get("token") ??
    resetUrl.searchParams.get("token") ??
    resetUrl.pathname.split("/").pop();
  expect(token).toBeTruthy();
  const reset = await send("reset-password", { token, newPassword: "updated-test-123" });
  expect(reset.status).toBe(200);
  expect((await send("reset-password", { token, newPassword: "other-test-123" })).status).not.toBe(
    200
  );
  const session = await authServer.handler(
    new Request(root + "/api/auth/get-session", { headers: { cookie } })
  );
  expect(await session.json()).toBeNull();
  expect((await send("sign-in/email", { email, password: "original-test-123" })).status).not.toBe(
    200
  );
  expect((await send("sign-in/email", { email, password: "updated-test-123" })).status).toBe(200);
});
