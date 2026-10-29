import { describe, expect, it } from "vitest";
import { receiptHref, readTerminalReceiptSettings, saveTerminalReceiptSettings } from "../src/lib/pos/receipt-printing";

describe("receipt browser transport boundaries", () => {
  it("encodes only a validated sale identity and known format", () => {
    expect(receiptHref("sale-abc_123", "58", true)).toBe("/dashboard/pos/receipts/sale-abc_123?paper=58&auto=1");
    expect(receiptHref("sale-abc_123", "80", false)).toBe("/dashboard/pos/receipts/sale-abc_123?paper=80");
    expect(() => receiptHref("../other", "80", true)).toThrow();
  });
  it("does not require storage or a payment provider to display the order pad", () => {
    expect(readTerminalReceiptSettings("outlet-one")).toEqual({enabled:false,paper:"80"});
    // Storage may be unavailable; writing the preference must not block the order.
    const oldWindow = (globalThis as {window?:unknown}).window;
    try {
      Object.defineProperty(globalThis,"window",{ configurable:true, value:{localStorage:{setItem(){throw Error("denied")},getItem(){throw Error("denied")}}} });
      expect(() => saveTerminalReceiptSettings("outlet-one",{enabled:true,paper:"58"})).not.toThrow();
      expect(readTerminalReceiptSettings("outlet-one")).toEqual({enabled:false,paper:"80"});
    } finally {
      Object.defineProperty(globalThis,"window",{ configurable:true, value:oldWindow });
    }
  });
});
