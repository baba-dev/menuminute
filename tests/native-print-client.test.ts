import { describe, expect, it } from "vitest";
import { ANDROID_PACKAGE, buildNativePrintIntentUrl } from "../src/lib/pos/native-print";

describe("native print intent URL", () => {
  it("is restricted to the MenuMinute package and carries only the grant", () => {
    const url = buildNativePrintIntentUrl(
      "abc_DEF-123.sig_456-xyz",
      "https://food.bababuilds.com/r"
    );
    expect(url).toBe(
      "intent://receipt?grant=abc_DEF-123.sig_456-xyz#Intent;scheme=menuminute-print;" +
        `package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent("https://food.bababuilds.com/r")};end`
    );
    expect(ANDROID_PACKAGE).toBe("com.bababuilds.menuminute");
  });

  it("refuses anything that is not a well-formed grant (no intent-extra injection)", () => {
    for (const bad of ["", "nodot", "a.b;end", "a.b#Intent", "a b.c", "a.b\nS.x=1", "a.b.c"])
      expect(() => buildNativePrintIntentUrl(bad, "https://x")).toThrow();
  });
});
