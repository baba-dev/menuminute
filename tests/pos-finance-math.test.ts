import { describe, it, expect } from "vitest";
import { allocateDiscount, checkedMinor, decimalToMinor, genericTax, validateTender } from "../src/lib/pos/finance-math";

describe("POS #142 C: exact finance arithmetic without fiscal activation", () => {
  it("honors zero, two and three ISO currency exponents", () => {
    expect(decimalToMinor("500", "JPY")).toBe("500");
    expect(decimalToMinor("123.45", "INR")).toBe("12345");
    expect(decimalToMinor("1.234", "OMR")).toBe("1234");
    expect(() => decimalToMinor("1.1", "JPY")).toThrow();
    expect(() => decimalToMinor("1.234", "INR")).toThrow();
    expect(() => decimalToMinor("1.2345", "OMR")).toThrow();
    expect(() => decimalToMinor("01.00", "INR")).toThrow();
  });

  it("refuses noninteger, negative and unsafe monetary values", () => {
    for (const invalid of ["-1", "1.2", "01", "1e8", "2147483648", ""]) {
      expect(() => checkedMinor(invalid)).toThrow();
    }
    expect(checkedMinor("2147483647")).toBe(2147483647n);
  });

  it("uses exact cash change and never treats external references as provider captures", () => {
    expect(validateTender({
      method: "cash", amountMinor: "700", tenderedMinor: "1000", reference: null
    })).toEqual({ changeMinor: "300" });
    expect(validateTender({
      method: "upi_external", amountMinor: "700", tenderedMinor: "700", reference: "UPI-TEST-ONLY"
    })).toEqual({ changeMinor: "0" });
    expect(() => validateTender({
      method: "upi_external", amountMinor: "700", tenderedMinor: "1000", reference: "ABC"
    })).toThrow();
    expect(() => validateTender({
      method: "card_external", amountMinor: "700", tenderedMinor: "700", reference: null
    })).toThrow();
  });

  it("uses deterministic half-up tax without claiming the tax profile is lawful", () => {
    expect(genericTax("10000", 500, false)).toEqual({
      baseMinor: "10000", taxMinor: "500", totalMinor: "10500"
    });
    expect(genericTax("10500", 500, true)).toEqual({
      baseMinor: "10000", taxMinor: "500", totalMinor: "10500"
    });
    expect(genericTax("1", 5000, false).taxMinor).toBe("1");
    expect(() => genericTax("2147483647", 10000, false)).toThrow();
    expect(() => genericTax("1", 10001, true)).toThrow();
  });

  it("splits a discount with stable largest remainder and exact total", () => {
    expect(allocateDiscount(["100", "100", "100"], "2")).toEqual(["1", "1", "0"]);
    expect(allocateDiscount(["1", "2", "3"], "6")).toEqual(["1", "2", "3"]);
    expect(allocateDiscount(["700", "300"], "250")).toEqual(["175", "75"]);
    expect(() => allocateDiscount(["1", "2"], "4")).toThrow();
    expect(() => allocateDiscount(["0", "0"], "0")).toThrow();
  });
});
