export type GrantPreset = "first_user" | "trial_7" | "trial_30" | "paid" | "custom";
export type GrantStatus = "revoked" | "expired" | "scheduled" | "expiring" | "active";
export const grantPresetDetails: Record<
  GrantPreset,
  { label: string; days: number | null; description: string }
> = {
  first_user: {
    label: "First User Bonus",
    days: 90,
    description: "90-day operator-approved launch incentive; no payment is collected.",
  },
  trial_7: { label: "7-Day Trial", days: 7, description: "A seven-day trial of Online Ordering." },
  trial_30: {
    label: "30-Day Trial",
    days: 30,
    description: "A thirty-day trial of Online Ordering.",
  },
  paid: {
    label: "Paid Subscription",
    days: 30,
    description: "30-day manual billing window. Verify payment separately before granting.",
  },
  custom: { label: "Custom", days: null, description: "Choose an explicit start and end time." },
};
export function localDateTimeInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function grantEndForPreset(preset: GrantPreset, start: Date): Date | null {
  const days = grantPresetDetails[preset].days;
  return days === null ? null : new Date(start.getTime() + days * 86400000);
}
export function grantStatus(
  grant: { startsAt: Date | string; endsAt: Date | string; revokedAt: Date | string | null },
  now = new Date()
): GrantStatus {
  if (grant.revokedAt) return "revoked";
  if (new Date(grant.endsAt).getTime() <= now.getTime()) return "expired";
  if (new Date(grant.startsAt).getTime() > now.getTime()) return "scheduled";
  if (new Date(grant.endsAt).getTime() <= now.getTime() + 7 * 86400000) return "expiring";
  return "active";
}
export function grantOverlaps(
  interval: { startsAt: Date | string; endsAt: Date | string },
  other: { startsAt: Date | string; endsAt: Date | string; revokedAt: Date | string | null }
): boolean {
  return (
    !other.revokedAt &&
    new Date(interval.startsAt).getTime() < new Date(other.endsAt).getTime() &&
    new Date(other.startsAt).getTime() < new Date(interval.endsAt).getTime()
  );
}
