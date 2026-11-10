import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANDROID_PACKAGE,
  buildNativePrintIntentUrl,
  nativePrintIsExpired,
  prepareNativePrint,
} from "../src/lib/pos/native-print";

afterEach(() => vi.unstubAllGlobals());

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

describe("two-tap native print handoff", () => {
  it("prepares an intent without navigating after the asynchronous request", async () => {
    const grant = "abc_DEF-123.sig_456-xyz";
    const expiresAt = new Date(Date.now() + 120_000).toISOString();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ grant, expiresAt }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const prepared = await prepareNativePrint(
      "sale-1",
      "80",
      "https://food.bababuilds.com/dashboard/pos/receipts/sale-1"
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/pos/receipts/sale-1/native-print-grant",
      expect.objectContaining({ method: "POST", credentials: "same-origin" })
    );
    expect(prepared.intentUrl).toBe(
      buildNativePrintIntentUrl(grant, "https://food.bababuilds.com/dashboard/pos/receipts/sale-1")
    );
    expect(nativePrintIsExpired(prepared)).toBe(false);
    expect(nativePrintIsExpired(prepared, prepared.expiresAtMs)).toBe(true);
  });

  it("rejects expired and malformed grant responses before exposing a print link", async () => {
    for (const body of [
      { grant: "abc.def", expiresAt: new Date(Date.now() - 1000).toISOString() },
      { grant: "abc.def", expiresAt: "not-a-date" },
      { grant: 42, expiresAt: new Date(Date.now() + 120_000).toISOString() },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
      );
      await expect(
        prepareNativePrint("sale-1", "58", "https://food.bababuilds.com/dashboard/pos")
      ).rejects.toThrow();
    }
  });
});
