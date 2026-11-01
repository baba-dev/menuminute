"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FloorOverview } from "@/modules/hospitality/floor-contracts";
import { buildFloorGlance, type TableDue } from "@/modules/hospitality/floor-glance";
import { FloorGlanceView, type FloorFilter } from "./floor/floor-glance-view";

/**
 * Dashboard miniature of the Dining Floor page: sections, real table shapes with their chairs,
 * seat occupancy and the order signals that need attention. Read-only; every table links to the
 * full floor page. Order activity is context and never changes who is seated.
 */
export function TableFloorMatrix({
  overview,
  dueByTable,
  currency,
  timezone,
  focusTableId,
}: {
  /** Null when floor data is unavailable or order access is restricted. */
  overview: FloorOverview | null;
  /** Unpaid totals and latest order per table, from the orders-only matrix. */
  dueByTable: Record<string, TableDue>;
  currency: string;
  timezone?: string;
  /** Highlights one table (for example from the command palette). */
  focusTableId?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FloorFilter>("all");
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") startRefresh(() => router.refresh());
    }, 20_000);
    return () => window.clearInterval(id);
  }, [router]);

  const glance = useMemo(
    () => (overview ? buildFloorGlance(overview, new Map(Object.entries(dueByTable))) : null),
    [overview, dueByTable]
  );
  const fmt = useMemo(() => {
    const dec =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    const f = new Intl.NumberFormat(undefined, { style: "currency", currency });
    return (minor: string) => f.format(Number(minor) / 10 ** dec);
  }, [currency]);
  const formatTime = useMemo(() => {
    const f = new Intl.DateTimeFormat(undefined, {
      ...(timezone ? { timeZone: timezone } : {}),
      hour: "numeric",
      minute: "2-digit",
    });
    return (iso: string) => f.format(new Date(iso));
  }, [timezone]);

  return (
    <FloorGlanceView
      overview={overview}
      glance={glance}
      filter={filter}
      refreshing={refreshing}
      fmt={fmt}
      formatTime={formatTime}
      focusTableId={focusTableId}
      onRefresh={() => startRefresh(() => router.refresh())}
      onFilter={setFilter}
    />
  );
}
