"use client";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

/**
 * Super Onboarding Wizard setup form with progressive disclosure, GPS geocoordinates,
 * mediawork placeholders, and server-owned draft reconciliation.
 */
export function OnboardingForm({
  initialQuick = false,
  prefill,
  tiffinOffered = false,
}: {
  initialQuick?: boolean;
  prefill?: { name?: string; email?: string };
  tiffinOffered?: boolean;
}) {
  return (
    <OnboardingWizard initialQuick={initialQuick} prefill={prefill} tiffinOffered={tiffinOffered} />
  );
}
