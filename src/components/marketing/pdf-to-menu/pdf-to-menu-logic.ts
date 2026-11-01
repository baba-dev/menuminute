/**
 * Pure logic for the "Upload. Review. Live." section (home-v2 section 4). It mirrors the rule the
 * product enforces in src/modules/menu-import/review.ts: an imported menu is an untrusted candidate,
 * every field must be confirmed against its source, and nothing publishes automatically. Sample data
 * only; no file is uploaded or processed on the page.
 */
export type Flag = "unreviewed" | "needs_attention" | "unreadable";
export type Phase = "idle" | "scanning" | "review" | "published";

export type ImportRow = {
  id: string;
  name: string;
  /** Whole rupees as read from the source; null when the source was unreadable. */
  price: number | null;
  flag: Flag;
  /** Zero-based line on the source paper where this row was read. */
  line: number;
  /** True when the visitor typed or changed the price. */
  edited: boolean;
  confirmed: boolean;
};

export const MAX_PRICE = 99999;

export function seedRows(): ImportRow[] {
  return [
    row("r1", "Butter Chicken", 399, "unreviewed", 0),
    row("r2", "Biryani", 279, "unreviewed", 1),
    // The source reads "4O9": the scanner guessed 409 and flags it.
    row("r3", "Chettinad Chicken", 409, "needs_attention", 2),
    // Smudged on the source: no value, so the owner has to read it themselves.
    row("r4", "Amritsari Fish", null, "unreadable", 3),
  ];
}

function row(id: string, name: string, price: number | null, flag: Flag, line: number): ImportRow {
  return { id, name, price, flag, line, edited: false, confirmed: false };
}

/** A price must be a whole number from 0 to MAX_PRICE; anything else is not a price. */
export function parsePrice(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,5}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= MAX_PRICE ? value : null;
}

export function setPrice(rows: readonly ImportRow[], id: string, text: string): ImportRow[] {
  return rows.map((item) =>
    item.id === id
      ? { ...item, price: parsePrice(text), edited: true, confirmed: false } // editing re-opens review
      : item
  );
}

export const canConfirm = (item: ImportRow) => item.price !== null;

export function toggleConfirm(rows: readonly ImportRow[], id: string): ImportRow[] {
  return rows.map((item) =>
    item.id === id && (item.confirmed || canConfirm(item))
      ? { ...item, confirmed: !item.confirmed }
      : item
  );
}

export const confirmedCount = (rows: readonly ImportRow[]) =>
  rows.filter((item) => item.confirmed).length;

/** Publishing needs every row confirmed against the source, as the product requires. */
export const canPublish = (rows: readonly ImportRow[]) =>
  rows.length > 0 && rows.every((item) => item.confirmed && item.price !== null);

export function blockers(rows: readonly ImportRow[]): string[] {
  const out: string[] = [];
  const unreadable = rows.filter((item) => item.price === null);
  if (unreadable.length)
    out.push(`Enter the price for ${unreadable.map((item) => item.name).join(", ")}.`);
  const open = rows.filter((item) => item.price !== null && !item.confirmed);
  if (open.length)
    out.push(`Confirm ${open.length} more ${open.length === 1 ? "dish" : "dishes"}.`);
  return out;
}

export type RowStatus = { label: string; tone: "todo" | "attention" | "done" };

/** Status always carries a word, so it never depends on colour alone. */
export function statusOf(item: ImportRow): RowStatus {
  if (item.confirmed) return { label: "Confirmed", tone: "done" };
  if (item.price === null) return { label: "Price unreadable", tone: "attention" };
  if (item.flag === "needs_attention" && !item.edited)
    return { label: "Needs attention", tone: "attention" };
  return { label: "To confirm", tone: "todo" };
}

export function publish(phase: Phase, rows: readonly ImportRow[]): Phase {
  return phase === "review" && canPublish(rows) ? "published" : phase;
}

export function stepOf(phase: Phase): 1 | 2 | 3 {
  return phase === "published" ? 3 : phase === "review" ? 2 : 1;
}
