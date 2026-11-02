import { describe, expect, it } from "vitest";
import { initialWizardDraft } from "../src/components/onboarding/wizard-types";
import {
  quickStartDraft,
  nextOnboardingStep,
  previousOnboardingStep,
  visibleOnboardingSteps,
} from "../src/components/onboarding/quick-menu-flow";

describe("first menu quick start", () => {
  it("shortens only the QR creation journey without removing full setup", () => {
    expect(visibleOnboardingSteps(true)).toEqual([0, 1, 4]);
    expect(visibleOnboardingSteps(false)).toEqual([0, 1, 2, 3, 4]);
    expect(nextOnboardingStep(1, true)).toBe(4);
    expect(previousOnboardingStep(4, true)).toBe(1);
    expect(nextOnboardingStep(1, false)).toBe(2);
  });
  it("preserves user settings but never pre-creates tables or grants a paid goal", () => {
    const source = {
      ...initialWizardDraft,
      name: "Quick Café",
      country: "OM",
      currency: "OMR",
      timezone: "Asia/Muscat",
      onboardingGoal: "full_operations" as const,
    };
    const target = quickStartDraft(source);
    expect(target).toMatchObject({
      name: "Quick Café",
      country: "OM",
      currency: "OMR",
      timezone: "Asia/Muscat",
      onboardingGoal: "qr_menu",
      tableCount: 0,
    });
    expect(source.tableCount).toBe(10);
  });
});
