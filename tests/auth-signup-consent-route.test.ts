import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/auth/[...all]/route";
import { TERMS_VERSION } from "../src/content/legal";
import { admin } from "./helpers";

it("accepts signup via production NextRequest and stamps server-owned consent timestamp", async () => {
  const email = `signup-consent-${crypto.randomUUID()}@route.invalid`;
  const response = await POST(
    new NextRequest("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({
        email,
        name: "Consent Route Owner",
        password: "route-" + crypto.randomUUID(),
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: "1999-01-01T00:00:00.000Z",
        acceptTerms: true,
      }),
    })
  );
  const result = await response.clone().text();
  expect(response.status, result.slice(0, 500)).toBe(200);
  const row = await admin(async (_, pool) =>
    pool.query<{ terms_accepted_at: Date }>("select terms_accepted_at from users where email=$1", [
      email,
    ])
  );
  expect(row.rows).toHaveLength(1);
  expect(new Date(row.rows[0]!.terms_accepted_at).getFullYear()).toBeGreaterThan(2025);
});

it("rejects signup consent omissions before the authentication handler", async () => {
  const response = await POST(
    new NextRequest("http://localhost:3000/api/auth/sign-up/email", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ name: "Consent missing", termsVersion: TERMS_VERSION }),
    })
  );
  expect(response.status).toBe(422);
});
