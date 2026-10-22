// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRememberedAccount,
  completePendingLoginPreference,
  readRememberedAccount,
  stageLoginPreference,
} from "../src/lib/remembered-account";

describe("optional untrusted returning-account hint", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  it("stores only a validated email after a completed remembered sign-in", () => {
    stageLoginPreference("Owner@Example.com", true);
    expect(readRememberedAccount()).toBeNull();
    completePendingLoginPreference();
    expect(readRememberedAccount()).toBe("owner@example.com");
    expect(JSON.stringify(localStorage)).not.toContain("password");
  });
  it("does not leave a hint for browser-session-only sign-in", () => {
    stageLoginPreference("owner@example.com", true);
    completePendingLoginPreference();
    stageLoginPreference("second@example.com", false);
    completePendingLoginPreference();
    expect(readRememberedAccount()).toBeNull();
  });
  it("ignores corrupt/untrusted storage and supports explicit clearing", () => {
    localStorage.setItem("menuminute.remembered-email.v1", JSON.stringify({ token: "fake" }));
    expect(readRememberedAccount()).toBeNull();
    stageLoginPreference("owner@example.com", true);
    completePendingLoginPreference();
    clearRememberedAccount();
    expect(readRememberedAccount()).toBeNull();
  });
});
