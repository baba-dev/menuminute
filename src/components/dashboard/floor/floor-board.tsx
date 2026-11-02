"use client";

import Link from "next/link";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  Armchair,
  CalendarPlus,
  CalendarClock,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  Table2,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DashboardTooltip } from "@/app/(dashboard)/dashboard/dashboard-tooltip";
import type {
  ChairKind,
  CreateReservationInput,
  FloorChair,
  FloorOverview,
  FloorTableOverview,
  ReservationItem,
} from "@/modules/hospitality/floor-contracts";
import { floorHeadline } from "@/modules/hospitality/floor-headline";
import {
  ArchiveDialog,
  ChairsDialog,
  ReservationDialog,
  SECTIONS_HELP,
  SeatDialog,
  TableDialog,
  type TableFormValues,
} from "./floor-dialogs";
import { fetchOverview, floorRequest } from "./floor-api";
import { groupBySection, withChair } from "./floor-state";
import { JourneyStrip } from "./journey-strip";
import { TableIllustration } from "./table-illustration";
import styles from "./floor.module.css";
import { PlanMeterStrip } from "@/components/plans/plan-usage";
import { buildMeter, type PlanUsageView } from "@/modules/plans/view";

type Props = {
  outlet: { id: string; name: string; timezone: string; isDemo: boolean };
  initialOverview: FloorOverview;
  /** menu.write: add, edit and archive tables and chairs. */
  canManage: boolean;
  /** orders.accept: seat guests and mark chairs taken or free. */
  canSeat: boolean;
  /** Plan quotas for tables and chairs; omitted while limits are not enforced. */
  planUsage?: PlanUsageView | null;
};

const POLL_MS = 15_000;

