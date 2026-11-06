/**
 * Merchant-supplied heat scale. Zero is the default/unspecified value and is
 * deliberately not advertised as an authoritative "no spice" promise.
 * Existing 1–4 ratings retain their meanings; level 5 is opt-in.
 */
const SPICE_LABELS = ["", "Mild", "Medium", "Hot", "Extra fiery", "Scorching"] as const;
export const MAX_SPICE_LEVEL = 5;

export function getSpicePresentation(level: number | undefined): {
  level: number;
  label: string;
} | null {
  if (level === undefined || !Number.isInteger(level) || level < 1 || level > MAX_SPICE_LEVEL)
    return null;
  return { level, label: SPICE_LABELS[level]! };
}
