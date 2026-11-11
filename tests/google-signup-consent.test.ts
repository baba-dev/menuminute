import { describe, expect, it } from "vitest";
import { TERMS_VERSION } from "../src/content/legal";
import {
  googleSignupConsentFromState,
  googleSignupServerContext,
} from "../src/lib/google-signup-consent";

describe("explicit Google registration legal consent", () => {
  const now = new Date("2026-11-11T04:30:00.000Z");
  it("only stamps the current policy after affirmative consent", () => {
    expect(googleSignupServerContext(undefined, now)).toBeNull();
    expect(
      googleSignupServerContext({ acceptTerms: "true", termsVersion: TERMS_VERSION }, now)
    ).toBeNull();
    expect(googleSignupServerContext({ acceptTerms: true, termsVersion: "old" }, now)).toBeNull();
    expect(
      googleSignupServerContext({ acceptTerms: true, termsVersion: TERMS_VERSION }, now)
    ).toEqual({
      googleSignupTermsVersion: TERMS_VERSION,
      googleSignupAcceptedAt: now.toISOString(),
    });
  });
  it("accepts only fresh server-side OAuth state", () => {
    const context = googleSignupServerContext(
      { acceptTerms: true, termsVersion: TERMS_VERSION },
      now
    )!;
    const state = { serverContext: context };
    expect(googleSignupConsentFromState(state, now.getTime() + 60_000)).toEqual({
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: now,
    });
    expect(googleSignupConsentFromState({ additionalData: context }, now.getTime())).toBeNull();
    expect(
      googleSignupConsentFromState(
        { serverContext: { ...context, googleSignupTermsVersion: "old" } },
        now.getTime()
      )
    ).toBeNull();
    expect(googleSignupConsentFromState(state, now.getTime() + 15 * 60_000 + 1)).toBeNull();
    expect(googleSignupConsentFromState(state, now.getTime() - 1)).toBeNull();
    expect(
      googleSignupConsentFromState(
        { serverContext: { ...context, googleSignupAcceptedAt: "not-a-date" } },
        now.getTime()
      )
    ).toBeNull();
  });
});
