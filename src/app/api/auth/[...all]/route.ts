import { toNextJsHandler } from "better-auth/next-js";
import { authServer } from "@/lib/auth";
import { allowAuthRequest } from "@/lib/auth-abuse";
import { TERMS_VERSION } from "@/content/legal";
import { env } from "@/lib/config/env";
const handler = toNextJsHandler(authServer);
export const GET = handler.GET;
export async function POST(request: Request) {
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
  if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
    // The browser is not authoritative for the legal version or acceptance time.
    // Reject missing user consent, and stamp the actual server receipt time.
    const body: unknown = await request.clone().json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body))
      return Response.json({ message: "Invalid registration request" }, { status: 400 });
    const input = body as Record<string, unknown>;
    if (input.acceptTerms !== true || input.termsVersion !== TERMS_VERSION)
      return Response.json({ message: "Accept the current terms to create an account" }, { status: 422 });
    const site = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (env.NODE_ENV === "production" && Boolean(site) !== Boolean(env.TURNSTILE_SECRET_KEY))
      return Response.json({ message: "Registration verification is temporarily unavailable" }, { status: 503 });
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    const normalized = new Request(request, {
      headers,
      body: JSON.stringify({ ...input, termsVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() }),
    });
    return handler.POST(normalized);
  }
  return handler.POST(request);
}
