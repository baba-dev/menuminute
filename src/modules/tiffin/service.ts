import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getPool } from "@/db";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
import {
  comboArchiveSchema,
  comboSaveSchema,
  overrideClearSchema,
  overrideSetSchema,
  slotSaveSchema,
  tiffinFlagEnabled,
  tiffinQuoteInputSchema,
  weekSetSchema,
  type SlotKind,
} from "./contracts";
import { priceSelection, type PricedCombo, type TiffinQuotedLine } from "./pricing";

/**
 * Tiffin & Home-Chef Hub phase 2 service. Authoring runs inside withOutlet and calls the 0115
 * definer functions (which re-check membership, outlet scope and outlet_type). The public week and
 * the quote are token-addressed reads of the 0116 functions over the shared pool: PostgreSQL is the
 * authority for QR revocation, publication and organization status on every call, and nothing here
 * is cached in Redis. With TIFFIN_ENABLED off every function behaves as if the feature did not exist.
 */

// ── Types ─────────────────────────────────────────────────────────────────────────────────────────

/** Authoring view (tiffin_menu_read). Prices are int32-bounded by the 0114 CHECKs, so numbers are exact. */
export type TiffinSlot = {
  id: string;
  kind: SlotKind;
  startMinute: number;
  endMinute: number;
  cutoffMinutesBefore: number;
  capacity: number | null;
  enabled: boolean;
};
export type TiffinCombo = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  archived: boolean;
  items: { id: string; label: string; quantity: number }[];
  addons: { id: string; label: string; priceMinor: number }[];
};
export type TiffinWeekEntry = { slotKind: SlotKind; weekday: number; comboIds: string[] };
export type TiffinOverride = {
  slotKind: SlotKind;
  localDate: string;
  closed: boolean;
  comboIds: string[];
};
export type TiffinMenu = {
  outlet: { id: string; currency: string; timezone: string; today: string };
  slots: TiffinSlot[];
  combos: TiffinCombo[];
  archivedCombos: TiffinCombo[];
  week: TiffinWeekEntry[];
  overrides: TiffinOverride[];
};
export type TiffinOverrideCleared = { slotKind: SlotKind; localDate: string; cleared: true };

/** Public combo: prices are decimal strings (minor units); no organization or internal ids. */
export type PublicCombo = {
  id: string;
  name: string;
  description: string;
  priceMinor: string;
  items: { label: string; quantity: number }[];
  addons: { id: string; label: string; priceMinor: string }[];
};
export type PublicSlot = {
  kind: SlotKind;
  startMinute: number;
  endMinute: number;
  /** True when at least one combo is offered. */
  open: boolean;
  /** True when a date override closed this slot for the day. */
  closed: boolean;
  /** Ordered ids of the combos offered; resolve them through PublicWeek.combos. */
  comboIds: string[];
};
/** Disabled (or unconfigured) slots are absent from `slots`. */
export type PublicDay = {
  localDate: string;
  weekday: number;
  slots: Partial<Record<SlotKind, PublicSlot>>;
};
/**
 * Each combo offered anywhere in `days` appears once in `combos` (keyed by id); slots carry only ids,
 * so the payload is bounded by the outlet's combos however many days are requested.
 */
export type PublicWeek = {
  outlet: { id: string; name: string; currency: string; timezone: string };
  today: string;
  combos: Record<string, PublicCombo>;
  days: PublicDay[];
};

/**
 * JSON-safe form of TiffinQuotedLine: every money value is a decimal string of minor units so a
 * bigint never travels through JSON as a number.
 */
export type SerializedQuotedLine = {
  comboId: string;
  name: string;
  unitMinor: string;
  addons: { id: string; label: string; priceMinor: string }[];
  quantity: number;
  lineMinor: string;
};
/** Pre-tax server quote. `totalMinor` is a decimal string of minor units. */
export type TiffinQuote = {
  outletId: string;
  currency: string;
  localDate: string;
  slotKind: SlotKind;
  lines: SerializedQuotedLine[];
  totalMinor: string;
};

type PublicOffer = {
  outletId: string;
  currency: string;
  localDate: string;
  slotKind: SlotKind;
  combos: PublicCombo[];
};

// ── Errors ────────────────────────────────────────────────────────────────────────────────────────

