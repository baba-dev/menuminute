"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChefHat,
  ArrowLeft,
  RefreshCw,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Clock3,
  CheckCheck,
  Flame,
  ListChecks,
  Settings2,
  AlertTriangle,
  LoaderCircle,
  ArrowRight,
  ClipboardList,
  Maximize2,
} from "lucide-react";
import { playWoodenTap, playKitchenBell } from "@/lib/sound-effects";
import { RubberStamp } from "@/components/ui/tactile-elements";
import type { KitchenSnapshot, KitchenWorkView } from "@/modules/kitchen/service";
import { KitchenExpeditor } from "./kitchen-expeditor";
import { KitchenSetupModal, kitchenSetupProgress } from "./kitchen-setup-modal";
import { ThemeControl } from "@/components/menu-product/theme-control";
import {
  kitchenPulse,
  stationGroups,
  outstandingDishes,
  stationOverview,
} from "@/modules/kitchen/presentation";
type Dish = { id: string; name: string };
type Props = {
  organizationId: string;
  outletId: string;
  outletName: string;
  initial: KitchenSnapshot;
  canManage: boolean;
  menuDishes: Dish[];
};
type Connection = "connecting" | "live" | "recovering" | "revoked";
function Ticket({
  work,
  onAction,
  busy,
  now,
  stationName,
}: {
  work: KitchenWorkView;
  stationName: string;
  onAction: (work: KitchenWorkView, action: "start" | "complete") => void;
  busy: boolean;
  now: number | null;
}) {
  const age =
    now === null
      ? null
      : Math.max(0, Math.floor((now - new Date(work.createdAt).getTime()) / 60000));
  return (
    <article
      className={
        "kk-ticket kk-ticket-" +
        work.status +
        (age !== null && age >= 20 && work.status !== "complete" ? " kk-ticket-aging" : "")
      }
      aria-label={`Order ${work.orderNumber}: ${work.dishName}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="kk-ticket-number">#{work.orderNumber}</span>
        <span className="kk-ticket-age">
          <Clock3 size={13} aria-hidden="true" />
          {age === null ? "—" : age} min
        </span>
      </div>
      <p className="kk-ticket-meta">
        {work.fulfillmentMode === "pickup"
          ? "Pickup"
          : work.tableLabel && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(work.tableLabel)
            ? "Table " + work.tableLabel
            : "Dine-in"}{" "}
        · {stationName}
      </p>
      <h4 className="kk-ticket-dish">
        {work.quantity} × {work.dishName}
      </h4>
      {work.variantName && <p className="kk-ticket-variant">{work.variantName}</p>}
      {work.selectedOptions.length > 0 && (
        <ul className="kk-ticket-addons">
          {work.selectedOptions.map((o, i) => (
            <li key={i}>
              {o.groupName}: {o.optionName}
            </li>
          ))}
        </ul>
      )}
      {work.notes && <p className="kk-ticket-note">Item note: {work.notes}</p>}
      {work.orderNotes && <p className="kk-ticket-order-note">Order note: {work.orderNotes}</p>}
      {work.status !== "complete" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            playWoodenTap("kitchen");
            onAction(work, work.status === "queued" ? "start" : "complete");
          }}
          className="kk-ticket-action btn-ink-press"
        >
          {busy ? (
            <LoaderCircle className="animate-spin" size={17} />
          ) : work.status === "queued" ? (
            <Flame size={17} />
          ) : (
            <CheckCheck size={17} />
          )}{" "}
          {busy ? "Saving…" : work.status === "queued" ? "Start preparing" : "Complete item"}
        </button>
      )}
      {work.status === "complete" && (
        <div className="flex items-center justify-between gap-2 border-t border-stone-200 pt-2 dark:border-stone-800">
          <span className="text-xs text-stone-500">Completed · Awaiting expeditor</span>
          <RubberStamp text="STATION COMPLETE" variant="complete" />
        </div>
      )}
      <div className="ticket-receipt-tear -mx-4 mt-3 -mb-4" aria-hidden="true" />
    </article>
  );
}
export function KitchenBoard({
  organizationId,
  outletId,
  outletName,
  initial,
  canManage,
  menuDishes,
}: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [selected, setSelected] = useState(
    canManage && initial.enabled ? "all" : (initial.stations[0]?.id ?? "")
  );
  const [connection, setConnection] = useState<Connection>("connecting");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [sound, setSound] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mobileLane, setMobileLane] = useState<"all" | "queued" | "preparing" | "complete">("all");
  const [reassignWork, setReassignWork] = useState("");
  const [reassignStation, setReassignStation] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const seen = useRef(new Set(initial.work.map((w) => w.id)));
  const cursorRef = useRef(initial.cursor);
  const soundRef = useRef(false);
  const inflight = useRef(new Set<string>());
  const revoked = useRef(false);
  const stream = useRef<EventSource | null>(null);
  const base = `/api/organizations/${encodeURIComponent(organizationId)}/outlets/${encodeURIComponent(outletId)}/kitchen`;
  const apply = useCallback((data: KitchenSnapshot) => {
    if (revoked.current || data.cursor < cursorRef.current) return;
    cursorRef.current = data.cursor;
    const newcomers = data.work.filter((w) => w.status === "queued" && !seen.current.has(w.id));
    seen.current = new Set(data.work.map((w) => w.id));
    setSnapshot(data);
    setLastSync(new Date());
    setConnection("live");
    if (soundRef.current && newcomers.length) {
      try {
        playKitchenBell("kitchen");
      } catch {
        /* Browser audio may require a gesture. */
      }
    }
  }, []);
  const refresh = useCallback(async () => {
    if (revoked.current) return;
    const res = await fetch(base, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      revoked.current = true;
      stream.current?.close();
      setSnapshot((s) => ({ ...s, work: [], stations: [], routes: [], members: [] }));
      setConnection("revoked");
      throw new Error("Kitchen access expired");
    }
    if (!res.ok) throw new Error("Unable to reconcile kitchen tickets");
    apply((await res.json()) as KitchenSnapshot);
  }, [base, apply]);
  useEffect(() => {
    const initial = requestAnimationFrame(() => {
      setNow(Date.now());
      try {
        const saved = localStorage.getItem("menuminute.kitchen.sound") === "true";
        soundRef.current = saved;
        setSound(saved);
      } catch {}
    });
    const clock = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      cancelAnimationFrame(initial);
      clearInterval(clock);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    if (revoked.current) return;
    const source = new EventSource(base + "/stream");
    stream.current = source;
    source.addEventListener("snapshot", (event) => {
      if (!alive || revoked.current) return;
      try {
        apply(JSON.parse((event as MessageEvent<string>).data) as KitchenSnapshot);
      } catch {
        setConnection("recovering");
      }
    });
    source.addEventListener("heartbeat", () => {
      if (alive && !revoked.current) setConnection("live");
    });
    source.addEventListener("unavailable", () => {
      if (alive && !revoked.current) {
        setConnection("recovering");
        setError("Kitchen connection interrupted. Reconnecting and refreshing tickets.");
      }
    });
    source.addEventListener("revoked", () => {
      if (alive) {
        revoked.current = true;
        source.close();
        setSnapshot((s) => ({ ...s, work: [], stations: [], routes: [], members: [] }));
        setConnection("revoked");
        setError("Your kitchen session or station permission has changed. Sign in again.");
      }
    });
    source.onerror = () => {
      if (alive) setConnection((c) => (c === "revoked" ? c : "recovering"));
    };
    const timer = setInterval(() => {
      if (alive && !revoked.current)
        void refresh().catch(() => setConnection((c) => (c === "revoked" ? c : "recovering")));
    }, 15000);
    return () => {
      alive = false;
      source.close();
      if (stream.current === source) stream.current = null;
      clearInterval(timer);
    };
  }, [base, apply, refresh]);
  const station =
    selected === "all"
      ? undefined
      : (snapshot.stations.find((s) => s.id === selected) ?? snapshot.stations[0]);
  const work = useMemo(
    () =>
      selected === "all" ? snapshot.work : snapshot.work.filter((w) => w.stationId === station?.id),
    [snapshot.work, station?.id, selected]
  );
  const groups = useMemo(
    () => stationGroups(snapshot.work, selected === "all" ? undefined : station?.id),
    [snapshot.work, station?.id, selected]
  );
  const allDay = useMemo(() => outstandingDishes(work), [work]);
  const pulse = useMemo(() => kitchenPulse(snapshot.work), [snapshot.work]);
  const overview = useMemo(
    () => stationOverview(snapshot.stations, snapshot.work, now),
    [snapshot.stations, snapshot.work, now]
  );
  const allPending = overview.reduce((sum, item) => sum + item.queued + item.preparing, 0);

  async function command(url: string, body: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const e = (await res.json().catch(() => ({ message: "Request failed" }))) as {
        message?: string;
      };
      throw new Error(e.message ?? "Request failed");
    }
    await refresh();
  }
  async function action(work: KitchenWorkView, op: "start" | "complete") {
    if (revoked.current || inflight.current.has(work.id)) return;
    inflight.current.add(work.id);
    setBusy(work.id);
    setError("");
    try {
      await command(base + "/work", {
        workId: work.id,
        action: op,
        expectedVersion: work.version,
        key: crypto.randomUUID(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action could not be saved");
      void refresh().catch(() => {});
    } finally {
      inflight.current.delete(work.id);
      setBusy("");
    }
  }
  async function setupCommand(action: string, data: Record<string, string>) {
    if (revoked.current) throw new Error("Kitchen access changed. Sign in again.");
    await command(base + "/admin", { action, data });
  }
  const setupProgress = useMemo(
    () => kitchenSetupProgress(snapshot, menuDishes),
    [snapshot, menuDishes]
  );
  useEffect(() => {
    if (!canManage || revoked.current) return;
    // Schedule presentation after hydration. React Strict Mode can cancel a
    // superseded frame without prematurely marking a first visit as seen.
    const frame = window.requestAnimationFrame(() => {
      const firstKey = `menuminute.kitchen.setup.v2:${organizationId}:${outletId}`;
      const activationKey = `menuminute.kitchen.activated.v2:${organizationId}:${outletId}`;
      try {
        const first = sessionStorage.getItem(firstKey) !== "seen";
        const newActivation = snapshot.enabled && localStorage.getItem(activationKey) !== "seen";
        if (first) sessionStorage.setItem(firstKey, "seen");
        if (newActivation) localStorage.setItem(activationKey, "seen");
        if ((first && !setupProgress.complete) || newActivation) setShowSettings(true);
      } catch {
        // Private browsing must not prevent the first-run setup.
        if (!setupProgress.complete) setShowSettings(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [canManage, organizationId, outletId, snapshot.enabled, setupProgress.complete]);
  async function moveWork() {
    const ticket = snapshot.work.find((w) => w.id === reassignWork);
    if (!ticket || !reassignStation || !reassignReason.trim()) return;
    setBusy("reassign");
    setError("");
    try {
      await command(base + "/reassign", {
        workId: ticket.id,
        stationId: reassignStation,
        expectedVersion: ticket.version,
        key: crypto.randomUUID(),
        reason: reassignReason.trim(),
      });
      setReassignWork("");
      setReassignStation("");
      setReassignReason("");
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Transfer not confirmed") +
          ". Reconcile the ticket before issuing a fresh command."
      );
      void refresh().catch(() => {});
    } finally {
      setBusy("");
    }
  }
  const lanes = [
    { key: "queued" as const, title: "To prepare", icon: ListChecks },
    { key: "preparing" as const, title: "Preparing", icon: Flame },
    { key: "complete" as const, title: "Completed", icon: CheckCheck },
  ];
  return (
    <main className="product mm-kitchen" data-testid="chefs-pass">
      <header className="kk-topbar">
        <div className="kk-topbar-inner">
          <div className="kk-identity">
            <span className="kk-brand-icon">
              <ChefHat size={22} aria-hidden="true" />
            </span>
            <div>
              <span className="kk-eyebrow">MENUMINUTE / KITCHEN PRO</span>
              <h2>{outletName}</h2>
            </div>
          </div>
          <div className="kk-tools">
            <span
              role="status"
              aria-live="polite"
              className={"kk-connection kk-connection-" + connection}
            >
              {connection === "live" ? (
                <Wifi size={16} aria-hidden="true" />
              ) : (
                <WifiOff size={16} aria-hidden="true" />
              )}
              {connection === "live"
                ? "Connected"
                : connection === "revoked"
                  ? "Access changed"
                  : "Reconnecting"}
            </span>
            <button
              type="button"
              aria-pressed={sound}
              className="kk-tool"
              onClick={() => {
                const enabled = !sound;
                try {
                  localStorage.setItem("menuminute.kitchen.sound", String(enabled));
                } catch {}
                soundRef.current = enabled;
                if (enabled) {
                  try {
                    playKitchenBell("kitchen");
                  } catch {}
                }
                setSound(enabled);
              }}
            >
              {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}{" "}
              <span>Sound {sound ? "on" : "off"}</span>
            </button>
            <button
              type="button"
              className="kk-tool"
              onClick={() => void refresh().catch((e) => setError(String(e)))}
              disabled={connection === "revoked"}
            >
              <RefreshCw size={17} aria-hidden="true" /> Sync
            </button>
            <button
              type="button"
              className="kk-tool"
              title="Toggle fullscreen service mode"
              onClick={() => {
                if (document.fullscreenElement) {
                  void document
                    .exitFullscreen()
                    .catch(() => setError("Fullscreen exit was blocked."));
                } else {
                  void document.documentElement
                    .requestFullscreen()
                    .catch(() => setError("Fullscreen is unavailable on this device."));
                }
              }}
            >
              <Maximize2 size={17} aria-hidden="true" /> Fullscreen
            </button>
            <ThemeControl />
            <Link href="/dashboard/orders" className="kk-tool kk-return">
              <ArrowLeft size={16} aria-hidden="true" /> Orders
            </Link>
          </div>
        </div>
      </header>
      <section
        className={"kk-hero" + (snapshot.enabled ? " kk-hero-live" : "")}
        aria-labelledby="kk-title"
      >
        <div className="kk-hero-content">
          <span className="kk-eyebrow">01 / THE KITCHEN WORKSPACE</span>
          <h1 id="kk-title">{snapshot.enabled ? "Kitchen live service." : "The Chef’s Pass."}</h1>
          <p className="kk-tagline">
            {snapshot.enabled
              ? "Every station, every order, one live service."
              : "Every dish has its place. Every ticket moves with purpose."}
          </p>
          <p className="kk-hero-note">
            From first fire to final handoff. Your preparation stations, live queue, and
            expeditor—together on one focused surface.
          </p>
          <div className="kk-hero-actions">
            <a href="#station-rail" className="kk-hero-primary">
              Open station rail <ArrowRight size={16} aria-hidden="true" />
            </a>
            {canManage && (
              <a href="#expeditor" className="kk-hero-outline">
                Go to expeditor <ClipboardList size={16} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
        <div className="kk-pass-art" aria-hidden="true">
          <span className="kk-pass-hanger" />
          <span className="kk-pass-ticket kk-pass-ticket-one" />
          <span className="kk-pass-ticket kk-pass-ticket-two" />
          <span className="kk-pass-ticket kk-pass-ticket-three" />
          <span className="kk-pass-rail" />
          <span className="kk-pass-lamp" />
        </div>
      </section>
      <div className="kk-content">
        <section className="kk-pulse" aria-label="Visible kitchen workload">
          <div className="kk-section-heading">
            <div>
              <span className="kk-eyebrow">LIVE / ON THIS DEVICE</span>
              <h2>The kitchen pulse.</h2>
            </div>
            <span>Authorized visible station tickets · not outlet-wide totals</span>
          </div>
          <div className="kk-pulse-grid">
            {[
              { title: "Waiting to start", count: pulse.queued, icon: ListChecks },
              { title: "On the fire", count: pulse.preparing, icon: Flame },
              { title: "Station complete", count: pulse.completed, icon: CheckCheck },
              { title: "Active orders", count: pulse.activeOrders, icon: ClipboardList },
            ].map(({ title, count, icon: Icon }) => (
              <div className="kk-pulse-cell" key={title}>
                <span>
                  <Icon size={19} aria-hidden="true" /> {title}
                </span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>
        {snapshot.workOverflow && (
          <p
            role="alert"
            className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm font-bold text-orange-950 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200"
          >
            More than 500 live station tickets. This board is bounded to the oldest 500. Escalate
            kitchen capacity before accepting more orders.
          </p>
        )}
        {!snapshot.enabled && (
          <section
            role="note"
            className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <AlertTriangle size={20} className="shrink-0" /> Kitchen setup mode. New tickets remain
            on the existing merchant order board until the integrated Kitchen Pro release and
            entitlements are approved. You can configure stations without activating sales.
          </section>
        )}
        {connection !== "live" && (
          <p
            role="alert"
            className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200"
          >
            Connection: {connection}. Do not assume an action succeeded while offline. Ticket
            changes require a confirmed server response.
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
            <button type="button" onClick={() => setError("")} className="min-h-10 px-2 underline">
              Dismiss
            </button>
          </div>
        )}
        <section className="kk-overview" aria-label="All authorized preparation stations">
          <div className="kk-overview-heading">
            <div>
              <span className="kk-eyebrow">LIVE / PREPARATION OVERVIEW</span>
              <h2>Every station in sight.</h2>
              <p>
                Counts reflect stations you are authorized to view. Incoming orders stay in the
                attention dock above.
              </p>
            </div>
            <div className="kk-overview-total">{allPending} active station tasks</div>
          </div>
          <div className="kk-overview-grid">
            {overview.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected === item.id}
                onClick={() => setSelected(item.id)}
                className={"kk-overview-card" + (selected === item.id ? " is-selected" : "")}
              >
                <strong>{item.name}</strong>
                <span>
                  {item.queued} to prepare · {item.preparing} cooking · {item.completed} done
                </span>
                <small>
                  {item.oldestMinutes === null
                    ? "All caught up"
                    : item.oldestMinutes >= 20
                      ? `Overdue · ${item.oldestMinutes} min oldest`
                      : `Oldest open task · ${item.oldestMinutes} min`}
                </small>
              </button>
            ))}
          </div>
        </section>
        <div className="kk-section-heading kk-station-heading">
          <div>
            <p className="text-xs font-black tracking-[.16em] text-orange-700 uppercase dark:text-amber-400">
              Prep stations
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight">
              {selected === "all"
                ? "All stations"
                : (station?.name ?? "Station assignment required")}
            </h2>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              Last reconciled: {lastSync?.toLocaleTimeString() ?? "Not connected"} · All changes
              saved on the server
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-haspopup="dialog"
              className="kk-setup-toggle"
            >
              <Settings2 size={17} /> Configure kitchen
            </button>
          )}
        </div>
        {snapshot.stations.length > 0 && (
          <nav id="station-rail" aria-label="Kitchen stations" className="kk-stations">
            {canManage && (
              <button
                type="button"
                aria-current={selected === "all" ? "page" : undefined}
                onClick={() => setSelected("all")}
                className={"kk-station-tab" + (selected === "all" ? " is-selected" : "")}
              >
                All stations <span>{allPending}</span>
              </button>
            )}
            {snapshot.stations.map((s) => (
              <button
                type="button"
                key={s.id}
                aria-label={s.name}
                aria-current={station?.id === s.id ? "page" : undefined}
                onClick={() => setSelected(s.id)}
                className={"kk-station-tab" + (station?.id === s.id ? " is-selected" : "")}
              >
                {s.name}
                <span>{overview.find((item) => item.id === s.id)?.queued ?? 0} queued</span>
              </button>
            ))}
          </nav>
        )}
        {selected !== "all" && allDay.length > 0 && (
          <section aria-label="All-day outstanding preparation counts" className="kk-all-day">
            <h3 className="text-sm font-extrabold">All-day · Remaining to prepare</h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Live outstanding quantities on this station; completed tickets are excluded.
            </p>
            <ul className="kk-all-day-list">
              {allDay.map(([name, quantity]) => (
                <li key={name} className="kk-all-day-item">
                  <span className="font-extrabold text-orange-700 tabular-nums dark:text-amber-400">
                    {quantity} ×
                  </span>{" "}
                  {name}
                </li>
              ))}
            </ul>
          </section>
        )}
        {canManage && (
          <KitchenExpeditor
            base={base}
            enabled={snapshot.enabled}
            cursor={snapshot.cursor}
            work={snapshot.work}
            stations={snapshot.stations}
          />
        )}
        {canManage &&
          snapshot.work.some((w) => w.status === "queued" || w.status === "preparing") && (
            <details className="kk-transfer-panel">
              <summary>Transfer an active ticket</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void moveWork();
                }}
                className="space-y-3"
              >
                <h3 className="font-extrabold">Transfer an active ticket</h3>
                <p className="text-xs text-stone-600 dark:text-stone-300">
                  An auditable transfer keeps the same ticket and its original work history.
                  Completed work cannot be moved.
                </p>
                <label htmlFor="reassign-work" className="block text-sm font-medium">
                  Ticket
                </label>
                <select
                  id="reassign-work"
                  required
                  value={reassignWork}
                  onChange={(e) => setReassignWork(e.target.value)}
                  className="min-h-12 w-full rounded-xl border border-stone-300 bg-transparent px-3 dark:border-stone-600"
                >
                  <option value="">Select active ticket</option>
                  {snapshot.work
                    .filter((w) => w.status === "queued" || w.status === "preparing")
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        #{w.orderNumber} · {w.dishName} ·{" "}
                        {snapshot.stations.find((st) => st.id === w.stationId)?.name}
                      </option>
                    ))}
                </select>
                <label htmlFor="reassign-station" className="block text-sm font-medium">
                  Move to
                </label>
                <select
                  id="reassign-station"
                  required
                  value={reassignStation}
                  onChange={(e) => setReassignStation(e.target.value)}
                  className="min-h-12 w-full rounded-xl border border-stone-300 bg-transparent px-3 dark:border-stone-600"
                >
                  <option value="">Choose another station</option>
                  {snapshot.stations
                    .filter(
                      (st) => st.id !== snapshot.work.find((w) => w.id === reassignWork)?.stationId
                    )
                    .map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                </select>
                <label htmlFor="reassign-reason" className="block text-sm font-medium">
                  Reason for transfer
                </label>
                <input
                  id="reassign-reason"
                  required
                  minLength={5}
                  maxLength={500}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Grill station temporarily unavailable"
                  className="min-h-12 w-full rounded-xl border border-stone-300 bg-transparent px-3 dark:border-stone-600"
                />
                <button
                  type="submit"
                  disabled={
                    !!busy || !reassignWork || !reassignStation || reassignReason.trim().length < 5
                  }
                  className="min-h-11 rounded-xl bg-orange-600 px-4 font-bold text-white disabled:opacity-50"
                >
                  Transfer ticket
                </button>
              </form>
            </details>
          )}
        <section aria-label="Station ticket board" className="kk-workspace">
          <div className="kk-section-heading">
            <div>
              <span className="kk-eyebrow">02 / STATION TICKETS</span>
              <h2>Preparation rail.</h2>
            </div>
            <span>
              {selected === "all"
                ? "All authorized stations"
                : (station?.name ?? "Choose a station")}{" "}
              · oldest ticket first
            </span>
          </div>
          <div className="kk-mobile-lanes" role="group" aria-label="Filter preparation lanes">
            {(
              [
                { key: "all", label: "All" },
                { key: "queued", label: "To prepare" },
                { key: "preparing", label: "Preparing" },
                { key: "complete", label: "Completed" },
              ] as const
            ).map((lane) => (
              <button
                type="button"
                key={lane.key}
                aria-pressed={mobileLane === lane.key}
                onClick={() => setMobileLane(lane.key)}
              >
                {lane.label}
                {lane.key !== "all" && <span>{groups[lane.key].length}</span>}
              </button>
            ))}
          </div>
          <div className="kk-lanes">
            {lanes.map((lane) => {
              const Icon = lane.icon;
              return (
                <div
                  key={lane.key}
                  className={
                    "kk-lane kk-lane-" +
                    lane.key +
                    (mobileLane !== "all" && mobileLane !== lane.key ? " kk-mobile-hidden" : "")
                  }
                >
                  <h3 className="kk-lane-heading">
                    <span className="kk-lane-label">
                      <Icon size={20} className="text-orange-600 dark:text-amber-400" />
                      {lane.title}
                    </span>
                    <span className="kk-lane-count">{groups[lane.key].length}</span>
                  </h3>
                  <div className="kk-ticket-list">
                    {groups[lane.key].map((w) => (
                      <Ticket
                        key={w.id}
                        work={w}
                        stationName={
                          snapshot.stations.find((entry) => entry.id === w.stationId)?.name ??
                          "Assigned station"
                        }
                        now={now}
                        busy={busy === w.id}
                        onAction={action}
                      />
                    ))}
                    {groups[lane.key].length === 0 && (
                      <p className="kk-lane-empty">No {lane.title.toLowerCase()} items</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <p className="kk-footnote">
          Station completion does not mark an order Ready for guests. Only an authorized expeditor
          can release an eligible, fully completed order. All live actions are verified by the
          server.
        </p>
      </div>
      {canManage && (
        <KitchenSetupModal
          open={showSettings}
          onOpenChange={setShowSettings}
          outletName={outletName}
          snapshot={snapshot}
          dishes={menuDishes}
          onCommand={setupCommand}
        />
      )}
    </main>
  );
}
