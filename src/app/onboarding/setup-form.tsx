"use client";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

/**
 * Super Onboarding Wizard setup form with progressive disclosure, GPS geocoordinates,
 * mediawork placeholders, and server-owned draft reconciliation.
 */
export function OnboardingForm({
  initialQuick = false,
  prefill,
}: {
  initialQuick?: boolean;
  prefill?: { name?: string; email?: string };
}) {
  return <OnboardingWizard initialQuick={initialQuick} prefill={prefill} />;
}
