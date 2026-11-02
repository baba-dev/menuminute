import { describe, expect, it } from "vitest";
import { AiCreditsExhaustedError } from "../src/lib/errors";
import { AppError } from "../src/lib/errors";

describe("AI credits exhausted error", () => {
  it("says what was used, when it resets and that manual editing still works", () => {
    const e = new AiCreditsExhaustedError(10, "2026-12-01T00:00:00.000Z", "Ordering");
    expect(e).toBeInstanceOf(AppError);
    expect(e.code).toBe("AI_CREDITS_EXHAUSTED");
    expect(e.statusCode).toBe(402);
    expect(e.message).toBe(
      "You have used all 10 AI credits for this month. They reset on 1 Dec. Editing by hand still works."
    );
    expect(e.limit).toBe(10);
    expect(e.upgradeTo).toBe("Ordering");
  });
  it("formats large allowances with separators and allows no upgrade target", () => {
    const e = new AiCreditsExhaustedError(1000, "2027-01-01T00:00:00Z", null);
    expect(e.message).toContain("all 1,000 AI credits");
    expect(e.upgradeTo).toBeNull();
  });
});
