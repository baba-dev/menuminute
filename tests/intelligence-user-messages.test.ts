import { describe, expect, it } from "vitest";
import { failureCopy } from "../src/modules/intelligence/user-messages";

const CODES = [
  "disabled",
  "not_configured",
  "unsupported_capability",
  "invalid_request",
  "authentication",
  "quota_exhausted",
  "rate_limited",
  "provider_unavailable",
  "provider_error",
  "invalid_response",
  "timeout",
  "cancelled",
  "processing_failed",
];

describe("Ember failure copy", () => {
  it("covers every failure code with jargon-free text", () => {
    for (const code of CODES) {
      const copy = failureCopy(code);
      expect(copy.title.length).toBeGreaterThan(10);
      expect(copy.next.length).toBeGreaterThan(10);
      expect(`${copy.title} ${copy.next}`).not.toMatch(/_|error code|HTTP|\b5\d\d\b|token|API/i);
    }
  });
  it("falls back safely for unknown or missing codes", () => {
    expect(failureCopy("something_new")).toEqual(failureCopy("processing_failed"));
    expect(failureCopy(null)).toEqual(failureCopy("processing_failed"));
  });
});
