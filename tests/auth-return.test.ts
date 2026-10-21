import { describe, it, expect } from "vitest";
import { safeReturnPath } from "../src/lib/auth-return";
describe("same-origin post-auth return destinations", () => {
  it("allows a local invitation and retains query strings", () => {
    expect(safeReturnPath("/invite/abc123?source=mail")).toBe("/invite/abc123?source=mail");
    expect(safeReturnPath("/onboarding")).toBe("/onboarding");
  });
  it("rejects protocol relative, encoded escapes, authentication/API loops and cross origins", () => {
    for (const input of [
      "//evil.example",
      "/\\evil",
      "/%2f%2fevil",
      "/%5cevil",
      "https://evil.example",
      "/api/auth/sign-out",
      "/login",
      "/two-factor",
      "/verify-email",
      "/forgot-password",
      "/reset-password?token=a",
    ]) {
      expect(safeReturnPath(input)).toBe("/dashboard");
    }
    expect(safeReturnPath(null, "")).toBe("");
  });
});
