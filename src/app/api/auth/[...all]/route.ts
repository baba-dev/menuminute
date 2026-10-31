import { observedRoute } from "@/lib/observed-route";
import { toNextJsHandler } from "better-auth/next-js";
import { authServer } from "@/lib/auth";
import { allowAuthRequest } from "@/lib/auth-abuse";
import { TERMS_VERSION } from "@/content/legal";
import { env } from "@/lib/config/env";
import { demoAuthPathAllowed, isDemoActor } from "@/modules/demo/guard";
import { auth } from "@/lib/auth";
const handler = toNextJsHandler(authServer);
export const GET = observedRoute(handler.GET);
async function observed_POST(request: Request) {
  try {
    if (!(await allowAuthRequest(request)))
      return Response.json(
        { message: "Too many authentication requests" },
        { status: 429, headers: { "cache-control": "no-store" } }
      );
  } catch {
    return Response.json(
      { message: "Authentication temporarily unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }
  // Public demo: a demo session may not change credentials, email, MFA or delete the account.
  if (env.DEMO_MODE_ENABLED && !demoAuthPathAllowed(new URL(request.url).pathname)) {
    const session = await auth().catch(() => null);
    if (session && isDemoActor(session.user.id))
      return Response.json(
        { message: "This action is disabled in the public demo." },
        { status: 403, headers: { "cache-control": "no-store" } }
      );
  }
  if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
    // The browser is not authoritative for the legal version or acceptance time.
    // Reject missing user consent, and stamp the actual server receipt time.
    const body: unknown = await request
      .clone()
      .json()
      .catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return Response.json({ message: "Invalid registration request" }, { status: 400 });
    const input = body as Record<string, unknown>;
    if (input.acceptTerms !== true || input.termsVersion !== TERMS_VERSION)
      return Response.json(
        { message: "Accept the current terms to create an account" },
        { status: 422 }
      );
    const site = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    // The local TLS browser fixture compiles a synthetic site key but has no
    // real Cloudflare secret. Exempt *only* the existing isolated test DB and
    // localhost test origin; real deployments fail closed on unpaired keys.
    const isolatedBrowserFixture =
      env.AUTH_ALLOW_TEST_EMAIL &&
      new URL(env.APP_URL).hostname === "localhost" &&
      new URL(env.DATABASE_URL).pathname === "/menuminute_test";
    if (
      env.NODE_ENV === "production" &&
      !isolatedBrowserFixture &&
      Boolean(site) !== Boolean(env.TURNSTILE_SECRET_KEY)
    )
      return Response.json(
        { message: "Registration verification is temporarily unavailable" },
        { status: 503 }
      );
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    // Consent is an HTTP-side guard, not an additional Better Auth user field.
    // Forward only fields that the authentication schema actually accepts.
    const accountFields = { ...input };
    delete accountFields.acceptTerms;
    // NextRequest has additional internal state: passing it to the Request
    // constructor can invoke a cross-realm clone and throw a private-field
    // brand error in the production standalone build. Construct from the URL
    // and explicit immutable metadata instead of passing the NextRequest.
    const normalized = new Request(request.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...accountFields,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: new Date().toISOString(),
      }),
    });
    return handler.POST(normalized);
  }
  return handler.POST(request);
}

export const POST = observedRoute(observed_POST);
