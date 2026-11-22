import { currencyExponent, displayToMinor } from "@/lib/money";

/**
 * Presentation helpers for the combo editor. The limits mirror the server contract as HINTS
 * only; the server stays authoritative and its messages are always shown to the owner.
 */
export const LIMITS = {
  name: 80,
  description: 300,
  label: 80,
  quantityMax: 99,
  itemsMax: 20,
  addonsMax: 20,
} as const;

export type ComboView = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  archived: boolean;
  items: { id: string; label: string; quantity: number }[];
  addons: { id: string; label: string; priceMinor: number }[];
};

export type ComboFormValues = {
  name: string;
  description: string;
  price: string;
  items: { key: string; label: string; quantity: string }[];
  addons: { key: string; label: string; price: string }[];
};

/** Plain decimal text for an input, using the currency's minor-unit exponent. Integers only. */
export function minorToInput(minor: number, currency: string): string {
  const exponent = currencyExponent(currency) ?? 2;
  if (exponent === 0) return String(minor);
  const digits = String(minor).padStart(exponent + 1, "0");
  return digits.slice(0, -exponent) + "." + digits.slice(-exponent);
}

/** Localised display price, for example "₹120.00" or "OMR 1.250". */
export function formatMinor(minor: number, currency: string): string {
  const exponent = currencyExponent(currency) ?? 2;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(minor / 10 ** exponent);
}

/** "Dal x1, Sabzi x1, Roti x3". */
export function summarizeItems(items: { label: string; quantity: number }[]): string {
  return items.map((item) => `${item.label} x${item.quantity}`).join(", ");
}

/** Returns minor units, or an owner-readable message. Never goes through a float. */
export function parsePrice(
  text: string,
  currency: string
): { ok: true; minor: number } | { ok: false; message: string } {
  const value = text.trim();
  const exponent = currencyExponent(currency);
  if (!value) return { ok: false, message: "Enter a price (0 is allowed)." };
  if (exponent === null) return { ok: false, message: "This outlet's currency is not supported." };
  if (!/^\d+(?:\.\d+)?$/.test(value))
    return { ok: false, message: "Use digits only, for example 120 or 120.50." };
  const fraction = value.split(".")[1] ?? "";
  if (fraction.length > exponent)
    return {
      ok: false,
      message:
        exponent === 0
          ? `${currency} has no decimal places.`
          : `${currency} allows up to ${exponent} decimal places.`,
    };
  try {
    return { ok: true, minor: displayToMinor(value, currency) };
  } catch {
    return { ok: false, message: "That price is too large." };
  }
}

export type FieldErrors = Record<string, string>;

export type ComboPayload = {
  id?: string;
  name: string;
  description: string;
  priceMinor: number;
  items: { label: string; quantity: number }[];
  addons: { label: string; priceMinor: number }[];
};

/** Local, hint-level validation. Returns the request body when the form is plausible. */
export function buildComboPayload(
  values: ComboFormValues,
  currency: string,
  id?: string
): { ok: true; payload: ComboPayload } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (!name) errors["name"] = "Enter a combo name.";
  else if (name.length > LIMITS.name)
    errors["name"] = `Keep the name to ${LIMITS.name} characters.`;
  if (values.description.length > LIMITS.description)
    errors["description"] = `Keep the description to ${LIMITS.description} characters.`;

  const price = parsePrice(values.price, currency);
  if (!price.ok) errors["price"] = price.message;

  if (values.items.length < 1) errors["items"] = "Add at least one item.";
  const items = values.items.map((row, index) => {
    const label = row.label.trim();
    if (!label) errors[`items.${index}.label`] = "Enter an item name.";
    else if (label.length > LIMITS.label)
      errors[`items.${index}.label`] = `Keep it to ${LIMITS.label} characters.`;
    const quantity = Number(row.quantity);
    if (
      !/^\d+$/.test(row.quantity.trim()) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > LIMITS.quantityMax
    )
      errors[`items.${index}.quantity`] = `Use a whole number from 1 to ${LIMITS.quantityMax}.`;
    return { label, quantity };
  });

  const addons = values.addons.map((row, index) => {
    const label = row.label.trim();
    if (!label) errors[`addons.${index}.label`] = "Enter an add-on name.";
    else if (label.length > LIMITS.label)
      errors[`addons.${index}.label`] = `Keep it to ${LIMITS.label} characters.`;
    const parsed = parsePrice(row.price, currency);
    if (!parsed.ok) errors[`addons.${index}.price`] = parsed.message;
    return { label, priceMinor: parsed.ok ? parsed.minor : 0 };
  });

  if (Object.keys(errors).length > 0 || !price.ok) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      ...(id ? { id } : {}),
      name,
      description: values.description,
      priceMinor: price.minor,
      items,
      addons,
    },
  };
}

/** Maps the server's `{message, fields}` body (zod paths such as `items.0.label`) to form errors. */
export function serverFieldErrors(fields: unknown): FieldErrors {
  const out: FieldErrors = {};
  if (!fields || typeof fields !== "object") return out;
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : undefined;
    if (typeof first !== "string") continue;
    out[key === "priceMinor" ? "price" : key.replace(/\.priceMinor$/, ".price")] = first;
  }
  return out;
}
