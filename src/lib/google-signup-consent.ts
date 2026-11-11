import { TERMS_VERSION } from "@/content/legal";

// A Google registration is explicitly requested, with the same legal consent as email signup.
// This data is promoted into Better Auth's signed, server-only OAuth state, never accepted
// directly from provider profile fields or a callback query string.
export function googleSignupServerContext(additionalData: unknown, now = new Date()) {
  if (
    !additionalData ||
    typeof additionalData !== "object" ||
    Array.isArray(additionalData) ||
    (additionalData as Record<string, unknown>).acceptTerms !== true ||
    (additionalData as Record<string, unknown>).termsVersion !== TERMS_VERSION
  )
    return null;
  return {
    googleSignupTermsVersion: TERMS_VERSION,
    googleSignupAcceptedAt: now.toISOString(),
  };
}

export function googleSignupConsentFromState(state: unknown, now = Date.now()) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return null;
  const serverContext = (state as Record<string, unknown>).serverContext;
  if (!serverContext || typeof serverContext !== "object" || Array.isArray(serverContext))
    return null;
  const consent = serverContext as Record<string, unknown>;
  if (
    consent.googleSignupTermsVersion !== TERMS_VERSION ||
    typeof consent.googleSignupAcceptedAt !== "string"
  )
    return null;
  const acceptedAt = Date.parse(consent.googleSignupAcceptedAt);
  // Never trust a client-provided timestamp, stale OAuth state or future acceptance.
  if (!Number.isFinite(acceptedAt) || acceptedAt > now || now - acceptedAt > 15 * 60 * 1000)
    return null;
  return { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date(acceptedAt) };
}
