"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  Table2,
  CalendarDays,
  RefreshCw,
  ArrowRight,
  Plus,
  Users,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import type {
  FloorLayoutDoc,
  VisualTable,
  TableLiveStatus,
  ReservationItem,
  CreateReservationInput,
  TableShape,
} from "@/modules/hospitality/floor-contracts";
import type { FloorTable } from "@/modules/hospitality/floor-matrix";
import { DiningFloorCanvas } from "./dining-floor-canvas";
import { DiningFloorHud } from "./dining-floor-hud";
import { TableInspectorDrawer } from "./table-inspector-drawer";
import { ReservationDialog } from "./reservation-dialog";
import { TableFloorMatrix } from "@/components/dashboard/table-floor-matrix";
import { ServiceRequestsPanel } from "@/components/dashboard/service-requests-panel";
import { useHaptics } from "@/lib/use-haptics";
import "./floor-system.css";

interface DiningFloorContainerProps {
  initialLayout: FloorLayoutDoc;
  initialOrderMatrix: FloorTable[] | null;
  initialQrCodes: Array<{
    id: string;
    label: string | null;
    destinationToken: string;
    isActive: boolean;
    tableId?: string | null;
    pointLabel?: string | null;
  }>;
  initialReservations: ReservationItem[];
  outlet: {
    id: string;
    organizationId: string;
    name: string;
    currency: string;
    timezone: string;
  };
  origin: string;
  focusTableId?: string;
}

