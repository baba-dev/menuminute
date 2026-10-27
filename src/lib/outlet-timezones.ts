/**
 * Restaurant timezones are IANA identities, never UTC offsets or browser device defaults.
 * Keep this module pure so onboarding and server commands use the same normalization.
 * PostgreSQL compatibility is checked separately at the write boundary.
 */
const LEGACY_ALIASES: Readonly<Record<string, string>> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Europe/Kiev": "Europe/Kyiv",
  "US/Eastern": "America/New_York",
  "US/Pacific": "America/Los_Angeles",
};

export function canonicalOutletTimezone(value: string): string {
  const trimmed = value.trim();
  return LEGACY_ALIASES[trimmed] ?? trimmed;
}

export function isRuntimeTimezone(value: string): boolean {
  if (!value || value.length > 100 || !/^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+-]+)*$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function canonicalTimezoneOptions(): string[] {
  const raw = ["UTC", "Asia/Kolkata", "Asia/Muscat", ...Intl.supportedValuesOf("timeZone")];
  return [...new Set(raw.map(canonicalOutletTimezone))].filter(isRuntimeTimezone).sort();
}

/** Human-friendly preview is always computed from the outlet's zone, not the device zone. */
export function outletLocalClock(timezone: string, instant: Date): string {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(instant);
}
