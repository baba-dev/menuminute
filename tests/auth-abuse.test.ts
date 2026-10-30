import { describe, expect, it } from "vitest";
import { allowAuthRequest } from "../src/lib/auth-abuse";

function authRequest(path: string, email: string, source?: string): Request {
  return new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(source ? { "x-real-ip": source } : {}),
    },
    body: JSON.stringify({ email, password: "not-a-real-password" }),
  });
}

function sourceSubnet(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 4);
}

describe("authentication abuse budgets", () => {
  it("isolates the short sign-in budget by email and source", async () => {
    const email = `${crypto.randomUUID()}@auth.invalid`;
    const subnet = sourceSubnet();
    const attacker = `2001:db8:${subnet}:1::1`;

    for (let attempt = 0; attempt < 15; attempt++) {
      expect(await allowAuthRequest(authRequest("/sign-in/email", email, attacker))).toBe(true);
    }
    expect(await allowAuthRequest(authRequest("/sign-in/email", email, attacker))).toBe(false);

    // Traffic from the throttled attacker must not lock out the victim elsewhere.
    for (let attempt = 0; attempt < 1000; attempt++) {
      expect(await allowAuthRequest(authRequest("/sign-in/email", email, attacker))).toBe(false);
    }
    expect(
      await allowAuthRequest(authRequest("/sign-in/email", email, `2001:db8:${subnet}:2::1`))
    ).toBe(true);
  });

  it("keeps the aggregate per-source sign-in cap across email addresses", async () => {
    const nonce = crypto.randomUUID();
    const source = `2001:db8:${sourceSubnet()}:1::1`;

    for (let attempt = 0; attempt < 120; attempt++) {
      expect(
        await allowAuthRequest(
          authRequest("/sign-in/email", `${nonce}-${attempt}@auth.invalid`, source)
        )
      ).toBe(true);
    }
    expect(
      await allowAuthRequest(authRequest("/sign-in/email", `${nonce}-blocked@auth.invalid`, source))
    ).toBe(false);
  });

  it("uses a high but bounded email-only sign-in backstop", async () => {
    const email = `${crypto.randomUUID()}@auth.invalid`;
    const subnet = sourceSubnet();

    for (let source = 1; source <= 1000; source++) {
      expect(
        await allowAuthRequest(
          authRequest("/sign-in/email", email, `2001:db8:${subnet}:${source.toString(16)}::1`)
        )
      ).toBe(true);
    }
    expect(
      await allowAuthRequest(authRequest("/sign-in/email", email, `2001:db8:${subnet}:ffff::1`))
    ).toBe(false);
  });

  it.each(["/request-password-reset", "/send-verification-email"])(
    "keeps the strict five-request email budget for %s",
    async (path) => {
      const email = `${crypto.randomUUID()}@auth.invalid`;
      const subnet = sourceSubnet();
      for (let attempt = 0; attempt < 5; attempt++) {
        expect(
          await allowAuthRequest(authRequest(path, email, `2001:db8:${subnet}:${attempt + 1}::1`))
        ).toBe(true);
      }
      expect(await allowAuthRequest(authRequest(path, email, `2001:db8:${subnet}:ff::1`))).toBe(
        false
      );
    }
  );
});