export function DiningFloorContainer({
  initialLayout,
  initialOrderMatrix,
  initialQrCodes,
  initialReservations,
  outlet,
  origin,
  focusTableId,
}: DiningFloorContainerProps) {
  const [viewMode, setViewMode] = useState<"canvas" | "matrix" | "reservations">("canvas");
  const [layout, setLayout] = useState<FloorLayoutDoc>(initialLayout);
  const [orderMatrix, setOrderMatrix] = useState<FloorTable[] | null>(initialOrderMatrix);
  const [qrCodes, setQrCodes] = useState(initialQrCodes);
  const [reservations, setReservations] = useState<ReservationItem[]>(initialReservations);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(focusTableId ?? null);
  const [inspectorOpen, setInspectorOpen] = useState(Boolean(focusTableId));
  const [activeSection, setActiveSection] = useState<string>("all");
  const [selectedHour, setSelectedHour] = useState<string>("now");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [zoom, setZoom] = useState(1.0);
  const [resDialogOpen, setResDialogOpen] = useState(false);
  const [resDialogTable, setResDialogTable] = useState<VisualTable | null>(null);

  const haptics = useHaptics(hapticsEnabled);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced auto-save of floor layout
  const persistLayout = useCallback(
    (nextLayout: FloorLayoutDoc) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        try {
          await fetch("/api/floor", {
            method: "PUT",
            headers: {
              "content-type": "application/json",
              "x-outlet-id": outlet.id,
            },
            body: JSON.stringify(nextLayout),
          });
        } catch {
          // Layout auto-save failure handled gracefully
        }
      }, 500);
    },
    [outlet.id]
  );

  const handleLayoutChange = useCallback(
    (nextLayout: FloorLayoutDoc) => {
      setLayout(nextLayout);
      persistLayout(nextLayout);
    },
    [persistLayout]
  );

  // Map live statuses per table
  const tableStatuses = useMemo(() => {
    const map: Record<string, TableLiveStatus> = {};
    const ordersMap = new Map<string, FloorTable>();
    for (const ot of orderMatrix ?? []) {
      ordersMap.set(ot.id, ot);
    }

    const qrByTableId = new Map<string, (typeof qrCodes)[0]>();
    for (const q of qrCodes) {
      if (q.tableId && q.isActive) {
        qrByTableId.set(q.tableId, q);
      }
    }

    for (const t of layout.tables) {
      const order = ordersMap.get(t.id);
      const activeOrders = order?.activeOrders ?? 0;
      const unpaidOrders = order?.unpaidOrders ?? 0;
      const dueMinor = order?.dueMinor ?? "0";
      const qr = qrByTableId.get(t.id);

      // Check upcoming reservation for this table
      const upcomingRes = reservations.find(
        (r) => r.tableId === t.id && (r.status === "confirmed" || r.status === "seated")
      );

      let state: TableLiveStatus["state"] = "available";
      if (unpaidOrders > 0) state = "unpaid";
      else if (activeOrders > 0) state = "active";
      else if (upcomingRes && selectedHour !== "now") state = "reserved";
      else if (upcomingRes?.status === "seated") state = "active";

      map[t.id] = {
        state,
        activeOrders,
        unpaidOrders,
        dueMinor,
        currency: outlet.currency,
        latestOrderId: order?.latestOrderId ?? null,
        upcomingReservation: upcomingRes
          ? {
              id: upcomingRes.id,
              guestName: upcomingRes.guestName,
              partySize: upcomingRes.partySize,
              time: upcomingRes.reservationTime,
              notes: upcomingRes.notes,
            }
          : undefined,
        qrCode: qr
          ? {
              id: qr.id,
              destinationToken: qr.destinationToken,
              label: qr.label ?? `Table ${t.tableNumber}`,
              isActive: qr.isActive,
            }
          : undefined,
      };
    }
    return map;
  }, [layout.tables, orderMatrix, qrCodes, reservations, selectedHour, outlet.currency]);

  // Handle table addition from HUD
  const handleAddTable = async (template: {
    shape: TableShape;
    capacity: number;
    width: number;
    height: number;
    label?: string;
  }) => {
    haptics.confirm();
    const newId = crypto.randomUUID();
    const existingNums = layout.tables
      .map((t) => parseInt(t.tableNumber, 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;

    const newTable: VisualTable = {
      id: newId,
      tableNumber: String(nextNum),
      label: template.label ?? `Table ${nextNum}`,
      capacity: template.capacity,
      shape: template.shape,
      x: 200 + ((layout.tables.length * 30) % 300),
      y: 200 + ((layout.tables.length * 30) % 300),
      width: template.width,
      height: template.height,
      rotation: 0,
      section: activeSection !== "all" ? activeSection : layout.sections[0]?.name || "Main Dining",
      assignedStaff: null,
    };

    const nextLayout = {
      ...layout,
      tables: [...layout.tables, newTable],
    };

    setLayout(nextLayout);
    setSelectedTableId(newId);
    setInspectorOpen(true);
    persistLayout(nextLayout);

    try {
      await fetch("/api/floor/tables", {
        method: "POST",
        headers: { "content-type": "application/json", "x-outlet-id": outlet.id },
        body: JSON.stringify(newTable),
      });
      toast.success(`Table ${newTable.tableNumber} created on floor`);
    } catch {
      // Background sync handles persistence
    }
  };

  // Generate Table QR Code via /api/qr
  const handleGenerateQr = async (table: VisualTable) => {
    const key = crypto.randomUUID();
    const pointLabel = `Table ${table.tableNumber}`;
    const res = await fetch("/api/qr", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-outlet-id": outlet.id,
      },
      body: JSON.stringify({
        key,
        action: "create",
        data: {
          label: pointLabel,
          pointLabel,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to create tabletop QR");
    }

    const result = (await res.json()) as { id: string; token: string };

    // Update local QR inventory
    setQrCodes((prev) => [
      ...prev,
      {
        id: result.id,
        label: pointLabel,
        destinationToken: result.token,
        isActive: true,
        tableId: table.id,
        pointLabel,
      },
    ]);
  };

  // Create new reservation
  const handleCreateReservation = async (input: CreateReservationInput) => {
    const res = await fetch("/api/floor/reservations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-outlet-id": outlet.id,
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to create reservation");
    }

    const created = (await res.json()) as ReservationItem;
    setReservations((prev) => [...prev, created]);
    toast.success(`Reservation confirmed for ${created.guestName}`);
  };

  // Seat reservation
  const handleSeatReservation = async (resId: string) => {
    haptics.confirm();
    const res = await fetch("/api/floor/reservations", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-outlet-id": outlet.id,
      },
      body: JSON.stringify({
        reservationId: resId,
        status: "seated",
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to seat party");
    }

    setReservations((prev) => prev.map((r) => (r.id === resId ? { ...r, status: "seated" } : r)));
    toast.success("Party seated at table");
  };

  // Refresh floor data
  const handleRefresh = async () => {
    haptics.tick();
    try {
      const res = await fetch("/api/floor", {
        headers: { "x-outlet-id": outlet.id },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.layout) setLayout(data.layout);
        if (data.orderMatrix) setOrderMatrix(data.orderMatrix);
        if (data.qrCodes) setQrCodes(data.qrCodes);
        if (data.reservations) setReservations(data.reservations);
        toast.success("Dining floor refreshed");
      }
    } catch {
      toast.error("Failed to refresh floor data");
    }
  };

  const selectedTable = layout.tables.find((t) => t.id === selectedTableId) ?? null;

  return (
    <div className="mm-floor-system" data-testid="dining-floor-system">
      {/* 1. Floor Topbar & View Switcher */}
      <div className="mm-floor-topbar">
        <div className="mm-floor-heading">
          <h1>Dining Floor</h1>
          <p>
            {outlet.name} · {layout.tables.length} tables ·{" "}
            {qrCodes.filter((q) => q.isActive && q.tableId).length} tabletop QR standees
          </p>
        </div>

        <div className="mm-floor-top-actions">
          {/* View Mode Segmented Switcher */}
          <div
            className="mm-view-mode-switcher"
            role="tablist"
            aria-label="Dining floor view modes"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "canvas"}
              className={`mm-view-btn ${viewMode === "canvas" ? "is-active" : ""}`}
              onClick={() => {
                haptics.tick();
                setViewMode("canvas");
              }}
            >
              <LayoutGrid size={15} aria-hidden="true" />
              <span>Visual Floor</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "matrix"}
              className={`mm-view-btn ${viewMode === "matrix" ? "is-active" : ""}`}
              onClick={() => {
                haptics.tick();
                setViewMode("matrix");
              }}
            >
              <Table2 size={15} aria-hidden="true" />
              <span>Service Matrix</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "reservations"}
              className={`mm-view-btn ${viewMode === "reservations" ? "is-active" : ""}`}
              onClick={() => {
                haptics.tick();
                setViewMode("reservations");
              }}
            >
              <CalendarDays size={15} aria-hidden="true" />
              <span>Bookings ({reservations.length})</span>
            </button>
          </div>

          <button
            type="button"
            className="mm-hud-icon-btn border-border border"
            onClick={handleRefresh}
            title="Refresh Floor"
            aria-label="Refresh dining floor data"
          >
            <RefreshCw size={15} aria-hidden="true" />
          </button>

          <Link
            href="/dashboard/qr-codes"
            className="mm-action-btn mm-action-outline hidden text-xs sm:inline-flex"
          >
            QR Studio <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* 2. Primary Mode Views */}
      {viewMode === "canvas" && (
        <div className="relative w-full flex-1">
          {/* Floating Minimal HUD */}
          <DiningFloorHud
            sections={layout.sections}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            onAddTable={handleAddTable}
            snapEnabled={snapEnabled}
            onToggleSnap={() => {
              haptics.tick();
              setSnapEnabled((s) => !s);
            }}
            hapticsEnabled={hapticsEnabled}
            onToggleHaptics={() => {
              setHapticsEnabled((h) => !h);
            }}
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
            onZoomOut={() => setZoom((z) => Math.max(0.45, Number((z - 0.15).toFixed(2))))}
            onResetZoom={() => setZoom(1.0)}
            selectedHour={selectedHour}
            onSelectHour={setSelectedHour}
          />

          {/* Direct Manipulation SVG Canvas */}
          <DiningFloorCanvas
            layout={layout}
            onChangeLayout={handleLayoutChange}
            selectedTableId={selectedTableId}
            onSelectTable={(t) => {
              setSelectedTableId(t?.id ?? null);
              if (t) setInspectorOpen(true);
            }}
            tableStatuses={tableStatuses}
            snapEnabled={snapEnabled}
            hapticsEnabled={hapticsEnabled}
            zoom={zoom}
            onOpenInspector={(t) => {
              setSelectedTableId(t.id);
              setInspectorOpen(true);
            }}
            activeSectionFilter={activeSection}
          />

          {/* Drawer-on-Demand (Table Inspector & QR Bridge) */}
          {inspectorOpen && selectedTable && (
            <TableInspectorDrawer
              table={selectedTable}
              status={tableStatuses[selectedTable.id]}
              sections={layout.sections}
              reservations={reservations}
              currency={outlet.currency}
              origin={origin}
              outletId={outlet.id}
              outletName={outlet.name}
              onClose={() => {
                setInspectorOpen(false);
                setSelectedTableId(null);
              }}
              onUpdateTable={(updated) => {
                const nextLayout = {
                  ...layout,
                  tables: layout.tables.map((t) => (t.id === updated.id ? updated : t)),
                };
                handleLayoutChange(nextLayout);
              }}
              onGenerateQr={handleGenerateQr}
              onOpenNewReservation={(t) => {
                setResDialogTable(t);
                setResDialogOpen(true);
              }}
              onSeatReservation={handleSeatReservation}
            />
          )}
        </div>
      )}

      {viewMode === "matrix" && (
        <div className="p-6">
          <div className="mm-floor-grid">
            <TableFloorMatrix
              tables={orderMatrix}
              currency={outlet.currency}
              focusTableId={selectedTableId ?? undefined}
            />
            <ServiceRequestsPanel
              organizationId={outlet.organizationId}
              outletId={outlet.id}
              timezone={outlet.timezone}
            />
          </div>
        </div>
      )}

      {viewMode === "reservations" && (
        <div className="mx-auto w-full max-w-5xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Daily Table Reservations</h2>
              <p className="text-muted-foreground text-sm">
                Time-slot reservations and guest party arrivals for {outlet.name}.
              </p>
            </div>
            <button
              type="button"
              className="mm-action-btn mm-action-primary"
              onClick={() => {
                setResDialogTable(layout.tables[0] ?? null);
                setResDialogOpen(true);
              }}
            >
              <Plus size={15} /> New Reservation
            </button>
          </div>

          {reservations.length === 0 ? (
            <div className="border-border bg-panel rounded-2xl border border-dashed p-12 text-center">
              <CalendarDays size={36} className="text-muted-foreground/60 mx-auto mb-3" />
              <h3 className="text-base font-bold">No reservations scheduled today</h3>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                All tables are currently open for walk-in dining guests.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {reservations.map((res) => {
                const assigned = layout.tables.find((t) => t.id === res.tableId);
                return (
                  <div
                    key={res.id}
                    className="border-border bg-card flex flex-col justify-between rounded-2xl border p-5 shadow-sm"
                  >
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-display text-foreground text-lg font-bold">
                          {res.guestName}
                        </span>
                        <span className={`mm-res-status mm-res-${res.status}`}>
                          {res.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-muted-foreground mb-3 flex items-center gap-3 text-xs">
                        <span className="text-foreground font-semibold">
                          {assigned
                            ? `Table ${assigned.tableNumber} (${assigned.section})`
                            : "Unassigned Table"}
                        </span>
                        <span>·</span>
                        <span>
                          <Users size={12} className="mr-1 inline" />
                          {res.partySize} Guests
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(res.reservationTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {res.notes && (
                        <p className="text-muted-foreground mb-4 text-xs italic">
                          &ldquo;{res.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="border-border/60 flex items-center justify-between border-t pt-3">
                      <span className="text-muted-foreground text-xs">
                        {res.guestPhone ?? "No contact phone"}
                      </span>
                      {res.status === "confirmed" && (
                        <button
                          type="button"
                          className="mm-seat-btn"
                          onClick={() => handleSeatReservation(res.id)}
                        >
                          <CheckCircle2 size={13} /> Seat Guests
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reservation Dialog Modal */}
      <ReservationDialog
        open={resDialogOpen}
        onClose={() => setResDialogOpen(false)}
        tables={layout.tables}
        selectedTable={resDialogTable}
        onSubmit={handleCreateReservation}
      />
    </div>
  );
}
