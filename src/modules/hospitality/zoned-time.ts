/** Wall-clock time in an outlet's timezone <-> UTC instants, without a date library. */

function offsetMs(instant: number, timeZone: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const v = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const asUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** "2026-11-01T19:00" as written in `timeZone` -> the exact UTC ISO instant. */
export function zonedLocalToIso(local: string, timeZone: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error("Invalid date and time");
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wall;
  for (let i = 0; i < 3; i++) guess = wall - offsetMs(guess, timeZone);
  return new Date(guess).toISOString();
}

/** The next half hour (at least `leadMinutes` ahead) as "YYYY-MM-DDTHH:mm" in `timeZone`. */
export function nextHalfHourLocal(now: Date, timeZone: string, leadMinutes = 15): string {
  const base = now.getTime() + leadMinutes * 60_000;
  const rounded = Math.ceil(base / 1_800_000) * 1_800_000;
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(rounded));
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}
