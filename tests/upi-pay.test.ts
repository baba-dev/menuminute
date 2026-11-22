import { describe, expect, it } from "vitest";
import {
  buildUpiPayUri,
  inrMinorToDecimal,
  normalizePayeeName,
  parseUpiId,
  samplePayBlock,
} from "../src/lib/pos/upi";

describe("parseUpiId", () => {
  it("trims and lower-cases a valid ID", () => {
    expect(parseUpiId(" Spice@OkHDFC ")).toBe("spice@okhdfc");
  });
  it("rejects malformed or injection-shaped IDs", () => {
    for (const bad of [
      "a@b",
      "a b@ok",
      "a@b@c",
      "a@b&am=1",
      "a@ok#x",
      "é@ok",
      "",
      "a".repeat(300) + "@ok",
    ])
      expect(parseUpiId(bad), bad.slice(0, 20)).toBeNull();
  });
});

describe("normalizePayeeName", () => {
  it("keeps plain names and strips unsupported characters", () => {
    expect(normalizePayeeName("  Spice   Route Kitchen ")).toBe("Spice Route Kitchen");
    expect(normalizePayeeName("Café Déjà")).toBe("Cafe Deja");
    expect(normalizePayeeName("A&B=C#?%")).toBe("A&BC");
  });
  it("rejects names that are too short or too long", () => {
    expect(normalizePayeeName("A")).toBeNull();
    expect(normalizePayeeName("🍕🍕")).toBeNull();
    expect(normalizePayeeName("x".repeat(41))).toBeNull();
  });
});

describe("inrMinorToDecimal", () => {
  it("formats integer minor units without floating point", () => {
    expect(inrMinorToDecimal("84000")).toBe("840.00");
    expect(inrMinorToDecimal("5")).toBe("0.05");
    expect(inrMinorToDecimal("0007")).toBe("0.07");
    expect(inrMinorToDecimal("999999999999")).toBe("9999999999.99");
  });
  it("rejects zero, empty, fractional, negative and oversized values", () => {
    for (const bad of ["0", "000", "", "12.5", "-1", "1".repeat(13)])
      expect(inrMinorToDecimal(bad), bad).toBeNull();
  });
});

describe("buildUpiPayUri", () => {
  const base = {
    vpa: "spiceroute@okhdfc",
    payeeName: "Spice Route Kitchen",
    amountMinor: "84000",
    billNo: "1042",
  };
  it("builds the exact pre-filled link", () => {
    const uri = buildUpiPayUri({ ...base, payeeName: "Spice Route" });
    expect(uri).toBe(
      "upi://pay?pa=spiceroute@okhdfc&pn=Spice%20Route&am=840.00&cu=INR&tn=Bill%201042"
    );
    expect(new TextEncoder().encode(uri!).length).toBeLessThanOrEqual(84);
  });
  it("shortens the payee name when the full link would exceed 84 bytes", () => {
    const full = buildUpiPayUri(base)!;
    expect(new TextEncoder().encode(full).length).toBeLessThanOrEqual(84);
    expect(full).toContain("pn=Spice%20Route");
    expect(full).not.toContain("Kitchen");
  });
  it("shortens a very long payee name to stay within 84 bytes", () => {
    const uri = buildUpiPayUri({ ...base, payeeName: "The Extraordinarily Long Kitchen Name Co" });
    expect(uri).not.toBeNull();
    expect(new TextEncoder().encode(uri!).length).toBeLessThanOrEqual(84);
    expect(uri).toContain("pn=The");
  });
  it("cannot be made to add or split parameters", () => {
    const uri = buildUpiPayUri({ ...base, payeeName: "A&B=C" })!;
    const params = new URL(uri.replace("upi://pay", "https://x/pay")).searchParams;
    expect([...params.keys()]).toEqual(["pa", "pn", "am", "cu", "tn"]);
    expect(buildUpiPayUri({ ...base, vpa: "a@b&am=1" })).toBeNull();
    expect(buildUpiPayUri({ ...base, billNo: "10&x=1" })).toBeNull();
  });
  it("returns null when the link can never fit or the amount is invalid", () => {
    expect(buildUpiPayUri({ ...base, vpa: "a".repeat(120) + "@okhdfc" })).toBeNull();
    expect(buildUpiPayUri({ ...base, amountMinor: "0" })).toBeNull();
    expect(buildUpiPayUri({ ...base, payeeName: "" })).toBeNull();
  });
});

describe("samplePayBlock", () => {
  it("builds the settings preview with a fixed sample amount and bill number", () => {
    const block = samplePayBlock("Spice@OkHDFC", "Spice Route Kitchen")!;
    expect(block.amountLabel).toBe("Rs 840.00");
    expect(block.upiId).toBe("spice@okhdfc");
    expect(block.payeeName).toBe("Spice Route Kitchen");
    expect(block.uri).toContain("am=840.00");
    expect(block.uri).toContain("tn=Bill%201042");
  });
  it("returns null until both fields are valid", () => {
    expect(samplePayBlock("nope", "Spice")).toBeNull();
    expect(samplePayBlock("spice@okhdfc", "")).toBeNull();
  });
});
