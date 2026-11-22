import { ValidationError } from "@/lib/errors";

/** Largest value a signed 64-bit money column can hold. */
const MAX_MINOR = 2n ** 63n - 1n;
const MAX_LINES = 100;

export type PricedCombo = {
  id: string;
  name: string;
  priceMinor: bigint;
  addons: { id: string; label: string; priceMinor: bigint }[];
};

export type SelectionLine = { comboId: string; addonIds: string[]; quantity: number };

export type TiffinQuotedLine = {
  comboId: string;
  name: string;
  unitMinor: bigint;
  addons: { id: string; label: string; priceMinor: bigint }[];
  quantity: number;
  lineMinor: bigint;
};

function checked(value: bigint): bigint {
  if (value > MAX_MINOR) throw new ValidationError("This order total is too large");
  return value;
}

export function priceLine(combo: PricedCombo, line: SelectionLine): TiffinQuotedLine {
  const { quantity } = line;
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new ValidationError("Quantity must be a whole number of at least 1");
  }
  const seen = new Set<string>();
  const addons: TiffinQuotedLine["addons"] = [];
  for (const id of line.addonIds) {
    if (seen.has(id)) throw new ValidationError("Each add-on can only be chosen once per item");
    seen.add(id);
    const addon = combo.addons.find((a) => a.id === id);
    if (!addon) throw new ValidationError("An add-on is not available for this combo");
    addons.push({ id: addon.id, label: addon.label, priceMinor: addon.priceMinor });
  }
  const unitMinor = checked(addons.reduce((sum, a) => sum + a.priceMinor, combo.priceMinor));
  const lineMinor = checked(unitMinor * BigInt(quantity));
  return { comboId: combo.id, name: combo.name, unitMinor, addons, quantity, lineMinor };
}

export function priceSelection(
  combos: readonly PricedCombo[],
  lines: readonly SelectionLine[]
): { lines: TiffinQuotedLine[]; totalMinor: bigint } {
  if (lines.length < 1 || lines.length > MAX_LINES) {
    throw new ValidationError(`Choose between 1 and ${MAX_LINES} items`);
  }
  const byId = new Map(combos.map((c) => [c.id, c]));
  const quoted: TiffinQuotedLine[] = [];
  let totalMinor = 0n;
  for (const line of lines) {
    const combo = byId.get(line.comboId);
    if (!combo) throw new ValidationError("A selected combo is not available");
    const priced = priceLine(combo, line);
    totalMinor = checked(totalMinor + priced.lineMinor);
    quoted.push(priced);
  }
  return { lines: quoted, totalMinor };
}