export function FloorBoard({
  outlet,
  initialOverview,
  canManage,
  canSeat,
  planUsage = null,
}: Props) {
  const [overview, setOverview] = useState(initialOverview);
  const [section, setSection] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(0);

  // Each dialog is keyed by an opening counter so its form state starts fresh every time it opens.
  type DialogState = { open: boolean; tableId: string | null; gen: number };
  const closed: DialogState = { open: false, tableId: null, gen: 0 };
  const [tableDialog, setTableDialog] = useState<DialogState>(closed);
  const [chairsDialog, setChairsDialog] = useState<DialogState>(closed);
  const [seat_, setSeat] = useState<DialogState>(closed);
  const [archive_, setArchive] = useState<DialogState>(closed);
  const [reserve, setReserve] = useState<DialogState>(closed);
  const openDialog = (set: (fn: (d: DialogState) => DialogState) => void, tableId: string | null) =>
    set((d) => ({ open: true, tableId, gen: d.gen + 1 }));
  const closeDialog = (set: (fn: (d: DialogState) => DialogState) => void) =>
    set((d) => ({ ...d, open: false }));

  const refresh = useCallback(async () => {
    try {
      const next = await fetchOverview(outlet.id);
      // Never overwrite an in-progress optimistic edit with an older snapshot.
      if (inFlight.current === 0) setOverview(next);
    } catch {
      /* A failed background refresh keeps the last good view. */
    }
  }, [outlet.id]);

  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && void refresh();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  /** Run a mutation, keep polling from clobbering it, and always end on server truth. */
  async function mutate<T>(work: () => Promise<T>): Promise<T> {
    inFlight.current++;
    try {
      return await work();
    } finally {
      inFlight.current--;
    }
  }

  const signalsOn = overview.signalSettings?.enabled === true;
  const [signalsBusy, setSignalsBusy] = useState(false);
  async function setSignals(enabled: boolean) {
    setSignalsBusy(true);
    try {
      await mutate(() => floorRequest(outlet.id, "/signals", "PUT", { enabled }));
      setOverview(await fetchOverview(outlet.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change live table signals.");
    } finally {
      setSignalsBusy(false);
    }
  }

  const [waterBusy, setWaterBusy] = useState(false);
  async function waterAction(requestId: string, action: "acknowledge" | "resolve") {
    setWaterBusy(true);
    try {
      await mutate(() => floorRequest(outlet.id, "/water", "POST", { requestId, action }));
      setOverview(await fetchOverview(outlet.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the water request.");
    } finally {
      setWaterBusy(false);
    }
  }

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof Error ? error.message : fallback);

  // ── One tap: toggle a chair ────────────────────────────────────────────────
  async function toggleChair(chair: FloorChair) {
    if (!canSeat) return;
    const next = !chair.occupied;
    setPending((p) => new Set(p).add(chair.id));
    setOverview((o) => withChair(o, chair.id, { occupied: next }));
    try {
      const result = await mutate(() =>
        floorRequest<{ occupied: boolean; version: number }>(
          outlet.id,
          `/chairs/${chair.id}/occupancy`,
          "PUT",
          { occupied: next, version: chair.version }
        )
      );
      setOverview((o) =>
        withChair(o, chair.id, { occupied: result.occupied, version: result.version })
      );
    } catch (error) {
      fail(error, "Could not update that chair.");
      await refresh();
    } finally {
      setPending((p) => {
        const copy = new Set(p);
        copy.delete(chair.id);
        return copy;
      });
    }
  }

  async function seat(table: FloorTableOverview, guests?: number) {
    const result = await mutate(() =>
      floorRequest<{ seated: number }>(outlet.id, `/tables/${table.id}/occupancy`, "POST", {
        ...(guests ? { guests } : {}),
      })
    );
    await refresh();
    toast.success(`Seated ${result.seated} at ${table.name}`);
  }

  async function clear(table: FloorTableOverview) {
    await mutate(() => floorRequest(outlet.id, `/tables/${table.id}/occupancy`, "DELETE"));
    await refresh();
    toast.success(`${table.name} is clear`);
  }

  async function resolveSection(values: TableFormValues): Promise<string | null> {
    if (values.sectionId === "__new") {
      const created = await floorRequest<{ id: string }>(outlet.id, "/sections", "POST", {
        name: values.newSectionName,
      });
      return created.id;
    }
    return values.sectionId || null;
  }

  async function saveTable(values: TableFormValues) {
    const editing = tableDialog.tableId;
    await mutate(async () => {
      const sectionId = await resolveSection(values);
      if (editing) {
        await floorRequest(outlet.id, `/tables/${editing}`, "PATCH", {
          name: values.name,
          displayNumber: values.displayNumber,
          sectionId,
          shape: values.shape,
        });
      } else {
        await floorRequest(outlet.id, "/tables", "POST", {
          name: values.name,
          displayNumber: values.displayNumber,
          sectionId,
          shape: values.shape,
          chairCount: values.chairCount,
          chairKind: values.chairKind,
        });
      }
    });
    await refresh();
    toast.success(editing ? "Table updated" : `Table ${values.displayNumber} created`);
  }

  async function addChairs(input: { count: number; kind: ChairKind; tableId: string | null }) {
    await mutate(() => floorRequest(outlet.id, "/chairs", "POST", input));
    await refresh();
    toast.success(`${input.count} chair${input.count === 1 ? "" : "s"} added`);
  }

  async function updateChair(
    chairId: string,
    patch: { kind?: ChairKind; tableId?: string | null }
  ) {
    try {
      await mutate(() => floorRequest(outlet.id, `/chairs/${chairId}`, "PATCH", patch));
      await refresh();
    } catch (error) {
      fail(error, "Could not update that chair.");
      throw error;
    }
  }

  async function removeChair(chairId: string) {
    try {
      await mutate(() => floorRequest(outlet.id, `/chairs/${chairId}`, "DELETE"));
      await refresh();
    } catch (error) {
      fail(error, "Could not remove that chair.");
      throw error;
    }
  }

  async function archive(table: FloorTableOverview) {
    await mutate(() => floorRequest(outlet.id, `/tables/${table.id}`, "DELETE"));
    await refresh();
    toast.success(`${table.name} archived`);
  }

  async function reserveTable(input: CreateReservationInput) {
    const created = await mutate(() =>
      floorRequest<ReservationItem>(outlet.id, "/reservations", "POST", input)
    );
    await refresh();
    toast.success(`Booked for ${created.guestName}`);
  }

  /** Guests from a booking have arrived: mark the booking seated and take their chairs. */
  async function seatBooking(table: FloorTableOverview) {
    const booking = table.nextReservation;
    if (!booking) return;
    try {
      await mutate(async () => {
        await floorRequest(outlet.id, "/reservations", "PATCH", {
          reservationId: booking.id,
          status: "seated",
        });
        await floorRequest(outlet.id, `/tables/${table.id}/occupancy`, "POST", {
          guests: Math.min(
            booking.partySize,
            Math.max(1, table.maxOccupancy - table.currentOccupancy)
          ),
        });
      });
      await refresh();
      toast.success(`${booking.guestName} seated at ${table.name}`);
    } catch (error) {
      fail(error, "Could not seat this booking.");
      await refresh();
    }
  }

  async function createQr(table: FloorTableOverview) {
    try {
      await mutate(() => floorRequest(outlet.id, "/tables/qr", "POST", { tableId: table.id }));
      await refresh();
      toast.success(`QR code ready for ${table.name}`);
    } catch (error) {
      fail(error, "Could not create the table QR code.");
    }
  }

  const timeFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        timeZone: outlet.timezone,
        hour: "numeric",
        minute: "2-digit",
      }),
    [outlet.timezone]
  );
  const formatTime = useCallback((iso: string) => timeFormat.format(new Date(iso)), [timeFormat]);
  const { headline, detail } = floorHeadline(overview, formatTime);
  const { totals } = overview;
  // Keep the floor meters live as tables and chairs are added or archived.
  const floorUsage = planUsage && {
    ...planUsage,
    meters: planUsage.meters.map((m) =>
      m.key === "tables"
        ? buildMeter("tables", m.label, m.noun, totals.tables, m.cap, undefined, m.upgradeHint)
        : m.key === "chairs"
          ? buildMeter("chairs", m.label, m.noun, totals.chairs, m.cap, undefined, m.upgradeHint)
          : m
    ),
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return overview.tables.filter((t) => {
      if (
        section === "__none" ? t.sectionId !== null : section !== "all" && t.sectionId !== section
      )
        return false;
      return (
        !q || t.name.toLowerCase().includes(q) || String(t.displayNumber) === q.replace(/^#/, "")
      );
    });
  }, [overview.tables, section, query]);
  const groups = groupBySection(overview, visible);
  const sectionById = new Map(overview.sections.map((s) => [s.id, s]));
  const editing = overview.tables.find((t) => t.id === tableDialog.tableId) ?? null;
  const seatTable = overview.tables.find((t) => t.id === seat_.tableId) ?? null;
  const archiveTable = overview.tables.find((t) => t.id === archive_.tableId) ?? null;
  const fillPct = totals.maxOccupancy
    ? Math.round((totals.currentOccupancy / totals.maxOccupancy) * 100)
    : 0;

  return (
    <div className="mm-dashboard product" data-testid="dining-floor">
      <header className={`mm-dashboard-hero ${styles.compactHero}`}>
        <div className={`mm-dashboard-hero-copy ${styles.heroCopy}`}>
          <span className="mm-dashboard-eyebrow">DINING FLOOR · {outlet.name}</span>
          <h1>{headline}</h1>
          <p>{detail}</p>
          {outlet.isDemo && <span className="mm-dashboard-demo">Demo outlet</span>}
          <div className={styles.heroActions}>
            {canManage && (
              <>
                <button
                  type="button"
                  className="mm-dashboard-button mm-dashboard-button--primary"
                  onClick={() => openDialog(setTableDialog, null)}
                >
                  <Plus size={17} aria-hidden="true" /> Add table
                </button>
                <button
                  type="button"
                  className="mm-dashboard-button mm-dashboard-button--secondary"
                  onClick={() => openDialog(setChairsDialog, null)}
                >
                  <Armchair size={17} aria-hidden="true" /> Add chair
                </button>
              </>
            )}
            {canSeat && totals.maxOccupancy > 0 && (
              <button
                type="button"
                className="mm-dashboard-button mm-dashboard-button--secondary"
                onClick={() => openDialog(setReserve, null)}
              >
                <CalendarPlus size={17} aria-hidden="true" /> Reserve
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mm-dashboard-body">
        <PlanMeterStrip view={floorUsage} only={["tables", "chairs"]} />
        <section className={styles.kpis} aria-label="Floor at a glance">
          <div className={styles.kpi}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}>
                <Table2 size={19} aria-hidden="true" />
              </span>
              <span className={styles.kpiLabel}>Total tables</span>
            </div>
            <span className={styles.kpiValue}>{totals.tables}</span>
            <span className={styles.kpiDetail}>{totals.tablesOccupied} in use right now</span>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}>
                <Armchair size={19} aria-hidden="true" />
              </span>
              <span className={styles.kpiLabel}>Total chairs</span>
            </div>
            <span className={styles.kpiValue}>{totals.chairs}</span>
            <span className={styles.kpiDetail}>
              {overview.unassignedChairs.length > 0
                ? `${overview.unassignedChairs.length} not at a table yet`
                : "All chairs are at a table"}
            </span>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}>
                <Users size={19} aria-hidden="true" />
              </span>
              <span className={styles.kpiLabel}>
                Maximum occupancy
                <DashboardTooltip label="maximum occupancy">
                  The total number of chairs across all your tables, which is how many guests you
                  can seat at once.
                </DashboardTooltip>
              </span>
            </div>
            <span className={styles.kpiValue}>
              {totals.currentOccupancy}
              <small> / {totals.maxOccupancy}</small>
            </span>
            <div className={styles.meter} role="img" aria-label={`${fillPct}% of seats taken`}>
              <span style={{ width: `${fillPct}%` }} />
            </div>
            <span className={styles.kpiDetail}>{fillPct}% of seats taken</span>
          </div>
          <div className={styles.kpi}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}>
                <Layers size={19} aria-hidden="true" />
              </span>
              <span className={styles.kpiLabel}>
                Sections
                <DashboardTooltip label="sections">{SECTIONS_HELP}</DashboardTooltip>
              </span>
            </div>
            <span className={styles.kpiValue}>{totals.sections}</span>
            <span className={styles.kpiDetail}>Areas such as Main Dining or Patio</span>
          </div>
        </section>

        {canManage && (
          <section className={styles.signalsCard} aria-labelledby="signals-title">
            <div>
              <h2 id="signals-title">Live table signals</h2>
              <p>
                Optional. Shows each table&apos;s guest journey: QR scanned, order sent, cooking,
                handoff, delivered, bill and payment. Skip it and the floor stays as it is.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={signalsOn}
              className={styles.switch}
              disabled={signalsBusy}
              onClick={() => void setSignals(!signalsOn)}
            >
              <span className={styles.switchKnob} aria-hidden="true" />
              <span>{signalsOn ? "On" : "Off"}</span>
            </button>
          </section>
        )}

        {totals.tables === 0 ? (
          <div className={styles.empty}>
            <Table2 size={34} aria-hidden="true" />
            <h2>Your dining room is empty</h2>
            <p>
              Add a table, give it a name and number, then add chairs. We count the chairs to know
              how many guests you can seat.
            </p>
            {canManage ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => openDialog(setTableDialog, null)}
              >
                <Plus size={16} aria-hidden="true" /> Add your first table
              </button>
            ) : (
              <p>Ask a manager to add tables.</p>
            )}
          </div>
        ) : (
          <>
            <div className={styles.toolbar}>
              <span className={styles.toolbarTitle}>
                Sections <DashboardTooltip label="sections">{SECTIONS_HELP}</DashboardTooltip>
              </span>
              <div className={styles.chips} role="group" aria-label="Filter by section">
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={section === "all"}
                  onClick={() => setSection("all")}
                >
                  All tables · {totals.tables}
                </button>
                {overview.sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={styles.chip}
                    aria-pressed={section === s.id}
                    onClick={() => setSection(s.id)}
                  >
                    <span className={styles.dot} style={{ ["--dot" as string]: s.color }} />
                    {s.name} · {overview.tables.filter((t) => t.sectionId === s.id).length}
                  </button>
                ))}
                {overview.tables.some((t) => !t.sectionId) && overview.sections.length > 0 && (
                  <button
                    type="button"
                    className={styles.chip}
                    aria-pressed={section === "__none"}
                    onClick={() => setSection("__none")}
                  >
                    No section
                  </button>
                )}
              </div>
              <label className="sr-only" htmlFor="floor-search">
                Search tables
              </label>
              <input
                id="floor-search"
                className={styles.search}
                type="search"
                placeholder="Search by name or number"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className={styles.legend} aria-hidden="true">
              <span>
                <span className={styles.dot} style={{ ["--dot" as string]: "var(--decorative)" }} />{" "}
                Free chair
              </span>
              <span>
                <span className={styles.dot} /> Taken chair
              </span>
              {canSeat && (
                <span>Tap a chair to mark it taken or free. Tap the table to seat a party.</span>
              )}
            </div>

            <div className={styles.list}>
              {groups.length === 0 && (
                <p className={styles.help}>No tables match. Try another section or search.</p>
              )}
              {groups.map((group) => (
                <section key={group.id} aria-label={group.name}>
                  {(overview.sections.length > 0 || group.id !== "__none") && (
                    <div className="mm-dashboard-section-heading">
                      <h2 className="mm-dashboard-eyebrow">
                        {group.color && (
                          <span
                            className={styles.dot}
                            style={{ ["--dot" as string]: group.color }}
                          />
                        )}{" "}
                        {group.name}
                      </h2>
                      <span className="mm-dashboard-data-note">
                        {group.tables.length} table{group.tables.length === 1 ? "" : "s"} ·{" "}
                        {group.taken} of {group.seats} seats taken
                      </span>
                    </div>
                  )}
                  <div className={styles.list}>
                    {group.tables.map((table) => (
                      <TableCard
                        key={table.id}
                        table={table}
                        sectionName={
                          table.sectionId ? (sectionById.get(table.sectionId)?.name ?? null) : null
                        }
                        canManage={canManage}
                        canSeat={canSeat}
                        pendingChairIds={pending}
                        formatTime={formatTime}
                        onChairToggle={toggleChair}
                        onSeatDialog={() => openDialog(setSeat, table.id)}
                        onClear={() =>
                          void clear(table).catch((e) => fail(e, "Could not clear the table."))
                        }
                        onEdit={() => openDialog(setTableDialog, table.id)}
                        onAddChairs={() => openDialog(setChairsDialog, table.id)}
                        onReserve={() => openDialog(setReserve, table.id)}
                        onArchive={() => openDialog(setArchive, table.id)}
                        onSeatBooking={() => void seatBooking(table)}
                        onCreateQr={() => void createQr(table)}
                        onWaterAction={canSeat ? waterAction : undefined}
                        waterBusy={waterBusy}
                        onClearStale={() =>
                          void clear(table).catch((e) => fail(e, "Could not clear the table."))
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {overview.unassignedChairs.length > 0 && (
              <section className={styles.tray} aria-label="Chairs without a table">
                <h3>Chairs without a table ({overview.unassignedChairs.length})</h3>
                <p>Assign them to a table so they count toward your seating.</p>
                {overview.unassignedChairs.map((chair, i) => (
                  <div className={styles.trayRow} key={chair.id}>
                    <Armchair size={16} aria-hidden="true" />
                    <span>{chair.label ?? `Chair ${i + 1}`}</span>
                    {canManage && (
                      <>
                        <select
                          className={styles.select}
                          style={{ maxWidth: 240 }}
                          aria-label={`Assign chair ${i + 1} to a table`}
                          value=""
                          onChange={(e) =>
                            e.target.value &&
                            void updateChair(chair.id, { tableId: e.target.value }).catch(
                              () => undefined
                            )
                          }
                        >
                          <option value="">Assign to a table…</option>
                          {overview.tables.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.displayNumber} · {t.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          aria-label={`Remove unassigned chair ${i + 1}`}
                          onClick={() => void removeChair(chair.id).catch(() => undefined)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      <TableDialog
        key={`table-${tableDialog.gen}`}
        open={tableDialog.open}
        onOpenChange={(open) => !open && closeDialog(setTableDialog)}
        overview={overview}
        table={editing}
        onSubmit={saveTable}
        onUpdateChair={updateChair}
        onRemoveChair={removeChair}
      />
      <ChairsDialog
        key={`chairs-${chairsDialog.gen}`}
        open={chairsDialog.open}
        onOpenChange={(open) => !open && closeDialog(setChairsDialog)}
        overview={overview}
        defaultTableId={chairsDialog.tableId}
        onSubmit={addChairs}
      />
      <SeatDialog
        key={`seat-${seat_.gen}`}
        open={seat_.open}
        onOpenChange={(open) => !open && closeDialog(setSeat)}
        table={seatTable}
        onSeat={(guests) => (seatTable ? seat(seatTable, guests) : Promise.resolve())}
        onClear={() => (seatTable ? clear(seatTable) : Promise.resolve())}
      />
      <ArchiveDialog
        key={`archive-${archive_.gen}`}
        open={archive_.open}
        onOpenChange={(open) => !open && closeDialog(setArchive)}
        table={archiveTable}
        onConfirm={() => (archiveTable ? archive(archiveTable) : Promise.resolve())}
      />
      <ReservationDialog
        key={`reserve-${reserve.gen}`}
        open={reserve.open}
        onOpenChange={(open) => !open && closeDialog(setReserve)}
        overview={overview}
        tableId={reserve.tableId}
        timezone={outlet.timezone}
        onSubmit={reserveTable}
      />
    </div>
  );
}

function TableCard({
  table,
  sectionName,
  canManage,
  canSeat,
  pendingChairIds,
  formatTime,
  onChairToggle,
  onSeatDialog,
  onClear,
  onEdit,
  onAddChairs,
  onReserve,
  onArchive,
  onSeatBooking,
  onCreateQr,
  onClearStale,
  onWaterAction,
  waterBusy,
}: {
  table: FloorTableOverview;
  sectionName: string | null;
  canManage: boolean;
  canSeat: boolean;
  pendingChairIds: ReadonlySet<string>;
  formatTime: (iso: string) => string;
  onChairToggle: (chair: FloorChair) => void;
  onSeatDialog: () => void;
  onClear: () => void;
  onEdit: () => void;
  onAddChairs: () => void;
  onReserve: () => void;
  onArchive: () => void;
  onSeatBooking: () => void;
  onCreateQr: () => void;
  onClearStale: () => void;
  onWaterAction?: (requestId: string, action: "acknowledge" | "resolve") => void;
  waterBusy: boolean;
}) {
  const free = table.maxOccupancy - table.currentOccupancy;
  const tone = table.state === "full" ? "full" : table.state === "partial" ? "busy" : "muted";
  const status =
    table.state === "no_chairs"
      ? "No chairs yet"
      : table.state === "empty"
        ? "Free"
        : table.state === "full"
          ? "Full"
          : `${table.currentOccupancy} seated`;

  return (
    <article
      className={styles.card}
      id={`table-${table.id}`}
      aria-label={`Table ${table.displayNumber}, ${table.name}`}
    >
      <div className={styles.cardHead}>
        <span className={styles.number} aria-hidden="true">
          {table.displayNumber}
        </span>
        <div className={styles.cardTitle}>
          <h3>{table.name}</h3>
          <div className={styles.cardSub}>
            <span className={styles.pill} data-tone={tone}>
              {status}
            </span>
            {sectionName && <span>{sectionName}</span>}
            <span>
              {table.maxOccupancy} seat{table.maxOccupancy === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className={styles.cardActions}>
          {canSeat && free > 0 && table.maxOccupancy > 0 && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={onSeatDialog}
            >
              <Users size={15} aria-hidden="true" /> Seat party
            </button>
          )}
          {canSeat && table.currentOccupancy > 0 && (
            <button type="button" className={`${styles.btn} ${styles.btnQuiet}`} onClick={onClear}>
              Clear table
            </button>
          )}
          {canManage && table.maxOccupancy === 0 && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={onAddChairs}
            >
              <Armchair size={15} aria-hidden="true" /> Add chairs
            </button>
          )}
          <Menu.Root>
            <Menu.Trigger asChild>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`More actions for ${table.name}`}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className={styles.menu} align="end" sideOffset={6}>
                {canManage && (
                  <Menu.Item className={styles.menuItem} onSelect={onAddChairs}>
                    <Armchair size={16} aria-hidden="true" /> Add chairs
                  </Menu.Item>
                )}
                {canSeat && table.maxOccupancy > 0 && (
                  <Menu.Item className={styles.menuItem} onSelect={onReserve}>
                    <CalendarPlus size={16} aria-hidden="true" /> Reserve
                  </Menu.Item>
                )}
                {canManage && (
                  <Menu.Item className={styles.menuItem} onSelect={onEdit}>
                    <Pencil size={16} aria-hidden="true" /> Edit table
                  </Menu.Item>
                )}
                {canManage &&
                  (table.qrCode ? (
                    <Menu.Item className={styles.menuItem} asChild>
                      <Link href="/dashboard/qr-codes">
                        <QrCode size={16} aria-hidden="true" /> Open table QR
                      </Link>
                    </Menu.Item>
                  ) : (
                    <Menu.Item className={styles.menuItem} onSelect={onCreateQr}>
                      <QrCode size={16} aria-hidden="true" /> Create table QR
                    </Menu.Item>
                  ))}
                {canManage && (
                  <Menu.Item className={styles.menuItem} data-danger="true" onSelect={onArchive}>
                    <Trash2 size={16} aria-hidden="true" /> Archive table
                  </Menu.Item>
                )}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.stage}>
          {table.maxOccupancy === 0 ? (
            <div className={styles.emptyStage}>
              <Armchair size={28} aria-hidden="true" />
              <span>This table has no chairs yet.</span>
              {canManage && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnQuiet}`}
                  onClick={onAddChairs}
                >
                  Add chairs
                </button>
              )}
            </div>
          ) : (
            <TableIllustration
              table={table}
              canSeat={canSeat}
              pendingChairIds={pendingChairIds}
              onChairToggle={onChairToggle}
              onTableTap={onSeatDialog}
            />
          )}
        </div>
        <div className={styles.facts}>
          <dl className={styles.factList}>
            <div className={styles.fact}>
              <dt>Seated now</dt>
              <dd>
                <span className={styles.big}>
                  {table.currentOccupancy}
                  <small className={styles.mono}> / {table.maxOccupancy}</small>
                </span>
              </dd>
            </div>
            {table.stale && (
              <div className={styles.hint} data-tone="warn" role="status">
                <CalendarClock size={16} aria-hidden="true" />
                <span>Still occupied? No open order for a few hours.</span>
                {canSeat && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnQuiet}`}
                    onClick={onClearStale}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
            {(table.activeOrders > 0 || table.unpaidOrders > 0) && (
              <div className={styles.hint}>
                <Receipt size={16} aria-hidden="true" />
                <span>
                  {table.activeOrders > 0 &&
                    `${table.activeOrders} open order${table.activeOrders === 1 ? "" : "s"}`}
                  {table.activeOrders > 0 && table.unpaidOrders > 0 && " · "}
                  {table.unpaidOrders > 0 && `${table.unpaidOrders} unpaid`}
                </span>
              </div>
            )}
            {table.nextReservation && (
              <div className={styles.hint}>
                <CalendarClock size={16} aria-hidden="true" />
                <span>
                  {formatTime(table.nextReservation.time)} · {table.nextReservation.guestName} (
                  {table.nextReservation.partySize})
                </span>
                {canSeat && free > 0 && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnQuiet}`}
                    onClick={onSeatBooking}
                  >
                    Seat them
                  </button>
                )}
              </div>
            )}
          </dl>
          {table.journey && (
            <JourneyStrip
              journey={table.journey}
              tableName={table.name}
              onWaterAction={onWaterAction}
              busy={waterBusy}
            />
          )}
        </div>
      </div>
    </article>
  );
}
