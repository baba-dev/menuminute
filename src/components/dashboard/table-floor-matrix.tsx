"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, RefreshCw, Table2 } from "lucide-react";
import type { FloorTable } from "@/modules/hospitality/floor-matrix";

export function TableFloorMatrix({
  tables,
  currency,
}: {
  tables: FloorTable[] | null;
  currency: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "active" | "unpaid">("all");
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") startRefresh(() => router.refresh());
    }, 20_000);
    return () => window.clearInterval(id);
  }, [router]);

  const rows = (tables ?? []).filter(
    (t) => filter === "all" || (filter === "active" ? t.activeOrders > 0 : t.unpaidOrders > 0)
  );
  const fmt = (minor: string) => {
    const dec = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      Number(minor) / 10 ** dec
    );
  };

  return (
    <section className="mm-dashboard-ops-panel" aria-labelledby="floor-matrix-title">
      <div className="mm-ops-head">
        <div>
          <span className="mm-dashboard-eyebrow">DINING ROOM</span>
          <h2 id="floor-matrix-title">Your dining floor</h2>
          <p>Outstanding table orders and unpaid balances. Updated approximately every 20 seconds.</p>
        </div>
        <div className="mm-ops-art-wrap" aria-hidden="true">
          <Image className="mm-ops-art mm-ops-art--light"
            src="/brand/dashboard/editorial/dining-room-empty-light.svg" alt="" width={110} height={83} />
          <Image className="mm-ops-art mm-ops-art--dark"
            src="/brand/dashboard/editorial/dining-room-empty-dark.svg" alt="" width={110} height={83} />
        </div>
      </div>
      <div className="mm-ops-actions">
        <button type="button" onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing} aria-label="Refresh dining floor">
          <RefreshCw size={15} aria-hidden="true" /> {refreshing ? "Refreshing…" : "Refresh floor"}
        </button>
        <Link href="/dashboard/qr-codes">Manage service points <ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
      {tables === null ? (
        <div className="mm-ops-empty" role="status">
          <Table2 size={26} aria-hidden="true" />
          <p>Floor data unavailable or order access is restricted. No table availability claim is being made.</p>
        </div>
      ) : tables.length === 0 ? (
        <div className="mm-ops-empty">
          <Table2 size={26} aria-hidden="true" />
          <p>No active dining tables configured. Add service points to manage table orders here.</p>
        </div>
      ) : (
        <>
          <div className="mm-ops-actions" role="group" aria-label="Filter dining room order activity">
            {(["all", "active", "unpaid"] as const).map((key) => {
              const count = key === "all" ? tables.length :
                tables.filter((row) => key === "active" ? row.activeOrders > 0 : row.unpaidOrders > 0).length;
              return <button key={key} type="button" aria-pressed={filter === key}
                onClick={() => setFilter(key)}>
                {key === "all" ? "All tables" : key === "active" ? "Active orders" : "Unpaid tabs"} ({count})
              </button>;
            })}
          </div>
          <ul className="mm-ops-items">
            {rows.map((table) => (
              <li className="mm-ops-item" key={table.id}>
                <strong>Table {table.tableNumber}</strong>
                <span>{table.unpaidOrders > 0 ? "Unpaid" : table.activeOrders > 0 ? "Order active" : "No open tickets"}</span>
                {table.label && <p>{table.label}</p>}
                <p>{table.activeOrders} active orders · {table.unpaidOrders} unpaid</p>
                {table.unpaidOrders > 0 && <strong>Due: {fmt(table.dueMinor)}</strong>}
                {table.latestOrderId && (
                  <div className="mm-ops-actions">
                    <Link href={"/dashboard/pos?attachOrder=" + encodeURIComponent(table.latestOrderId)}>
                      View in Till
                    </Link>
                    <Link href="/dashboard/orders">Orders Rail</Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {rows.length === 0 && <p role="status">No tables match this filter.</p>}
        </>
      )}
      <p className="mm-ops-disclaimer">Order activity is not a physical occupancy sensor.</p>
    </section>
  );
}
