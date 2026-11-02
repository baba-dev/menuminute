import type { WizardDraft } from "./wizard-types";

/** Keep full onboarding intact; Quick Start only skips optional setup screens. */
export function visibleOnboardingSteps(quick: boolean): number[] {
  return quick ? [0, 1, 4] : [0, 1, 2, 3, 4];
}

export function nextOnboardingStep(current: number, quick: boolean): number {
  const steps = visibleOnboardingSteps(quick);
  const index = steps.indexOf(current);
  return steps[Math.min(steps.length - 1, index + 1)] ?? current;
}

export function previousOnboardingStep(current: number, quick: boolean): number {
  const steps = visibleOnboardingSteps(quick);
  const index = steps.indexOf(current);
  return steps[Math.max(0, index - 1)] ?? current;
}

/** No speculative table setup or paid-feature activation for QR-only owners. */
export function quickStartDraft(draft: WizardDraft): WizardDraft {
  return { ...draft, onboardingGoal: "qr_menu", tableCount: 0 };
}
