"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, RefreshCw, UtensilsCrossed } from "lucide-react";
import { RubberStamp } from "@/components/ui/tactile-elements";

export type EightSixItem = { id: string; menuId: string; name: string; category: string; soldOut: boolean };

export function The86Board({ items, outletId, canManage, menuStudioHref = "/dashboard/menu" }: {
  items: EightSixItem[] | null;
  outletId: string;
  canManage: boolean;
  menuStudioHref?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unavailable = (items ?? []).filter((dish) => dish.soldOut);
  const available = (items ?? []).filter((dish) => !dish.soldOut);
  const toggle = async (dish: EightSixItem) => {
    if (busy || !canManage || !outletId || dish.menuId === "legacy") return;
    setBusy(dish.menuId + ":" + dish.id);
    setError(null);
    try {
      const path = "/api/catalog/" + encodeURIComponent(dish.menuId);
      const read = await fetch(path, { cache: "no-store" });
      if (!read.ok) throw new Error("Could not verify current menu availability. Refresh and retry.");
      const detail = (await read.json()) as {
        revision: number;
        canWrite?: boolean;
        overrides?: Array<{ dishId: string; outletId: string; priceMinor: number | null; soldOut: boolean | null }>;
      };
      if (detail.canWrite === false) throw new Error("You do not have permission to change this menu.");
      if (!Number.isInteger(detail.revision)) throw new Error("Menu revision unavailable. Refresh the page.");
      const override = detail.overrides?.find((row) => row.outletId === outletId && row.dishId === dish.id);
      const write = await fetch(path, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: crypto.randomUUID(),
          expectedRevision: detail.revision,
          action: "override",
          data: { outletId, dishId: dish.id, priceMinor: override?.priceMinor ?? null, soldOut: !dish.soldOut },
        }),
      });
      if (!write.ok) throw new Error(write.status === 409 ? "Availability changed elsewhere. Refresh and try again." : "Could not update availability. Your menu was not changed.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save availability.");
    } finally {
      setBusy(null);
    }
  };
  const section = (dish: EightSixItem) => {
    const key = dish.menuId + ":" + dish.id;
    return (
      <li key={key} className="flex flex-wrap items-center justify-between gap-2 border-b border-current/10 py-2 text-sm">
        <span className="min-w-0"><strong className="font-semibold">{dish.name}</strong><span className="ml-2 opacity-70">· {dish.category}</span></span>
        <span className="flex items-center gap-2">
          {dish.soldOut && <RubberStamp text="SOLD OUT" variant="sold-out" />}
          {canManage && <button type="button" disabled={busy !== null} onClick={() => void toggle(dish)} className="rounded-lg border border-current/30 px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50" aria-label={`${dish.soldOut ? "Restock" : "Mark sold out"} ${dish.name}`}>
            {busy === key ? "Saving…" : dish.soldOut ? "Restock" : "Mark sold out"}
          </button>}
        </span>
      </li>
    );
  };
  return (
    <section className="butcher-paper-surface my-6 rounded-xl p-5 dark:!border-stone-700 dark:!bg-[#1a1e21] dark:!text-stone-100" aria-labelledby="eight-six-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-current/15 pb-3">
        <h2 id="eight-six-heading" className="flex items-center gap-2 font-display text-lg font-bold"><UtensilsCrossed size={19} aria-hidden="true" /> The 86 Board · Availability</h2>
        {items && <span className="text-xs font-semibold" role="status">{unavailable.length} marked sold out</span>}
      </div>
      {items === null ? (
        <p className="py-5 text-sm">Publish a versioned menu to see live sold-out information here. No availability claim is being made.</p>
      ) : items.length === 0 ? (
        <p className="py-5 text-sm">No published dishes are available to review yet.</p>
      ) : (
        <>
          {unavailable.length ? <ul className="my-2">{unavailable.slice(0, 12).map(section)}</ul> : <p className="py-4 text-sm">No published dishes are currently marked sold out. This does not verify kitchen stock.</p>}
          {unavailable.length > 12 && <p className="text-xs">And {unavailable.length - 12} more sold-out dishes. Open Menu Studio to view all.</p>}
          {canManage && available.length > 0 && (
            <details className="my-3 rounded-lg border border-current/20 p-3"><summary className="cursor-pointer text-sm font-semibold">Mark another dish sold out ({available.length} available in menu)</summary>
              <ul className="mt-2">{available.slice(0, 12).map(section)}</ul>
              {available.length > 12 && <p className="text-xs">Showing the first 12 dishes. Open Menu Studio to manage more.</p>}
            </details>
          )}
        </>
      )}
      {error && <p role="alert" className="my-2 rounded-lg border border-red-500/40 p-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-current/15 pt-3">
        <span className="flex items-center gap-1 text-xs opacity-70"><RefreshCw size={13} aria-hidden="true" /> Refresh the dashboard for external changes</span>
        <Link href={menuStudioHref} className="inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2">Manage in Menu Studio <ArrowRight size={13} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
