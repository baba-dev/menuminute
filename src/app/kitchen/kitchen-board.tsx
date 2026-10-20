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
  Plus,
  Settings2,
  AlertTriangle,
  LoaderCircle,
} from "lucide-react";
import { playOrderChime } from "@/lib/sound";
import type { KitchenSnapshot, KitchenWorkView } from "@/modules/kitchen/service";
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
}: {
  work: KitchenWorkView;
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
      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900"
      aria-label={`Order ${work.orderNumber}: ${work.dishName}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-lg bg-stone-950 px-2.5 py-1 text-sm font-extrabold text-white dark:bg-orange-500 dark:text-stone-950">
          #{work.orderNumber}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-stone-500 dark:text-stone-300">
          <Clock3 size={13} aria-hidden="true" />
          {age === null ? "—" : age} min
        </span>
      </div>
      <p className="mt-2 text-xs font-bold tracking-wide text-orange-700 uppercase dark:text-orange-400">
        {work.fulfillmentMode === "pickup"
          ? "Pickup"
          : work.tableLabel
            ? "Table " + work.tableLabel
            : "Dine-in"}{" "}
        · {work.brandLabel}
      </p>
      <h4 className="mt-2 text-lg leading-tight font-extrabold text-stone-950 dark:text-white">
        {work.quantity} × {work.dishName}
      </h4>
      {work.variantName && (
        <p className="mt-1 text-sm text-stone-700 dark:text-stone-200">{work.variantName}</p>
      )}
      {work.selectedOptions.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-stone-700 dark:text-stone-200">
          {work.selectedOptions.map((o, i) => (
            <li key={i}>
              {o.groupName}: {o.optionName}
            </li>
          ))}
        </ul>
      )}
      {work.notes && (
        <p className="mt-3 rounded-lg border-l-4 border-orange-500 bg-orange-50 p-2 text-sm font-medium text-stone-950 dark:bg-orange-950/40 dark:text-orange-100">
          Item note: {work.notes}
        </p>
      )}
      {work.orderNotes && (
        <p className="mt-2 text-xs text-stone-600 dark:text-stone-300">
          Order note: {work.orderNotes}
        </p>
      )}
      {work.status !== "complete" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(work, work.status === "queued" ? "start" : "complete")}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 active:scale-[.99] disabled:cursor-wait disabled:opacity-60"
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
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCheck size={17} /> Completed · Awaiting expeditor
        </p>
      )}
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
  const [selected, setSelected] = useState(initial.stations[0]?.id ?? "");
  const [connection, setConnection] = useState<Connection>("connecting");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [sound, setSound] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [stationName, setStationName] = useState("");
  const [dishId, setDishId] = useState(menuDishes[0]?.id ?? "");
  const [routeStation, setRouteStation] = useState(initial.stations[0]?.id ?? "");
  const [memberId, setMemberId] = useState("");
  const [memberStation, setMemberStation] = useState("");
  const seen = useRef(new Set(initial.work.map((w) => w.id)));
  const base = `/api/organizations/${encodeURIComponent(organizationId)}/outlets/${encodeURIComponent(outletId)}/kitchen`;
  const apply = useCallback(
    (data: KitchenSnapshot) => {
      const newcomers = data.work.filter((w) => w.status === "queued" && !seen.current.has(w.id));
      seen.current = new Set(data.work.map((w) => w.id));
      setSnapshot(data);
      setLastSync(new Date());
      setConnection("live");
      if (sound && newcomers.length) playOrderChime();
    },
    [sound]
  );
  const refresh = useCallback(async () => {
    const res = await fetch(base, { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      setSnapshot((s) => ({ ...s, work: [], stations: [] }));
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
        setSound(localStorage.getItem("menuminute.kitchen.sound") === "true");
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
    const source = new EventSource(base + "/stream");
    source.addEventListener("snapshot", (event) => {
      if (!alive) return;
      try {
        apply(JSON.parse((event as MessageEvent<string>).data) as KitchenSnapshot);
      } catch {
        setConnection("recovering");
      }
    });
    source.addEventListener("heartbeat", () => {
      if (alive) setConnection("live");
    });
    source.addEventListener("revoked", () => {
      if (alive) {
        source.close();
        setSnapshot((s) => ({ ...s, work: [], stations: [] }));
        setConnection("revoked");
        setError("Your kitchen session or station permission has changed. Sign in again.");
      }
    });
    source.onerror = () => {
      if (alive) setConnection((c) => (c === "revoked" ? c : "recovering"));
    };
    const timer = setInterval(() => {
      if (alive)
        void refresh().catch(() => setConnection((c) => (c === "revoked" ? c : "recovering")));
    }, 15000);
    return () => {
      alive = false;
      source.close();
      clearInterval(timer);
    };
  }, [base, apply, refresh]);
  const station = snapshot.stations.find((s) => s.id === selected) ?? snapshot.stations[0];
  const work = useMemo(
    () => snapshot.work.filter((w) => w.stationId === station?.id),
    [snapshot.work, station?.id]
  );
  const groups = useMemo(
    () => ({
      queued: work.filter((w) => w.status === "queued"),
      preparing: work.filter((w) => w.status === "preparing"),
      complete: work.filter((w) => w.status === "complete"),
    }),
    [work]
  );
  const allDay = useMemo(() => {
    const totals = new Map<string, number>();
    for (const ticket of work) {
      if (ticket.status !== "queued" && ticket.status !== "preparing") continue;
      totals.set(ticket.dishName, (totals.get(ticket.dishName) ?? 0) + ticket.quantity);
    }
    return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [work]);
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
    setBusy(work.id);
    setError("");
    try {
      await command(base + "/work", { workId: work.id, action: op, expectedVersion: work.version });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action could not be saved");
      void refresh().catch(() => {});
    } finally {
      setBusy("");
    }
  }
  async function admin(action: string, data: Record<string, string>) {
    setBusy(action);
    setError("");
    try {
      await command(base + "/admin", { action, data });
      setStationName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settings could not be saved");
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
    <main className="min-h-screen bg-[#fffaf4] pb-12 text-stone-950 dark:bg-[#161310] dark:text-stone-100">
      <header className="border-b border-stone-200 bg-white/95 px-4 py-4 md:px-8 dark:border-stone-800 dark:bg-stone-950/95">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-gradient-to-br from-orange-600 to-amber-400 p-3 text-white">
              <ChefHat size={24} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black tracking-[.2em] text-orange-700 uppercase dark:text-orange-400">
                MenuMinute · Kitchen Pro
              </p>
              <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">{outletName}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              role="status"
              aria-live="polite"
              className="flex min-h-10 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-semibold dark:border-stone-700"
            >
              {connection === "live" ? (
                <Wifi size={16} className="text-emerald-600" />
              ) : (
                <WifiOff size={16} className="text-orange-600" />
              )}
              {connection === "live"
                ? "Connected"
                : connection === "revoked"
                  ? "Access changed"
                  : "Reconnecting"}
            </span>
            <button
              type="button"
              onClick={() => {
                const enabled = !sound;
                try {
                  localStorage.setItem("menuminute.kitchen.sound", String(enabled));
                } catch {}
                if (enabled) playOrderChime();
                setSound(enabled);
              }}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-semibold dark:border-stone-700"
              aria-pressed={sound}
            >
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}Sound {sound ? "on" : "off"}
            </button>
            <button
              type="button"
              onClick={() => void refresh().catch((e) => setError(String(e)))}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-stone-200 px-3 text-xs font-semibold dark:border-stone-700"
            >
              <RefreshCw size={16} /> Sync
            </button>
            <Link
              href="/dashboard/orders"
              className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold underline"
            >
              <ArrowLeft size={16} /> Merchant orders
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 pt-6 md:px-8">
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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[.16em] text-orange-700 uppercase dark:text-amber-400">
              Prep stations
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight">
              {station?.name ?? "Station assignment required"}
            </h2>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              Last reconciled: {lastSync?.toLocaleTimeString() ?? "Not connected"} · All changes
              saved on the server
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-4 text-sm font-bold dark:border-stone-700"
            >
              <Settings2 size={17} /> Station setup
            </button>
          )}
        </div>
        {snapshot.stations.length > 0 && (
          <nav aria-label="Kitchen stations" className="flex flex-wrap gap-2">
            {snapshot.stations.map((s) => (
              <button
                type="button"
                key={s.id}
                aria-current={station?.id === s.id ? "page" : undefined}
                onClick={() => setSelected(s.id)}
                className={
                  station?.id === s.id
                    ? "min-h-12 rounded-xl bg-stone-950 px-5 text-sm font-bold text-white dark:bg-amber-500 dark:text-stone-950"
                    : "min-h-12 rounded-xl border border-stone-300 bg-white px-5 text-sm font-bold dark:border-stone-700 dark:bg-stone-900"
                }
              >
                {s.name}
              </button>
            ))}
          </nav>
        )}
        {allDay.length > 0 && (
          <section aria-label="All-day outstanding preparation counts" className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900">
            <h3 className="text-sm font-extrabold">All-day · Remaining to prepare</h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">Live outstanding quantities on this station; completed tickets are excluded.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {allDay.map(([name, quantity]) => (
                <li key={name} className="rounded-xl bg-orange-50 px-3 py-2 text-sm font-semibold text-stone-900 dark:bg-stone-800 dark:text-stone-100">
                  <span className="font-extrabold tabular-nums text-orange-700 dark:text-amber-400">{quantity} ×</span> {name}
                </li>
              ))}
            </ul>
          </section>
        )}
        {showSettings && canManage && (
          <section
            aria-label="Station configuration"
            className="grid gap-5 rounded-2xl border border-stone-200 bg-white p-5 md:grid-cols-2 dark:border-stone-700 dark:bg-stone-900"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void admin("station.create", { name: stationName });
              }}
              className="space-y-3"
            >
              <h3 className="font-extrabold">Add preparation station</h3>
              <label className="block text-sm font-medium" htmlFor="station-name">
                Station name
              </label>
              <input
                id="station-name"
                required
                minLength={2}
                maxLength={64}
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="e.g. Tandoor"
                className="min-h-12 w-full rounded-xl border border-stone-300 bg-transparent px-3 dark:border-stone-600"
              />
              <button
                type="submit"
                disabled={!!busy}
                className="flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 font-bold text-white disabled:opacity-50"
              >
                <Plus size={16} /> Create station
              </button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const target = routeStation || snapshot.stations[0]?.id;
                if (dishId && target) void admin("route.assign", { dishId, stationId: target });
              }}
              className="space-y-3"
            >
              <h3 className="font-extrabold">Route a published dish</h3>
              <label htmlFor="route-dish" className="block text-sm font-medium">
                Dish
              </label>
              <select
                id="route-dish"
                required
                value={dishId}
                onChange={(e) => setDishId(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-stone-300 bg-transparent px-3 dark:border-stone-600"
              >
                <option value="">Select dish</option>
                {menuDishes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <label htmlFor="route-station" className="block text-sm font-medium">
                Station
              </label>
              <select
                id="route-station"
                required
                value={routeStation || snapshot.stations[0]?.id || ""}
                onChange={(e) => setRouteStation(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-stone-300 bg-transparent px-3 dark:border-stone-600"
              >
                <option value="">Select station</option>
                {snapshot.stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!!busy || !dishId || !(routeStation || snapshot.stations[0]?.id)}
                className="min-h-11 rounded-xl bg-orange-600 px-4 font-bold text-white disabled:opacity-50"
              >
                Assign route
              </button>
              <p className="text-xs text-stone-500 dark:text-stone-300">
                A dish may be routed to multiple stations. Final activation requires commercial and
                end-to-end release sign-off.
              </p>
              <h4 className="text-sm font-bold">Current dish routes</h4>
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {snapshot.routes.map(route => (
                  <li key={route.dishId + route.stationId} className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 p-2 text-sm dark:border-stone-700">
                    <span>{menuDishes.find(d => d.id === route.dishId)?.name ?? route.dishId} · {snapshot.stations.find(st => st.id === route.stationId)?.name ?? "Inactive station"}</span>
                    <button type="button" disabled={!!busy} onClick={() => void admin("route.remove", {dishId:route.dishId,stationId:route.stationId})} className="min-h-10 shrink-0 rounded-lg px-2 text-xs font-bold text-red-700 underline disabled:opacity-50 dark:text-red-400">Remove</button>
                  </li>
                ))}
                {!snapshot.routes.length && <li className="text-xs text-stone-500">No routes configured yet.</li>}
              </ul>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (memberId && (memberStation || snapshot.stations[0]?.id))
                  void admin("member.assign", {
                    memberId,
                    stationId: memberStation || snapshot.stations[0]!.id,
                  });
              }}
              className="space-y-3"
            >
              <h3 className="font-extrabold">Assign kitchen staff</h3>
              <p className="text-xs text-stone-600 dark:text-stone-300">
                Assign an active teammate with a kitchen or manager outlet role. Revoking the
                assignment removes their station access on the next request.
              </p>
              <label className="block text-sm font-medium" htmlFor="kitchen-member">
                Team member
              </label>
              <select
                id="kitchen-member"
                required
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-stone-300 bg-transparent px-3 dark:border-stone-600"
              >
                <option value="">Choose a teammate</option>
                {snapshot.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <label className="block text-sm font-medium" htmlFor="kitchen-member-station">
                Assigned station
              </label>
              <select
                id="kitchen-member-station"
                required
                value={memberStation || snapshot.stations[0]?.id || ""}
                onChange={(e) => setMemberStation(e.target.value)}
                className="min-h-12 w-full rounded-xl border border-stone-300 bg-transparent px-3 dark:border-stone-600"
              >
                <option value="">Choose a station</option>
                {snapshot.stations.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!!busy || !memberId || !(memberStation || snapshot.stations[0]?.id)}
                className="min-h-11 rounded-xl bg-orange-600 px-4 font-bold text-white disabled:opacity-50"
              >
                Assign teammate
              </button>
              {snapshot.members.filter((m) => m.stationIds.length > 0).length > 0 && (
                <ul className="space-y-2 text-sm">
                  {snapshot.members
                    .filter((m) => m.stationIds.length > 0)
                    .flatMap((m) => m.stationIds.map((stationId) => ({ member: m, stationId })))
                    .map(({ member, stationId }) => (
                      <li
                        key={member.id + stationId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 p-2 dark:border-stone-700"
                      >
                        <span>
                          {member.name} ·{" "}
                          {snapshot.stations.find((st) => st.id === stationId)?.name ??
                            "Inactive station"}
                        </span>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() =>
                            void admin("member.remove", { memberId: member.id, stationId })
                          }
                          className="min-h-10 rounded-lg px-3 text-xs font-bold text-red-700 underline dark:text-red-400"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </form>
          </section>
        )}
        <section aria-label="Station ticket board" className="grid gap-4 lg:grid-cols-3">
          {lanes.map((lane) => {
            const Icon = lane.icon;
            return (
              <div
                key={lane.key}
                className="min-h-64 rounded-2xl border border-stone-200 bg-stone-100/70 p-3 dark:border-stone-800 dark:bg-stone-950/60"
              >
                <h3 className="mb-3 flex items-center justify-between px-2 py-1 text-base font-black">
                  <span className="flex items-center gap-2">
                    <Icon size={20} className="text-orange-600 dark:text-amber-400" />
                    {lane.title}
                  </span>
                  <span className="rounded-full bg-stone-200 px-3 py-1 text-sm tabular-nums dark:bg-stone-800">
                    {groups[lane.key].length}
                  </span>
                </h3>
                <div className="space-y-3">
                  {groups[lane.key].map((w) => (
                    <Ticket key={w.id} work={w} now={now} busy={busy === w.id} onAction={action} />
                  ))}
                  {groups[lane.key].length === 0 && (
                    <p className="rounded-xl border border-dashed border-stone-300 p-5 text-center text-sm text-stone-600 dark:border-stone-700 dark:text-stone-400">
                      No {lane.title.toLowerCase()} items
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
        <p className="text-xs text-stone-600 dark:text-stone-400">
          Kitchen Pro A–D · Station completion is not guest-facing Ready. Expeditor release and full
          merchant integration are part of the next guarded package.
        </p>
      </div>
    </main>
  );
}
