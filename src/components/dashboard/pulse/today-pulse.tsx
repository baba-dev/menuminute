"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  Hourglass,
  Minus,
  Table2,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import type { TodayPulse } from "@/modules/dashboard/today-pulse";
import { PulseTicker } from "./pulse-ticker";
import styles from "./today-pulse.module.css";

/** An open order that has waited this long is called out. A display hint, not a service promise. */
export const WAIT_ATTENTION_MINUTES = 20;
const MAX_AVATARS = 6;

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;

/** Which hours the sales bars cover: from shortly before the first sale (or 6 hours) to now. */
export function barWindow(hourly: readonly number[], hour: number): number[] {
  const firstSale = hourly.findIndex((v) => v > 0);
  const start = Math.max(0, Math.min(firstSale === -1 ? hour : firstSale, hour - 5));
  return Array.from({ length: hour - start + 1 }, (_, i) => start + i);
}

/**
 * Bento summary for the dashboard: sales with an hourly rhythm, top sellers, how long guests
 * have been waiting, and new guests. Read-only; every figure comes from this outlet's orders.
 */
export function TodayPulseBento({ pulse }: { pulse: TodayPulse | null }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") startRefresh(() => router.refresh());
    }, 60_000);
    return () => window.clearInterval(id);
  }, [router]);

  const currency = pulse?.currency ?? "INR";
  const money = useMemo(() => {
    const dec =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    const f = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: dec,
    });
    return (minor: number) => f.format(minor / 10 ** dec);
  }, [currency]);

  return (
    <section
      className={`mm-dashboard-ops-panel ${styles.panel}`}
      aria-labelledby="today-pulse-title"
      aria-busy={refreshing}
    >
      <div className="mm-ops-head">
        <div>
          <span className="mm-dashboard-eyebrow">TODAY</span>
          <h2 id="today-pulse-title">Today’s pulse</h2>
          <p>Sales, best sellers, waiting guests and new faces. Updated about every minute.</p>
        </div>
        <span className={styles.live} aria-hidden="true">
          <span className={styles.liveDot} /> Live
        </span>
      </div>

      {!pulse ? (
        <div className="mm-ops-empty" role="status">
          <Table2 size={26} aria-hidden="true" />
          <p>Today’s figures are unavailable or order access is restricted.</p>
        </div>
      ) : (
        <PulseGrid pulse={pulse} money={money} />
      )}

      <p className="mm-ops-disclaimer">
        Based on today’s orders in your outlet’s timezone, excluding cancelled and rejected ones. A
        new guest is a phone number with no earlier order here; numbers are counted, never shown.
      </p>
    </section>
  );
}

