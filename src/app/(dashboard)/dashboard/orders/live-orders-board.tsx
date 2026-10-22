"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChefHat,
  History,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { playOrderChime } from "@/lib/sound";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { ServicePulseRail, Ticket, RailEmpty } from "@/components/orders/ticket";
import type {
  Activity,
  HistoryResult,
  MerchantOrder,
  ServicePulse,
} from "@/components/orders/types";
import { filterRail, laneFor, statusLabels } from "@/modules/orders/presentation";

type Tab = "active" | "history";
type Rail = "all" | "incoming" | "preparing" | "ready";
const lanes = [
  { id: "incoming", title: "Incoming", hint: "Needs your attention", Icon: BellRing },
  { id: "preparing", title: "In preparation", hint: "Accepted and in progress", Icon: ChefHat },
  {
    id: "ready",
    title: "Ready for handoff",
    hint: "Awaiting serving or collection",
    Icon: CheckCircle2,
  },
] as const;
const declineReasons = [
  "Kitchen is at maximum capacity",
  "Dish or ingredient is currently sold out",
  "Restaurant is closing for service",
  "Other kitchen reason",
];
const emptyPulse: ServicePulse = {
  pending: 0,
  preparing: 0,
  ready: 0,
  active: 0,
  completedToday: 0,
};

async function responseData<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      (payload && typeof payload.message === "string" ? payload.message : null) ||
        (response.status === 403
          ? "Your session no longer has access to this outlet."
          : response.status === 409
            ? "This order changed on another device. Please synchronize."
            : "The request could not be completed.")
    );
  return payload as T;
}