/** Messages raised with SQLSTATE 22023 by the 0115 functions; anything else becomes generic. */
const SAFE_22023 = new Set([
  "Invalid slot",
  "Invalid combo",
  "Combo not allowed",
  "Explicit repricing required",
  "Invalid week menu",
  "Slot not configured",
  "Invalid override",
]);

/**
 * Maps a database failure to a safe application error and throws it. Application errors pass
 * through unchanged; SQL text, constraint names and other database detail are never exposed.
 */
export function mapTiffinError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const inner = error instanceof Error && error.cause ? error.cause : error;
  const field = (key: "code" | "message") =>
    typeof inner === "object" && inner !== null && key in inner
      ? String((inner as Record<string, unknown>)[key])
      : "";
  const code = field("code");
  if (code === "54000") throw new ValidationError("You have reached the combo limit");
  if (code === "22023") {
    const message = field("message");
    throw new ValidationError(SAFE_22023.has(message) ? message : "Invalid tiffin menu change");
  }
  if (code === "42501") throw new ForbiddenError();
  if (code === "40P01" || code === "40001")
    throw new ConflictError("The tiffin menu was changed at the same time. Please try again.");
  const failure = new AppError("The tiffin menu request failed", "TIFFIN_FAILED", 500);
  Object.defineProperty(failure, "cause", { value: error, enumerable: false });
  throw failure;
}

const notFound = () => new NotFoundError("Menu");

function requireFlag() {
  if (!tiffinFlagEnabled()) throw notFound();
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

function parseAuthoring<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    throw new ValidationError("Invalid tiffin menu change", fieldErrors(parsed.error));
  return parsed.data;
}

function parseQuote(raw: unknown) {
  const parsed = tiffinQuoteInputSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const [first] = parsed.error.issues;
  const path = first?.path ?? [];
  const message =
    path.length === 1 && path[0] === "lines"
      ? "Choose between 1 and 100 items"
      : path[0] === "lines" && path[2] === "quantity"
        ? "Quantity must be a whole number of at least 1"
        : "Invalid quote request";
  throw new ValidationError(message, fieldErrors(parsed.error));
}

const token = z.string().min(1).max(128);
const localDate = tiffinQuoteInputSchema.shape.localDate;

// ── Authoring ─────────────────────────────────────────────────────────────────────────────────────

type Command = "slot" | "combo" | "week" | "override";
const COMMANDS: Record<Command, (outletId: string, payload: string) => SQL> = {
  slot: (o, p) => sql`select app_private.tiffin_slot_save(${o},${p}::jsonb) as r`,
  combo: (o, p) => sql`select app_private.tiffin_combo_save(${o},${p}::jsonb) as r`,
  week: (o, p) => sql`select app_private.tiffin_week_set(${o},${p}::jsonb) as r`,
  override: (o, p) => sql`select app_private.tiffin_override_set(${o},${p}::jsonb) as r`,
};

async function run<T>(
  actor: Actor,
  outletId: string,
  permission: "menu.read" | "menu.write",
  query: SQL
): Promise<T> {
  try {
    return await withOutlet(actor, outletId, permission, async (tx) => {
      const result = await tx.execute<{ r: T }>(query);
      return result.rows[0]!.r;
    });
  } catch (error) {
    mapTiffinError(error);
  }
}

function command<T>(actor: Actor, outletId: string, kind: Command, payload: unknown): Promise<T> {
  return run<T>(actor, outletId, "menu.write", COMMANDS[kind](outletId, JSON.stringify(payload)));
}

export async function readTiffinMenu(actor: Actor, outletId: string): Promise<TiffinMenu> {
  requireFlag();
  return run<TiffinMenu>(
    actor,
    outletId,
    "menu.read",
    sql`select app_private.tiffin_menu_read(${outletId}) as r`
  );
}

export async function saveSlot(actor: Actor, outletId: string, raw: unknown): Promise<TiffinSlot> {
  requireFlag();
  return command(actor, outletId, "slot", parseAuthoring(slotSaveSchema, raw));
}

/** Creates or fully replaces a combo (items and add-ons atomically); currency is the outlet's. */
export async function saveCombo(
  actor: Actor,
  outletId: string,
  raw: unknown
): Promise<TiffinCombo> {
  requireFlag();
  return command(actor, outletId, "combo", parseAuthoring(comboSaveSchema, raw));
}

