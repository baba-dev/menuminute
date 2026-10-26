"use client";

import React from "react";
import { ChefHat, Sparkles, UtensilsCrossed } from "lucide-react";

/**
 * 1. Rubber Ink Stamp
 * Tilted, distressed ink border, uppercase stamped typography.
 */
export function RubberStamp({
  text,
  variant = "sold-out",
  className = "",
}: {
  text: string;
  variant?: "sold-out" | "paid" | "complete" | "confirmed" | "chef-pick";
  className?: string;
}) {
  return (
    <span
      className={`stamp-badge stamp-badge--${variant} ${className}`}
      aria-label={`Status: ${text}`}
    >
      {variant === "chef-pick" && <Sparkles size={11} aria-hidden="true" />}
      {variant === "sold-out" && <span aria-hidden="true">✕</span>}
      {text}
    </span>
  );
}

/**
 * 2. Chef's Sticky Note
 * Tactile paper note with Kalam handwriting and a washi-tape corner or brass paperclip.
 */
export function ChefStickyNote({
  text,
  author = "Chef's Note",
  pinStyle = "tape",
  className = "",
}: {
  text: string;
  author?: string;
  pinStyle?: "tape" | "clip";
  className?: string;
}) {
  return (
    <aside
      className={`relative my-3 rounded-lg border border-amber-200/80 bg-amber-50/90 p-4 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/30 ${className}`}
      aria-label={author}
    >
      {pinStyle === "tape" && <div className="tape-strip" aria-hidden="true" />}
      <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-amber-800 uppercase dark:text-amber-400">
        <ChefHat size={14} aria-hidden="true" />
        <span>{author}</span>
      </div>
      <p className="font-handwriting mt-1.5 text-base leading-snug text-amber-950 dark:text-amber-200">
        {text}
      </p>
    </aside>
  );
}

/**
 * 3. Mise-en-place Empty State
 * Hospitality-crafted waiting state for empty menus, quiet shifts, and zero tickets.
 */
export function MiseEnPlaceEmpty({
  title,
  description,
  action,
  icon,
  className = "",
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`my-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 p-8 text-center sm:p-12 dark:border-stone-800 dark:bg-stone-900/30 ${className}`}
    >
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-100/80 text-amber-800 shadow-sm dark:bg-amber-950/60 dark:text-amber-300">
        {icon ?? <UtensilsCrossed size={28} aria-hidden="true" />}
      </div>
      <h3 className="font-display text-xl font-bold tracking-tight text-stone-900 sm:text-2xl dark:text-stone-100">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-600 sm:text-base dark:text-stone-400">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
/**
 * 4. Tabletop Welcome Banner
 * Gives public QR diners a sense of physical place and atmospheric hospitality.
 */
export function TableWelcome({
  tableNumber,
  pointLabel,
  outletName,
  servicePeriod,
  className = "",
}: {
  tableNumber?: string | null;
  pointLabel?: string | null;
  outletName: string;
  servicePeriod?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 bg-amber-50/60 px-4 py-2.5 text-xs text-stone-700 dark:border-stone-800 dark:bg-stone-900/50 dark:text-stone-300 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        <span className="font-medium text-stone-900 dark:text-stone-100">{outletName}</span>
        {servicePeriod && (
          <span className="text-stone-500 dark:text-stone-400">· {servicePeriod}</span>
        )}
      </div>
      {(tableNumber || pointLabel) && (
        <span className="inline-flex items-center gap-1 rounded bg-stone-200/80 px-2 py-0.5 font-mono text-[11px] font-bold text-stone-800 dark:bg-stone-800 dark:text-stone-200">
          {pointLabel || `TABLE ${tableNumber}`}
        </span>
      )}
    </div>
  );
}

