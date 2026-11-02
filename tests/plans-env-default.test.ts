import { describe, expect, it } from "vitest";
import { planOverflowSweepEnabled } from "../src/modules/plans/overflow";

describe("plan limits ship enabled", () => {
  it("the overflow sweep runs unless explicitly switched off", () => {
    expect(planOverflowSweepEnabled({})).toBe(true);
    expect(planOverflowSweepEnabled({ PLAN_LIMITS_ENFORCED: "true" })).toBe(true);
    expect(planOverflowSweepEnabled({ PLAN_LIMITS_ENFORCED: "false" })).toBe(false);
  });
});