export function LiveOrdersBoard({
  organizationId,
  outletId,
  outletName,
  currency,
  timezone,
}: {
  organizationId: string;
  outletId: string;
  outletName: string;
  currency: string;
  timezone: string;
}) {
  const base =
    "/api/organizations/" +
    encodeURIComponent(organizationId) +
    "/outlets/" +
    encodeURIComponent(outletId) +
    "/orders";
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [pulse, setPulse] = useState<ServicePulse | null>(null);
  const [overflow, setOverflow] = useState(false);
  const [tab, setTab] = useState<Tab>("active");
  const [rail, setRail] = useState<Rail>("all");
  const [mode, setMode] = useState("all");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [historyStatus, setHistoryStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [selected, setSelected] = useState<MerchantOrder | null>(null);
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [activityTruncated, setActivityTruncated] = useState(false);
  const [declining, setDeclining] = useState<MerchantOrder | null>(null);
  const [declineReason, setDeclineReason] = useState(declineReasons[0]);
  const [paying, setPaying] = useState<MerchantOrder | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(new Set<string>());
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [sound, setSound] = useState(false);
  const soundRef = useRef(false);
  const previousPending = useRef<Set<string> | null>(null);
  const refreshController = useRef<AbortController | null>(null);
  const [now, setNow] = useState(0);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const restore = window.setTimeout(
      () => setSound(window.localStorage.getItem("menuminute.orders.sound") === "enabled"),
      0
    );
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.clearTimeout(restore);
      window.clearInterval(id);
    };
  }, []);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  const refresh = useCallback(async () => {
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    setRefreshing(true);
    try {
      const [railResponse, pulseResponse] = await Promise.all([
        fetch(base + "/workspace?view=rail", { cache: "no-store", signal: controller.signal }),
        fetch(base + "/workspace?view=pulse", { cache: "no-store", signal: controller.signal }),
      ]);
      const [live, counts] = await Promise.all([
        responseData<{ orders: MerchantOrder[]; overflow: boolean }>(railResponse),
        responseData<ServicePulse>(pulseResponse),
      ]);
      if (controller.signal.aborted) return;
      const pending = new Set(
        live.orders.filter((order) => order.status === "pending").map((order) => order.id)
      );
      if (
        soundRef.current &&
        previousPending.current &&
        [...pending].some((id) => !previousPending.current?.has(id))
      ) {
        try {
          playOrderChime();
        } catch {
          /* browser audio may be blocked */
        }
      }
      previousPending.current = pending;
      setOrders(live.orders);
      setPulse(counts);
      setOverflow(live.overflow);
      setLastSync(new Date().toISOString());
      setError(null);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Could not synchronize orders.");
    } finally {
      if (refreshController.current === controller) setRefreshing(false);
    }
  }, [base]);

  useEffect(() => {
    const start = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    const onReturn = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      refreshController.current?.abort();
      window.clearTimeout(start);
      window.clearInterval(interval);
      window.removeEventListener("online", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refresh]);

  useEffect(() => {
    if (tab !== "history") return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      view: "history",
      status: historyStatus,
      mode,
      payment,
      page: String(page),
      search: debounced,
    });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const load = async () => {
      setHistoryBusy(true);
      try {
        const result = await responseData<HistoryResult>(
          await fetch(base + "/workspace?" + params.toString(), {
            cache: "no-store",
            signal: controller.signal,
          })
        );
        if (!controller.signal.aborted) {
          setHistory(result);
          setError(null);
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Could not load order history.");
      } finally {
        if (!controller.signal.aborted) setHistoryBusy(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [tab, historyStatus, mode, payment, page, debounced, from, to, base, historyRevision]);

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await responseData<{ events: Activity[]; truncated: boolean }>(
          await fetch(base + "/" + encodeURIComponent(selectedId) + "/activity", {
            cache: "no-store",
            signal: controller.signal,
          })
        );
        if (!controller.signal.aborted) {
          setActivity(result.events);
          setActivityTruncated(result.truncated);
        }
      } catch {
        if (!controller.signal.aborted) setActivity([]);
      }
    };
    void load();
    return () => controller.abort();
  }, [base, selectedId]);

  const currentSelected =
    selected &&
    (orders.find((order) => order.id === selected.id) ??
      history?.orders.find((order) => order.id === selected.id) ??
      selected);
  const show = (lane: string) => {
    if (lane === "today") {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      setHistoryStatus("completed");
      setFrom(date);
      setTo(date);
      setPage(0);
      setTab("history");
    } else if (lane === "history") setTab("history");
    else {
      setTab("active");
      setRail(lane === "incoming" || lane === "preparing" || lane === "ready" ? lane : "all");
    }
    document.getElementById("service-rail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  async function mutate(order: MerchantOrder, target: string, reason?: string, isPayment = false) {
    if (busyRef.current.has(order.id)) return;
    busyRef.current.add(order.id);
    setBusyId(order.id);
    setError(null);
    try {
      const result = await fetch(
        base + "/" + encodeURIComponent(order.id) + (isPayment ? "/payment" : "/transition"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isPayment
              ? { expectedVersion: order.version, paymentStatus: "paid", paymentMethod: "cash" }
              : {
                  targetStatus: target,
                  expectedVersion: order.version,
                  ...(reason ? { reason } : {}),
                }
          ),
        }
      );
      if (result.status === 409) {
        await refresh();
        setError(
          "The ticket changed or its acceptance window expired. The authoritative queue was reloaded."
        );
        return;
      }
      await responseData(result);
      setDeclining(null);
      setPaying(null);
      setHistoryRevision((value) => value + 1);
      await refresh();
    } catch (cause) {
      await refresh();
      setError(
        (cause instanceof Error ? cause.message : "The outcome is uncertain.") +
          " If connectivity was lost, synchronize before attempting the action again."
      );
    } finally {
      busyRef.current.delete(order.id);
      setBusyId(null);
    }
  }

  const visible = filterRail(orders, query, mode);
  const statusCounts = pulse ?? emptyPulse;
  const isFiltered = Boolean(query || mode !== "all");
  return (
    <div className="product service-counter" data-testid="service-counter">
      <header className="sc-hero">
        <div className="sc-topbar">
          <nav aria-label="Breadcrumb" className="sc-breadcrumb">
            <Link href="/dashboard">Workspace</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Orders</span>
          </nav>
          <div className="sc-top-actions">
            <ThemeControl />
            <Link href="/account" className="sc-account">
              Account ↗
            </Link>
          </div>
        </div>
        <div className="sc-hero-copy">
          <span className="sc-eyebrow">SERVICE DESK / LIVE ORDERS</span>
          <h1>The Service Counter.</h1>
          <p className="sc-hero-tagline">Every order, beautifully in motion.</p>
          <p className="sc-hero-intro">
            Keep {outletName}&apos;s service moving from the first incoming ticket to the final
            handoff. <span className="sc-currency">· {currency}</span>
          </p>
          <div className="sc-hero-actions">
            <button type="button" className="sc-hero-primary" onClick={() => show("all")}>
              View live queue <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button type="button" className="sc-hero-secondary" onClick={() => show("history")}>
              Order history <History size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <span className="sc-hero-credit" aria-hidden="true">
          MENUMINUTE · SERVICE COUNTER
        </span>
      </header>
      <main className="sc-body">
        <ServicePulseRail pulse={pulse} show={show} />
        <section id="service-rail" className="sc-operations" aria-labelledby="sc-title">
          <div className="sc-section-top">
            <div>
              <span className="sc-eyebrow">THE SERVICE RAIL</span>
              <h2 id="sc-title">Your orders, in motion.</h2>
            </div>
            <button
              type="button"
              className="sc-compact"
              aria-pressed={compact}
              onClick={() => setCompact((old) => !old)}
            >
              {compact ? "Comfortable view" : "Busy service mode"}
            </button>
          </div>
          <div className="sc-toolbar">
            <div className="sc-tabs" role="tablist" aria-label="Orders view">
              <button
                id="sc-active-tab"
                type="button"
                role="tab"
                aria-selected={tab === "active"}
                onClick={() => setTab("active")}
              >
                Live orders <span>{statusCounts.active}</span>
              </button>
              <button
                id="sc-history-tab"
                type="button"
                role="tab"
                aria-selected={tab === "history"}
                onClick={() => setTab("history")}
              >
                History
              </button>
            </div>
            <div className="sc-controls">
              <label className="sc-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search order number, customer or table</span>
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search order # or guest"
                  maxLength={80}
                />
              </label>
              <label className="sc-select">
                <span className="sr-only">Fulfilment mode</span>
                <select
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="all">All fulfilment</option>
                  <option value="dine_in">Dine-in</option>
                  <option value="pickup">Pickup</option>
                </select>
              </label>
              <button
                type="button"
                className="sc-tool-button"
                aria-pressed={sound}
                onClick={() => {
                  const next = !sound;
                  setSound(next);
                  window.localStorage.setItem(
                    "menuminute.orders.sound",
                    next ? "enabled" : "muted"
                  );
                  if (next) {
                    try {
                      playOrderChime();
                    } catch {
                      /* audio permission */
                    }
                  }
                }}
              >
                {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
                <span>{sound ? "Chime on" : "Chime off"}</span>
              </button>
              <button
                type="button"
                className="sc-tool-button"
                onClick={() => void refresh()}
                disabled={isRefreshing}
              >
                <RefreshCw size={17} className={isRefreshing ? "sc-spin" : ""} />
                <span>Sync</span>
              </button>
            </div>
          </div>
          <div className="sc-sync" role="status" aria-live="polite">
            <span className={error ? "sc-dot sc-dot-error" : "sc-dot"} />
            {lastSync
              ? "Last successful sync " +
                new Date(lastSync).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: timezone,
                }) +
                (isRefreshing ? " · Syncing…" : "")
              : "Waiting for first synchronization"}
            {error && <span> · Connection may be stale</span>}
          </div>
          {error && (
            <div className="sc-alert" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
              <button type="button" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          )}
          {overflow && tab === "active" && (
            <div className="sc-alert" role="alert">
              <AlertTriangle size={18} />
              More than 400 active tickets exist. Showing the oldest 400; this is a service capacity
              incident. Do not assume the rail is complete.
            </div>
          )}
          {tab === "active" ? (
            <div
              role="tabpanel"
              aria-labelledby="sc-active-tab"
              className={compact ? "sc-rail sc-rail-compact" : "sc-rail"}
            >
              <div className="sc-mobile-lanes" role="group" aria-label="Choose service lane">
                <button type="button" aria-pressed={rail === "all"} onClick={() => setRail("all")}>
                  All <span>{statusCounts.active}</span>
                </button>
                {lanes.map((lane) => (
                  <button
                    type="button"
                    key={lane.id}
                    aria-pressed={rail === lane.id}
                    onClick={() => setRail(lane.id)}
                  >
                    {lane.title}{" "}
                    <span>{statusCounts[lane.id === "incoming" ? "pending" : lane.id]}</span>
                  </button>
                ))}
              </div>
              <div className="sc-columns">
                {lanes.map(({ id, title, hint, Icon }) => {
                  const matches = visible.filter((order) => laneFor(order.status) === id);
                  return (
                    <section
                      className={
                        "sc-column sc-column-" +
                        id +
                        (rail !== "all" && rail !== id ? " sc-column-hidden" : "")
                      }
                      key={id}
                      aria-label={title}
                    >
                      <div className="sc-column-head">
                        <div className="sc-column-heading">
                          <span className="sc-column-icon">
                            <Icon size={18} aria-hidden="true" />
                          </span>
                          <div>
                            <h3>{title}</h3>
                            <p>{hint}</p>
                          </div>
                        </div>
                        <span className="sc-column-count">
                          {statusCounts[id === "incoming" ? "pending" : id]}
                        </span>
                      </div>
                      <div className="sc-column-tickets">
                        {matches.length ? (
                          matches.map((order) => (
                            <Ticket
                              key={order.id}
                              order={order}
                              now={now || Date.now()}
                              open={(item) => {
                                setActivity(null);
                                setSelected(item);
                              }}
                              busy={busyId === order.id}
                              perform={(ticket, status) => void mutate(ticket, status)}
                              decline={(ticket) => {
                                setDeclineReason(declineReasons[0]);
                                setDeclining(ticket);
                              }}
                              pay={setPaying}
                            />
                          ))
                        ) : (
                          <RailEmpty lane={id} filtered={isFiltered} />
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <section role="tabpanel" aria-labelledby="sc-history-tab" className="sc-history">
              <div className="sc-history-filters">
                <label>
                  Status
                  <select
                    value={historyStatus}
                    onChange={(e) => {
                      setHistoryStatus(e.target.value);
                      setPage(0);
                    }}
                  >
                    {[
                      "all",
                      "completed",
                      "cancelled",
                      "served",
                      "collected",
                      "rejected",
                      "expired",
                    ].map((value) => (
                      <option key={value} value={value}>
                        {value === "all"
                          ? "All concluded"
                          : value === "cancelled"
                            ? "Declined / cancelled / expired"
                            : value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Payment
                  <select
                    value={payment}
                    onChange={(e) => {
                      setPayment(e.target.value);
                      setPage(0);
                    }}
                  >
                    {["all", "unpaid", "paid", "voided"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  From
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    min={from || undefined}
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
              </div>
              <p className="sc-history-count" role="status">
                {historyBusy
                  ? "Loading history…"
                  : history
                    ? history.total + " matching concluded orders · page " + (history.page + 1)
                    : "No history loaded"}
              </p>
              {history?.orders.length ? (
                <div className="sc-history-list">
                  {history.orders.map((order) => (
                    <article className="sc-history-row" key={order.id}>
                      <div>
                        <strong>#{order.orderNumber}</strong>
                        <small>
                          {order.fulfillmentMode === "pickup" ? "Pickup" : "Dine-in"}
                          {order.customerName ? " · " + order.customerName : ""}
                        </small>
                      </div>
                      <span className={"sc-status sc-status-" + order.status}>
                        {statusLabels[order.status] ?? order.status}
                      </span>
                      <span>
                        {formatPrice(order.totalMinor, order.currency)}
                        <small>{order.paymentStatus}</small>
                      </span>
                      <button
                        type="button"
                        className="sc-secondary"
                        onClick={() => {
                          setActivity(null);
                          setSelected(order);
                        }}
                      >
                        Details
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                !historyBusy && (
                  <div className="sc-history-empty">
                    <strong>No matching concluded orders.</strong>
                    <p>Try a different filter or date range.</p>
                  </div>
                )
              )}
              <div className="sc-pages">
                <button
                  type="button"
                  disabled={page === 0 || historyBusy}
                  onClick={() => setPage((n) => n - 1)}
                >
                  Previous
                </button>
                <span>Page {page + 1}</span>
                <button
                  type="button"
                  disabled={!history?.hasMore || historyBusy}
                  onClick={() => setPage((n) => n + 1)}
                >
                  Next
                </button>
              </div>
            </section>
          )}
        </section>
      </main>
      <Dialog.Root
        open={Boolean(currentSelected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setActivity(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="sc-overlay" />
          <Dialog.Content className="sc-drawer" aria-describedby="sc-detail-description">
            {currentSelected && (
              <>
                <div className="sc-drawer-head">
                  <div>
                    <span className="sc-eyebrow">ORDER DETAILS</span>
                    <Dialog.Title>Order #{currentSelected.orderNumber}</Dialog.Title>
                    <Dialog.Description id="sc-detail-description">
                      {statusLabels[currentSelected.status] ?? currentSelected.status}
                      {" · " +
                        (currentSelected.fulfillmentMode === "pickup" ? "Pickup" : "Dine-in")}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close className="sc-close" aria-label="Close order details">
                    <X size={20} />
                  </Dialog.Close>
                </div>
                <div className="sc-drawer-scroll">
                  <div className="sc-detail-block">
                    <h3>Guest & service</h3>
                    <p>
                      {currentSelected.servicePoint ||
                        (currentSelected.fulfillmentMode === "pickup"
                          ? "Counter pickup"
                          : "Dine-in")}
                      {currentSelected.customerName ? " · " + currentSelected.customerName : ""}
                    </p>
                    {currentSelected.customerPhone && <p>{currentSelected.customerPhone}</p>}
                    <p>
                      Received{" "}
                      {new Date(currentSelected.createdAt).toLocaleString([], {
                        timeZone: timezone,
                      })}
                    </p>
                  </div>
                  <div className="sc-detail-block">
                    <h3>Order items</h3>
                    {currentSelected.items.map((item) => (
                      <div key={item.id} className="sc-detail-item">
                        <strong>
                          {item.quantity}× {item.itemName}
                        </strong>
                        {item.variantName && <small>{item.variantName}</small>}
                        {item.selectedOptions.map((option) => (
                          <small key={option.groupId + ":" + option.optionId}>
                            {option.groupName}: {option.optionName}
                          </small>
                        ))}
                        {item.notes && <em>Instruction: {item.notes}</em>}
                        <span>{formatPrice(item.totalMinor, currentSelected.currency)}</span>
                      </div>
                    ))}
                    {currentSelected.notes && (
                      <p className="sc-ticket-note">Guest instruction: {currentSelected.notes}</p>
                    )}
                  </div>
                  <div className="sc-detail-block">
                    <h3>Totals & settlement</h3>
                    <p>
                      Subtotal{" "}
                      <b>{formatPrice(currentSelected.subtotalMinor, currentSelected.currency)}</b>
                    </p>
                    <p>
                      Tax <b>{formatPrice(currentSelected.taxMinor, currentSelected.currency)}</b>
                    </p>
                    <p>
                      Total{" "}
                      <b>{formatPrice(currentSelected.totalMinor, currentSelected.currency)}</b>
                    </p>
                    <p>
                      Payment <b>{currentSelected.paymentStatus}</b>
                    </p>
                    {currentSelected.canManagePayment &&
                      currentSelected.paymentStatus === "unpaid" && (
                        <button
                          type="button"
                          className="sc-secondary"
                          onClick={() => setPaying(currentSelected)}
                        >
                          Record cash payment
                        </button>
                      )}
                  </div>
                  <div className="sc-detail-block">
                    <h3>Order activity</h3>
                    {activity === null ? (
                      <p>Loading recorded events…</p>
                    ) : activity.length ? (
                      <ol className="sc-activity">
                        {activity.map((event) => (
                          <li key={event.id}>
                            <strong>{statusLabels[event.toStatus] ?? event.toStatus}</strong>
                            <small>
                              {new Date(event.createdAt).toLocaleString([], { timeZone: timezone })}{" "}
                              · {event.actorType}
                            </small>
                            {event.note && <p>{event.note}</p>}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>Recorded timeline unavailable. The order status above is authoritative.</p>
                    )}
                    {activityTruncated && <p>Showing the latest 60 recorded events.</p>}
                    {currentSelected.rejectionReason && (
                      <p>Decline reason: {currentSelected.rejectionReason}</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(declining)}
        onOpenChange={(open) => {
          if (!open) setDeclining(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="sc-overlay" />
          <Dialog.Content className="sc-confirm">
            <div className="sc-drawer-head">
              <Dialog.Title>Decline order #{declining?.orderNumber}</Dialog.Title>
              <Dialog.Close aria-label="Close decline dialog" className="sc-close">
                <X size={20} />
              </Dialog.Close>
            </div>
            <Dialog.Description>
              The guest will see your reason in their tracking view.
            </Dialog.Description>
            <fieldset>
              <legend>Reason for declining</legend>
              {declineReasons.map((reason) => (
                <label key={reason}>
                  <input
                    type="radio"
                    name="decline-reason"
                    checked={declineReason === reason}
                    onChange={() => setDeclineReason(reason)}
                  />
                  {reason}
                </label>
              ))}
            </fieldset>
            <div className="sc-confirm-actions">
              <Dialog.Close className="sc-secondary">Keep order</Dialog.Close>
              <button
                type="button"
                disabled={!declining || busyId === declining.id || !declineReason}
                className="sc-danger"
                onClick={() => {
                  if (declining) void mutate(declining, "rejected", declineReason);
                }}
              >
                Confirm decline
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(paying)}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="sc-overlay" />
          <Dialog.Content className="sc-confirm">
            <div className="sc-drawer-head">
              <Dialog.Title>Record cash payment</Dialog.Title>
              <Dialog.Close aria-label="Close payment confirmation" className="sc-close">
                <X size={20} />
              </Dialog.Close>
            </div>
            <Dialog.Description>
              Confirm that cash was actually received for order #{paying?.orderNumber}. This records
              an audited settlement; it does not charge a card or process an online payment.
            </Dialog.Description>
            <div className="sc-confirm-actions">
              <Dialog.Close className="sc-secondary">Cancel</Dialog.Close>
              <button
                type="button"
                className="sc-primary"
                disabled={!paying || busyId === paying.id}
                onClick={() => {
                  if (paying) void mutate(paying, "", undefined, true);
                }}
              >
                Confirm cash received
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
