"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Receipt, RefreshCw, Table2, TimerReset } from "lucide-react";
import type { FloorOverview } from "@/modules/hospitality/floor-contracts";
import { floorHeadline } from "@/modules/hospitality/floor-headline";
import {
  buildFloorGlance,
  describeGlanceTable,
  type GlanceTable,
  type TableDue,
} from "@/modules/hospitality/floor-glance";
import { MiniTable } from "./floor/mini-table";
import styles from "./floor/floor-glance.module.css";

type Filter = "all" | "active" | "unpaid";

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
  const [filter, setFilter] = useState<Filter>("all");
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

  const matches = (g: GlanceTable) =>
    filter === "all" || (filter === "active" ? g.table.activeOrders > 0 : g.table.unpaidOrders > 0);
  const count = (key: Filter) =>
    !overview
      ? 0
      : key === "all"
        ? overview.tables.length
        : overview.tables.filter((t) =>
            key === "active" ? t.activeOrders > 0 : t.unpaidOrders > 0
          ).length;

  const headline = overview ? floorHeadline(overview, formatTime) : null;
  const empty = overview !== null && overview.tables.length === 0;

  return (
    <section className="mm-dashboard-ops-panel" aria-labelledby="floor-matrix-title">
      <div className="mm-ops-head">
        <div>
          <span className="mm-dashboard-eyebrow">DINING ROOM</span>
          <h2 id="floor-matrix-title">Your dining floor</h2>
          <p>
            {headline
              ? `${headline.headline} Updated approximately every 20 seconds.`
              : "Seats, tables and unpaid balances. Updated approximately every 20 seconds."}
          </p>
        </div>
        <div className="mm-ops-art-wrap" aria-hidden="true">
          <Image
            className="mm-ops-art mm-ops-art--light"
            src="/brand/dashboard/editorial/dining-room-empty-light.svg"
            alt=""
            width={110}
            height={83}
          />
          <Image
            className="mm-ops-art mm-ops-art--dark"
            src="/brand/dashboard/editorial/dining-room-empty-dark.svg"
            alt=""
            width={110}
            height={83}
          />
        </div>
      </div>
      <div className="mm-ops-actions">
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
          aria-label="Refresh dining floor"
        >
          <RefreshCw size={15} aria-hidden="true" /> {refreshing ? "Refreshing…" : "Refresh floor"}
        </button>
        <Link href="/dashboard/floor">
          View full floor <ArrowRight size={14} aria-hidden="true" />
        </Link>
        <Link href="/dashboard/qr-codes">Manage service points</Link>
      </div>

      {!overview || !glance ? (
        <div className="mm-ops-empty" role="status">
          <Table2 size={26} aria-hidden="true" />
          <p>
            Floor data unavailable or order access is restricted. No table availability claim is
            being made.
          </p>
        </div>
      ) : empty ? (
        <div className="mm-ops-empty">
          <Table2 size={26} aria-hidden="true" />
          <p>
            No active dining tables configured.{" "}
            <Link href="/dashboard/floor">Add tables and chairs</Link> to see your floor here.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.stats} role="group" aria-label="Floor at a glance">
            <div className={styles.stat}>
              <span className={styles.statLabel}>Tables in use</span>
              <span className={styles.statValue}>
                {glance.totals.tablesInUse}
                <small> / {glance.totals.tables}</small>
              </span>
              <span className={styles.statDetail}>by seated guests</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Seats taken</span>
              <span className={styles.statValue}>
                {glance.totals.seatsTaken}
                <small> / {glance.totals.seats}</small>
              </span>
              <div
                className={styles.meter}
                role="img"
                aria-label={`${glance.fillPct}% of seats taken`}
              >
                <span style={{ width: `${glance.fillPct}%` }} />
              </div>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Orders</span>
              <span className={styles.statValue}>
                {glance.openOrders}
                <small> open</small>
              </span>
              <span className={styles.statDetail}>
                {glance.unpaidTabs} unpaid {glance.unpaidTabs === 1 ? "tab" : "tabs"}
              </span>
            </div>
          </div>

          <div
            className="mm-ops-actions"
            role="group"
            aria-label="Filter dining room order activity"
            style={{ marginTop: 12 }}
          >
            {(["all", "active", "unpaid"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {key === "all" ? "All tables" : key === "active" ? "Active orders" : "Unpaid tabs"}{" "}
                ({count(key)})
              </button>
            ))}
          </div>

          {glance.groups.map((group) => (
            <section key={group.id} className={styles.group} aria-label={group.name}>
              {(overview.sections.length > 0 || group.id !== "__none") && (
                <h3 className={styles.groupHead}>
                  {group.color && (
                    <span className={styles.dot} style={{ ["--dot" as string]: group.color }} />
                  )}
                  {group.name}
                </h3>
              )}
              <ul className={styles.map}>
                {group.tables.map((g) => {
                  const t = g.table;
                  const label = describeGlanceTable(g, fmt);
                  return (
                    <li key={t.id} id={"table-" + t.id}>
                      <Link
                        className={styles.tile}
                        href={"/dashboard/floor#table-" + t.id}
                        aria-label={label}
                        title={label}
                        data-dim={matches(g) ? undefined : "true"}
                        data-focused={t.id === focusTableId ? "true" : undefined}
                        aria-current={t.id === focusTableId ? "true" : undefined}
                      >
                        <MiniTable table={t} tone={g.tone} label={label} />
                        <span className={styles.caption}>
                          {t.maxOccupancy > 0
                            ? `${t.currentOccupancy}/${t.maxOccupancy}`
                            : "no chairs"}
                          {t.unpaidOrders > 0 ? (
                            <span className={styles.flag} aria-hidden="true" />
                          ) : t.activeOrders > 0 ? (
                            <span className={styles.flag} data-kind="active" aria-hidden="true" />
                          ) : t.stale ? (
                            <span className={styles.flag} data-kind="stale" aria-hidden="true" />
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {glance.hiddenTables > 0 && (
            <p className={styles.more}>
              +{glance.hiddenTables} more {glance.hiddenTables === 1 ? "table" : "tables"} in the{" "}
              <Link href="/dashboard/floor">full floor view</Link>.
            </p>
          )}

          {glance.attention.length > 0 ? (
            <ul className={styles.attention} aria-label="Needs attention">
              {glance.attention.map((a) => (
                <li className={styles.attentionRow} key={a.tableId + a.kind}>
                  {a.kind === "unpaid" ? (
                    <Receipt size={15} aria-hidden="true" />
                  ) : (
                    <TimerReset size={15} aria-hidden="true" />
                  )}
                  <strong>{a.tableName}</strong>
                  {a.kind === "unpaid" ? (
                    <span>{a.dueMinor !== "0" ? `Due: ${fmt(a.dueMinor)}` : "Unpaid"}</span>
                  ) : (
                    <span>Still occupied? No open order for a few hours.</span>
                  )}
                  {a.kind === "unpaid" && a.latestOrderId ? (
                    <>
                      <Link
                        href={"/dashboard/pos?attachOrder=" + encodeURIComponent(a.latestOrderId)}
                      >
                        View in Till
                      </Link>
                      <Link href="/dashboard/orders">Orders Rail</Link>
                    </>
                  ) : (
                    <Link href={"/dashboard/floor#table-" + a.tableId}>Open table</Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.more} role="status">
              Nothing needs attention on the floor right now.
            </p>
          )}
        </>
      )}
      <p className="mm-ops-disclaimer">
        Seats reflect what staff mark on the dining floor. Order activity is not a physical
        occupancy sensor.
      </p>
    </section>
  );
}