function PulseGrid({ pulse, money }: { pulse: TodayPulse; money: (minor: number) => string }) {
  const { sales, topSellers, wait, guests } = pulse;
  const hours = barWindow(sales.hourlyMinor, pulse.hour);
  const peak = Math.max(0, ...hours.map((h) => sales.hourlyMinor[h] ?? 0));
  const peakHour = peak > 0 ? hours.find((h) => sales.hourlyMinor[h] === peak) : undefined;
  const topQty = topSellers[0]?.quantity ?? 0;
  const delta = sales.vsYesterdayPct;
  const attention = (wait.oldestMinutes ?? 0) >= WAIT_ATTENTION_MINUTES;
  const guestTotal = guests.newGuests + guests.returningGuests;

  return (
    <div className={styles.bento}>
      <div className={styles.grid}>
        {/* Sales ───────────────────────────────────────────────────────── */}
        <article className={`${styles.tile} ${styles.sales}`} style={{ ["--i" as string]: 0 }}>
          <header className={styles.tileHead}>
            <span className={styles.chip}>
              <TrendingUp size={16} aria-hidden="true" />
            </span>
            <h3>Sales today</h3>
            {delta !== null && (
              <span
                className={styles.delta}
                data-tone={delta > 0 ? "up" : delta < 0 ? "down" : "flat"}
              >
                {delta > 0 ? (
                  <ArrowUpRight size={13} aria-hidden="true" />
                ) : delta < 0 ? (
                  <ArrowDownRight size={13} aria-hidden="true" />
                ) : (
                  <Minus size={13} aria-hidden="true" />
                )}
                {Math.abs(delta)}%<span className="sr-only"> versus this time yesterday</span>
              </span>
            )}
          </header>
          <p className={styles.big}>
            <PulseTicker value={sales.grossMinor} format={money} />
          </p>
          <p className={styles.sub}>
            {sales.orders === 0 ? (
              "No orders yet today. Your first sale will show up here."
            ) : (
              <>
                {sales.orders} {sales.orders === 1 ? "order" : "orders"} · {money(sales.aovMinor)}{" "}
                average
                {delta !== null && <> · vs. this time yesterday</>}
              </>
            )}
          </p>
          <div
            className={styles.bars}
            role="img"
            aria-label={
              peakHour === undefined
                ? "Hourly sales: none yet"
                : `Hourly sales, busiest hour so far ${hourLabel(peakHour)}`
            }
          >
            {hours.map((h, i) => {
              const v = sales.hourlyMinor[h] ?? 0;
              return (
                <span
                  key={h}
                  className={styles.bar}
                  data-now={h === pulse.hour ? "true" : undefined}
                  data-empty={v === 0 ? "true" : undefined}
                  title={`${hourLabel(h)} · ${money(v)}`}
                  style={{
                    ["--h" as string]: `${peak > 0 ? Math.max(8, Math.round((v / peak) * 100)) : 8}%`,
                    ["--n" as string]: i,
                  }}
                />
              );
            })}
          </div>
          <div className={styles.barAxis} aria-hidden="true">
            <span>{hourLabel(hours[0] ?? pulse.hour)}</span>
            <span>{hourLabel(pulse.hour)}</span>
          </div>
        </article>

        {/* Top sellers ─────────────────────────────────────────────────── */}
        <article
          className={`${styles.tile} ${styles.sellers}`}
          data-beam={topSellers.length > 0 ? "true" : undefined}
          style={{ ["--i" as string]: 1 }}
        >
          <header className={styles.tileHead}>
            <span className={styles.chip}>
              <Crown size={16} aria-hidden="true" />
            </span>
            <h3>Top sellers</h3>
          </header>
          {topSellers.length === 0 ? (
            <p className={styles.empty}>Your best sellers will appear after the first order.</p>
          ) : (
            <ol className={styles.rank}>
              {topSellers.map((dish, i) => (
                <li key={dish.dishId} className={styles.rankRow}>
                  <span className={styles.badge} data-first={i === 0 ? "true" : undefined}>
                    {i + 1}
                  </span>
                  <span className={styles.dish} title={dish.name}>
                    {dish.name}
                  </span>
                  <span className={styles.qty}>
                    ×<PulseTicker value={dish.quantity} />
                  </span>
                  <span className={styles.share} aria-hidden="true">
                    <span
                      style={{
                        width: `${topQty > 0 ? Math.round((dish.quantity / topQty) * 100) : 0}%`,
                      }}
                    />
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>

        {/* Waiting ─────────────────────────────────────────────────────── */}
        <article
          className={`${styles.tile} ${styles.wait}`}
          data-attention={attention ? "true" : undefined}
          style={{ ["--i" as string]: 2 }}
        >
          <header className={styles.tileHead}>
            <span className={styles.chip}>
              <Hourglass size={16} aria-hidden="true" />
            </span>
            <h3>Guests waiting</h3>
          </header>
          {wait.openOrders === 0 ? (
            <>
              <p className={styles.big}>0</p>
              <p className={styles.sub}>No open orders. Nobody is waiting right now.</p>
            </>
          ) : (
            <>
              <p className={styles.big}>
                <PulseTicker value={wait.averageMinutes ?? 0} />
                <small> min avg</small>
              </p>
              <p className={styles.sub}>
                {wait.openOrders} open {wait.openOrders === 1 ? "order" : "orders"} · oldest{" "}
                {wait.oldestMinutes ?? 0} min
                {attention && <strong> · needs a look</strong>}
              </p>
            </>
          )}
        </article>

        {/* New guests ──────────────────────────────────────────────────── */}
        <article className={`${styles.tile} ${styles.guests}`} style={{ ["--i" as string]: 3 }}>
          <header className={styles.tileHead}>
            <span className={styles.chip}>
              <UserPlus size={16} aria-hidden="true" />
            </span>
            <h3>New guests</h3>
          </header>
          <p className={styles.big}>
            <PulseTicker value={guests.newGuests} />
          </p>
          <div className={styles.avatars} aria-hidden="true">
            {Array.from({ length: Math.min(MAX_AVATARS, guestTotal) }, (_, i) => (
              <span key={i} data-new={i < guests.newGuests ? "true" : undefined} />
            ))}
            {guestTotal > MAX_AVATARS && <em>+{guestTotal - MAX_AVATARS}</em>}
          </div>
          <p className={styles.sub}>
            {guestTotal === 0
              ? guests.ordersWithoutContact > 0
                ? "No phone numbers captured on today’s orders."
                : "Waiting for the first guest."
              : `${guests.returningGuests} returning${
                  guests.ordersWithoutContact > 0
                    ? ` · ${guests.ordersWithoutContact} without a number`
                    : ""
                }`}
          </p>
        </article>
      </div>
    </div>
  );
}
