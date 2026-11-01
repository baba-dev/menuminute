// Pure helpers for the Today's pulse read model (no database or environment access).

/** Outlet-local calendar date (YYYY-MM-DD) and hour for an instant. */
export function outletDayParts(now: Date, timezone: string, dayOffset = 0) {
  const at = new Date(now.getTime() + dayOffset * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** Percentage change, rounded. Null when there is no baseline to compare with. */
export function percentChange(current: number, baseline: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0) return null;
  return Math.round(((current - baseline) / baseline) * 100);
}
