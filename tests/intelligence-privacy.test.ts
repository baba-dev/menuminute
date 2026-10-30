import { describe, expect, it } from "vitest";
import { minimizeProviderPrompt } from "../src/modules/intelligence/privacy";

describe("Ember provider-data minimization", () => {
  it("redacts common contact details, URLs and credentials", () => {
    const cleaned = minimizeProviderPrompt(
      "Call +91 98765 43210, email foo@example.com, open https://example.com/x?token=secret " +
      "and use sk_live_abcdefghijklmnopqrst."
    );
    expect(cleaned).not.toContain("98765");
    expect(cleaned).not.toContain("foo@example.com");
    expect(cleaned).not.toContain("example.com");
    expect(cleaned).not.toContain("abcdefghijklmnopqrst");
    expect(cleaned).toContain("[email removed]");
  });
  it("preserves ordinary food and sales questions", () => {
    expect(minimizeProviderPrompt("Do I sell Chole Bhature?")).toBe("Do I sell Chole Bhature?");
    expect(minimizeProviderPrompt("What are my sales for this week?"))
      .toBe("What are my sales for this week?");
  });
});