/** Archives or restores one combo; archived combos are never offered or quoted. */
export async function setComboArchived(
  actor: Actor,
  outletId: string,
  raw: unknown
): Promise<TiffinCombo> {
  requireFlag();
  return command(actor, outletId, "combo", parseAuthoring(comboArchiveSchema, raw));
}

export async function setWeekMenu(
  actor: Actor,
  outletId: string,
  raw: unknown
): Promise<TiffinWeekEntry> {
  requireFlag();
  return command(actor, outletId, "week", parseAuthoring(weekSetSchema, raw));
}

export async function setOverride(
  actor: Actor,
  outletId: string,
  raw: unknown
): Promise<TiffinOverride> {
  requireFlag();
  return command(actor, outletId, "override", parseAuthoring(overrideSetSchema, raw));
}

export async function clearOverride(
  actor: Actor,
  outletId: string,
  raw: unknown
): Promise<TiffinOverrideCleared> {
  requireFlag();
  return command(actor, outletId, "override", parseAuthoring(overrideClearSchema, raw));
}

// ── Public ────────────────────────────────────────────────────────────────────────────────────────

async function publicQuery<T>(text: string, values: unknown[]): Promise<T | null> {
  try {
    const result = await getPool().query<{ r: T | null }>(text, values);
    return result.rows[0]?.r ?? null;
  } catch (error) {
    mapTiffinError(error);
  }
}

/**
 * The public weekly menu for a QR token: `days` (1–14, default 7) from `fromDate` (default the
 * outlet-local today). Null, indistinguishably, when the flag is off, the token is unknown or
 * revoked, the outlet is unpublished or not tiffin, the organization is inactive, or the range is
 * invalid or outside outlet-local today-1 .. today+366.
 */
export async function publicWeek(
  publicToken: string,
  fromDate?: string,
  days = 7
): Promise<PublicWeek | null> {
  if (!tiffinFlagEnabled()) return null;
  if (!token.safeParse(publicToken).success) return null;
  if (fromDate !== undefined && !localDate.safeParse(fromDate).success) return null;
  if (!Number.isInteger(days) || days < 1 || days > 14) return null;
  return publicQuery<PublicWeek>("select app_private.tiffin_public_week($1,$2::date,$3) as r", [
    publicToken,
    fromDate ?? null,
    days,
  ]);
}

function serializeLine(line: TiffinQuotedLine): SerializedQuotedLine {
  return {
    comboId: line.comboId,
    name: line.name,
    unitMinor: line.unitMinor.toString(),
    addons: line.addons.map((a) => ({
      id: a.id,
      label: a.label,
      priceMinor: a.priceMinor.toString(),
    })),
    quantity: line.quantity,
    lineMinor: line.lineMinor.toString(),
  };
}

/**
 * Prices a selection for one date and slot against the live menu, read in one query. Pre-tax; no
 * order, cutoff or capacity logic. NotFoundError in exactly the cases where publicWeek is null.
 */
export async function quoteSelection(publicToken: string, raw: unknown): Promise<TiffinQuote> {
  requireFlag();
  if (!token.safeParse(publicToken).success) throw notFound();
  const input = parseQuote(raw);
  const offer = await publicQuery<PublicOffer>(
    "select app_private.tiffin_public_offer($1,$2::date,$3) as r",
    [publicToken, input.localDate, input.slotKind]
  );
  if (!offer) throw notFound();
  const combos: PricedCombo[] = offer.combos.map((c) => ({
    id: c.id,
    name: c.name,
    priceMinor: BigInt(c.priceMinor),
    addons: c.addons.map((a) => ({ id: a.id, label: a.label, priceMinor: BigInt(a.priceMinor) })),
  }));
  const offered = new Set(combos.map((c) => c.id));
  for (const line of input.lines)
    if (!offered.has(line.comboId))
      throw new ValidationError("This combo is not offered for the chosen date and meal");
  const priced = priceSelection(combos, input.lines);
  return {
    outletId: offer.outletId,
    currency: offer.currency,
    localDate: input.localDate,
    slotKind: input.slotKind,
    lines: priced.lines.map(serializeLine),
    totalMinor: priced.totalMinor.toString(),
  };
}
