import { describe, expect, it } from "vitest";
import { demoRequestAllowed } from "../src/modules/demo/guard";
import { matchingStepUpTotp } from "../src/lib/totp-verification";

describe("phase A security boundaries", () => {
  it("never allows persistent organization provisioning for the shared demo", () => {
    expect(demoRequestAllowed("POST", "/api/organizations")).toBe(false);
  });
  it("does not accept malformed one-time codes", () => {
    expect(matchingStepUpTotp("otpauth://totp/MenuMinute?secret=JBSWY3DPEHPK3PXP", "123")).toBeNull();
  });
});
