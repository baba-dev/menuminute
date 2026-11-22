/**
 * Pure helpers for the weekly menu and date override editors. Weekdays follow the server
 * convention everywhere: 0 = Sunday … 6 = Saturday. "Today" is always the outlet-local date.
 */

export type SlotKind = "lunch" | "dinner";
export const SLOT_KINDS: readonly SlotKind[] = ["lunch", "dinner"];
export const SLOT_LABEL: Record<SlotKind, string> = { lunch: "Lunch", dinner: "Dinner" };
export const MAX_COMBOS_PER_CELL = 50;
export const OVERRIDE_WINDOW_DAYS = 366;

export type ComboRef = { id: string; name: string; archived?: boolean };
export type WeekEntry = { slotKind: SlotKind; weekday: number; comboIds: string[] };
export type SlotView = {
  kind: SlotKind;
  startMinute: number;
  endMinute: number;
  cutoffMinutesBefore: number;
  capacity: number | null;
  enabled: boolean;
};
export type OverrideView = {
  slotKind: SlotKind;
  localDate: string;
  closed: boolean;
  comboIds: string[];
};

export const cellKey = (slotKind: SlotKind, weekday: number) => `${slotKind}:${weekday}`;

/** Grid model: every (slot, weekday) cell holds the ordered ids of combos that can be offered. */
export function buildGrid(
  week: readonly WeekEntry[],
  combos: readonly ComboRef[]
): Record<string, string[]> {
  const selectable = new Set(combos.filter((c) => !c.archived).map((c) => c.id));
  const grid: Record<string, string[]> = {};
  for (const slot of SLOT_KINDS) for (let d = 0; d < 7; d++) grid[cellKey(slot, d)] = [];
  for (const entry of week) {
    if (!Number.isInteger(entry.weekday) || entry.weekday < 0 || entry.weekday > 6) continue;
    const key = cellKey(entry.slotKind, entry.weekday);
    if (!(key in grid)) continue;
    grid[key] = entry.comboIds.filter((id, i, all) => selectable.has(id) && all.indexOf(id) === i);
  }
  return grid;
}

/** Returns a new list with the item at index moved by one place; unchanged at the boundaries. */
export function moveItem<T>(list: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  const copy = [...list];
  if (index < 0 || index >= copy.length || target < 0 || target >= copy.length) return copy;
  [copy[index], copy[target]] = [copy[target]!, copy[index]!];
  return copy;
}

/** Combos that may still be added to a cell: not archived and not already in it. */
export function addableCombos<T extends ComboRef>(combos: readonly T[], ids: readonly string[]) {
  return combos.filter((c) => !c.archived && !ids.includes(c.id));
}

// ── Weekday names ─────────────────────────────────────────────────────────────────────────────────

/** 2023-01-01 was a Sunday, so 2023-01-01 + weekday gives that weekday in UTC. */
export function weekdayName(
  weekday: number,
  locale?: string,
  style: "long" | "short" = "long"
): string {
  const date = new Date(Date.UTC(2023, 0, 1 + weekday));
  return new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" }).format(date);
}

/** First day of the week as 0 = Sunday … 6, from Intl.Locale weekInfo when the runtime has it. */
export function firstWeekday(locale?: string): number {
  try {
    const loc = new Intl.Locale(locale ?? "en-US") as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = typeof loc.getWeekInfo === "function" ? loc.getWeekInfo() : loc.weekInfo;
    if (info && info.firstDay >= 1 && info.firstDay <= 7) return info.firstDay % 7;
  } catch {
    // fall through to Sunday
  }
  return 0;
}

/** The seven server weekdays (0 = Sunday) in the locale's display order. */
export function orderedWeekdays(locale?: string): number[] {
  const first = firstWeekday(locale);
  return Array.from({ length: 7 }, (_, i) => (first + i) % 7);
}

// ── Outlet-local dates ────────────────────────────────────────────────────────────────────────────

/** The calendar date (YYYY-MM-DD) of an instant in the outlet's IANA timezone. */
export function zonedToday(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

export function isValidLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function addDays(localDate: string, days: number): string {
  const d = new Date(`${localDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function overrideWindow(today: string): { min: string; max: string } {
  return { min: today, max: addDays(today, OVERRIDE_WINDOW_DAYS) };
}

/** Client hint only: the server is the authority on the allowed window. */
export function checkOverrideDate(value: string, today: string): string | null {
  if (!value) return "Choose a date.";
  if (!isValidLocalDate(value)) return "Enter a valid date.";
  const { min, max } = overrideWindow(today);
  if (value < min) return `Choose ${min} or a later date. Past dates cannot be changed.`;
  if (value > max)
    return `Choose a date on or before ${max} (within ${OVERRIDE_WINDOW_DAYS} days).`;
  return null;
}

/** Formats a YYYY-MM-DD as a readable date without any timezone shift. */
export function formatLocalDate(localDate: string, locale?: string): string {
  const d = new Date(`${localDate}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

// ── Slot window ───────────────────────────────────────────────────────────────────────────────────

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.trunc(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** HH:MM to minutes since local midnight; null when malformed. "24:00" is the end of day. */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (m > 59 || h > 24 || (h === 24 && m !== 0)) return null;
  return h * 60 + m;
}

export type WindowResult =
  { ok: true; startMinute: number; endMinute: number } | { ok: false; error: string };

export function validateWindow(start: string, end: string): WindowResult {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === null || s > 1439) return { ok: false, error: "Enter a valid start time." };
  if (e === null || e < 1) return { ok: false, error: "Enter a valid end time." };
  if (e <= s) return { ok: false, error: "End time must be after the start time on the same day." };
  return { ok: true, startMinute: s, endMinute: e };
}

/** Used only when a slot has never been saved; the server requires every field on first save. */
export const DEFAULT_SLOTS: Record<SlotKind, SlotView> = {
  lunch: {
    kind: "lunch",
    startMinute: 11 * 60 + 30,
    endMinute: 14 * 60 + 30,
    cutoffMinutesBefore: 60,
    capacity: null,
    enabled: true,
  },
  dinner: {
    kind: "dinner",
    startMinute: 19 * 60,
    endMinute: 22 * 60,
    cutoffMinutesBefore: 60,
    capacity: null,
    enabled: true,
  },
};

export function slotFor(slots: readonly SlotView[], kind: SlotKind): SlotView {
  return slots.find((s) => s.kind === kind) ?? DEFAULT_SLOTS[kind];
}

/** Full slot save body; cutoff and capacity are carried over unchanged from the stored slot. */
export function buildSlotPayload(
  stored: SlotView,
  window: { startMinute: number; endMinute: number },
  enabled: boolean
) {
  return {
    kind: stored.kind,
    startMinute: window.startMinute,
    endMinute: window.endMinute,
    cutoffMinutesBefore: stored.cutoffMinutesBefore,
    capacity: stored.capacity,
    enabled,
  };
}
