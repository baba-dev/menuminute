import type { ComparisonDelta } from "./contracts";

/**
 * Returns the number of minor units per major currency unit (e.g. 2 decimals for USD/INR, 3 for OMR, 0 for JPY).
 */
export function currencyDecimals(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * Formats a minor-unit integer (e.g. 5000 paise = ₹50.00) using Intl.NumberFormat.
 */
export function formatMoney(minor: number | string | null | undefined, currency: string): string {
  if (minor == null) return "—";
  const num = typeof minor === "string" ? Number(minor) : minor;
  if (!Number.isFinite(num)) return "—";
  const dec = currencyDecimals(currency);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(num / 10 ** dec);
}

/**
 * Formats a minor-unit integer without the currency symbol (for tabular export or chart tooltips).
 */
export function formatMoneyAmount(
  minor: number | string | null | undefined,
  currency: string
): string {
  if (minor == null) return "";
  const num = typeof minor === "string" ? Number(minor) : minor;
  if (!Number.isFinite(num)) return "";
  const dec = currencyDecimals(currency);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(num / 10 ** dec);
}

/**
 * Computes period-over-period comparison delta with percentage change and trend direction.
 */
export function calculateDelta(current: number, baseline: number): ComparisonDelta {
  const diff = current - baseline;
  if (baseline <= 0) {
    return {
      absolutePaise: diff,
      percentageChange: null,
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
    };
  }
  const pct = Number(((diff / baseline) * 100).toFixed(1));
  return {
    absolutePaise: diff,
    percentageChange: pct,
    direction: pct > 0.1 ? "up" : pct < -0.1 ? "down" : "flat",
  };
}

/**
 * Formats minutes into human-friendly duration (e.g. 14.5 -> "14m 30s" or "8m").
 */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  const wholeMinutes = Math.floor(minutes);
  const seconds = Math.round((minutes - wholeMinutes) * 60);
  if (wholeMinutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${wholeMinutes}m`;
  return `${wholeMinutes}m ${seconds}s`;
}

/**
 * Escapes values according to RFC 4180 CSV specifications.
 */
export function escapeCsvCell(cell: unknown): string {
  if (cell == null) return "";
  const raw = String(cell);
  // Spreadsheet applications can execute untrusted formulas even in correctly quoted CSV.
  const str = /^\s*[=+@-]/u.test(raw) ? "'" + raw : raw;
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes rows into an RFC 4180 CSV string.
 */
export function serializeCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const bodyLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  return [headerLine, ...bodyLines].join("\r\n");
}
