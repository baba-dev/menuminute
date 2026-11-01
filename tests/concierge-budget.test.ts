import { describe, expect, it } from "vitest";
import { conciergeQuote } from "../src/modules/menu-product/concierge-budget";

describe("public Concierge monetary admission", () => {
  it("reserves positive upper-bound microUSD for each model call", () => {
    expect(conciergeQuote({ preferences: "vegetarian", dishes: [] })).toBeGreaterThan(0);
  });
  it("grows reserved spend with longer untrusted input", () => {
    expect(conciergeQuote({ body: "x".repeat(8000) })).toBeGreaterThan(
      conciergeQuote({ body: "x" })
    );
  });
});
