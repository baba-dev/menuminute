"use client";

import Link from "next/link";
import { ArrowRight, Flame, UtensilsCrossed } from "lucide-react";
import { RubberStamp } from "@/components/ui/tactile-elements";

export type EightSixItem = {
  id: string;
  name: string;
  category: string;
  soldOut: boolean;
};

export function The86Board({
  items = [],
  menuStudioHref = "/dashboard/menu",
}: {
  items?: EightSixItem[];
  menuStudioHref?: string;
}) {
  const soldOutItems = items.filter((i) => i.soldOut);

  return (
    <div className="my-6 overflow-hidden rounded-xl">
      {/* Chalkboard slate in dark mode, butcher paper in light mode */}
      <div className="chalkboard-surface block p-5 dark:block light:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="text-amber-400" size={18} aria-hidden="true" />
            <h3 className="font-handwriting text-xl font-bold tracking-wide text-amber-200">
              The 86 Board · Kitchen Callouts
            </h3>
          </div>
          <span className="font-mono text-xs uppercase tracking-wider text-stone-400">
            {soldOutItems.length === 0 ? "Line is 100% active" : `${soldOutItems.length} dishes 86'd`}
          </span>
        </div>

        {soldOutItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <RubberStamp text="ALL STATIONS CLEAR" variant="paid" className="mb-2" />
            <p className="font-handwriting text-base text-stone-300">
              Every dish is ready to fire. No items currently 86&apos;d on the pass.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/10 py-2">
            {soldOutItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-stone-100">{item.name}</span>
                  <span className="ml-2 text-xs text-stone-400">({item.category})</span>
                </div>
                <RubberStamp text="86'd" variant="sold-out" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex justify-end border-t border-white/10 pt-3">
          <Link
            href={menuStudioHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200"
          >
            Adjust dish availability in Menu Studio <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Butcher paper version for light theme */}
      <div className="butcher-paper-surface block p-5 dark:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-900/10 pb-3">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="text-amber-800" size={18} aria-hidden="true" />
            <h3 className="font-display text-lg font-bold tracking-tight text-amber-950">
              The 86 Board · Kitchen Callouts
            </h3>
          </div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-900/70">
            {soldOutItems.length === 0 ? "Line is 100% active" : `${soldOutItems.length} dishes 86'd`}
          </span>
        </div>

        {soldOutItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <RubberStamp text="ALL STATIONS CLEAR" variant="paid" className="mb-2" />
            <p className="font-handwriting text-base text-amber-950">
              Every dish is ready to fire. No items currently 86&apos;d on the pass.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-amber-900/10 py-2">
            {soldOutItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-stone-900">{item.name}</span>
                  <span className="ml-2 text-xs text-stone-500">({item.category})</span>
                </div>
                <RubberStamp text="86'd" variant="sold-out" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-2 flex justify-end border-t border-amber-900/10 pt-3">
          <Link
            href={menuStudioHref}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-950"
          >
            Adjust dish availability in Menu Studio <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
