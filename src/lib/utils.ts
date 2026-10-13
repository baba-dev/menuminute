import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes safely, resolving conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a price from minor units (paise) to a display string.
 * e.g. 29900 -> "₹299"
 */
export function formatPrice(paise: number, currency: string = "INR"): string {
  const amount = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Convert a display price string to minor units.
 * e.g. 299 -> 29900
 */
export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert minor units to display amount.
 * e.g. 29900 -> 299
 */
export function fromPaise(paise: number): number {
  return paise / 100;
}

/**
 * Generate a URL-friendly slug from a string.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Truncate text with an ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Safe JSON parse — returns null on failure.
 */
export function safeJsonParse<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
