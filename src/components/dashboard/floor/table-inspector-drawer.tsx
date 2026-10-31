"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  X,
  QrCode,
  Printer,
  Copy,
  ExternalLink,
  Users,
  CheckCircle2,
  BellRing,
  CreditCard,
  UtensilsCrossed,
  Sparkles,
  CalendarDays,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import type {
  VisualTable,
  TableLiveStatus,
  TableShape,
  DiningSection,
  ReservationItem,
} from "@/modules/hospitality/floor-contracts";
import { useHaptics } from "@/lib/use-haptics";

interface TableInspectorDrawerProps {
  table: VisualTable | null;
  status?: TableLiveStatus;
  sections: DiningSection[];
  reservations: ReservationItem[];
  currency: string;
  origin: string;
  outletId: string;
  outletName: string;
  onClose: () => void;
  onUpdateTable: (updated: VisualTable) => void;
  onGenerateQr: (table: VisualTable) => Promise<void>;
  onResolveServiceRequest?: (requestId: string) => Promise<void>;
  onOpenNewReservation: (table: VisualTable) => void;
  onSeatReservation: (resId: string) => Promise<void>;
}

function TableSpecsForm({
  table,
  sections,
  onSave,
}: {
  table: VisualTable;
  sections: DiningSection[];
  onSave: (updated: VisualTable) => void;
}) {
  const [tableNumber, setTableNumber] = useState(table.tableNumber);
  const [label, setLabel] = useState(table.label ?? "");
  const [capacity, setCapacity] = useState(table.capacity);
  const [shape, setShape] = useState<TableShape>(table.shape);
  const [section, setSection] = useState(table.section);
  const [assignedStaff, setAssignedStaff] = useState(table.assignedStaff ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...table,
      tableNumber: tableNumber.trim() || table.tableNumber,
      label: label.trim() || null,
      capacity,
      shape,
      section,
      assignedStaff: assignedStaff.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mm-drawer-form">
      <div className="mm-form-row">
        <label htmlFor="input-table-number">Table Identifier</label>
        <input
          id="input-table-number"
          type="text"
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          placeholder="e.g. 12 or Patio-4"
          maxLength={30}
          required
        />
      </div>

      <div className="mm-form-row">
        <label htmlFor="input-table-label">Descriptive Label</label>
        <input
          id="input-table-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Window Booth, Corner Table"
          maxLength={80}
        />
      </div>

      <div className="mm-form-row">
        <label htmlFor="select-table-shape">Table Shape</label>
        <select
          id="select-table-shape"
          value={shape}
          onChange={(e) => setShape(e.target.value as TableShape)}
        >
          <option value="round">Round Table (Radial seating)</option>
          <option value="square">Square Table (Symmetric)</option>
          <option value="rectangle">Rectangle Table (Linear)</option>
          <option value="booth">Banquette Booth (Padded back)</option>
          <option value="bar">Bar Counter (Stools)</option>
        </select>
      </div>

      <div className="mm-form-row">
        <label>Seating Capacity</label>
        <div className="mm-stepper">
          <button
            type="button"
            onClick={() => setCapacity((c) => Math.max(1, c - 1))}
            disabled={capacity <= 1}
          >
            -
          </button>
          <span>{capacity} Chairs</span>
          <button
            type="button"
            onClick={() => setCapacity((c) => Math.min(24, c + 1))}
            disabled={capacity >= 24}
          >
            +
          </button>
        </div>
      </div>

      <div className="mm-form-row">
        <label htmlFor="select-table-section">Dining Section</label>
        <select
          id="select-table-section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          {sections.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mm-form-row">
        <label htmlFor="input-table-staff">Assigned Server / Staff</label>
        <input
          id="input-table-staff"
          type="text"
          value={assignedStaff}
          onChange={(e) => setAssignedStaff(e.target.value)}
          placeholder="e.g. Carlos or Sarah"
          maxLength={60}
        />
      </div>

      <button type="submit" className="mm-drawer-submit-btn">
        Save Table Configuration
      </button>
    </form>
  );
}

export function TableInspectorDrawer({
  table,
  status,
  sections,
  reservations,
  currency,
  origin,
  outletName,
  onClose,
  onUpdateTable,
  onGenerateQr,
  onResolveServiceRequest,
  onOpenNewReservation,
  onSeatReservation,
}: TableInspectorDrawerProps) {
  const haptics = useHaptics(true);
  const [activeTab, setActiveTab] = useState<"specs" | "qr" | "orders" | "reservations">("specs");
  const [qrSvg, setQrSvg] = useState<string>("");
  const [generatingQr, setGeneratingQr] = useState(false);
  const [resolvingBell, setResolvingBell] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Construct target ordering URL for QR
  const qrToken = status?.qrCode?.destinationToken;
  const tableOrderUrl = qrToken ? `${origin}/m/${encodeURIComponent(qrToken)}` : "";

  // Generate SVG QR representation on client asynchronously
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      if (cancelled) return;
      if (!tableOrderUrl) {
        setQrSvg("");
        return;
      }
      try {
        const svg = await QRCode.toString(tableOrderUrl, {
          type: "svg",
          margin: 1,
          color: { dark: "#1c1917", light: "#ffffff" },
        });
        if (!cancelled) setQrSvg(svg);
      } catch {
        if (!cancelled) setQrSvg("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tableOrderUrl]);

  if (!table) return null;

  const handleCopyLink = () => {
    if (!tableOrderUrl) return;
    navigator.clipboard.writeText(tableOrderUrl);
    haptics.tick();
    toast.success("Table ordering URL copied to clipboard");
  };

  const handleGenerateQrClick = async () => {
    setGeneratingQr(true);
    try {
      await onGenerateQr(table);
      haptics.confirm();
      toast.success(`Permanent QR code created for Table ${table.tableNumber}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate QR code");
    } finally {
      setGeneratingQr(false);
    }
  };

  const handleResolveBell = async (reqId: string) => {
    if (!onResolveServiceRequest) return;
    setResolvingBell(true);
    try {
      await onResolveServiceRequest(reqId);
      haptics.confirm();
      toast.success("Service request resolved");
    } catch {
      toast.error("Failed to resolve request");
    } finally {
      setResolvingBell(false);
    }
  };

  const tableReservations = reservations.filter(
    (r) => r.tableId === table.id && r.status !== "cancelled"
  );

  const formatCurrency = (minor: string) => {
    const dec =
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2;
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      Number(minor) / 10 ** dec
    );
  };

  return (
    <>
      <div className="mm-drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside
        className="mm-table-drawer"
        role="dialog"
        aria-labelledby="drawer-table-heading"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="mm-drawer-header">
          <div>
            <div className="mm-drawer-badge-row">
              <span className={`mm-status-pill mm-pill-${status?.state ?? "available"}`}>
                {status?.state?.toUpperCase() ?? "AVAILABLE"}
              </span>
              <span className="mm-section-chip">{table.section}</span>
            </div>
            <h2 id="drawer-table-heading" className="mm-drawer-title">
              Table {table.tableNumber}
              {table.label && <span className="mm-drawer-subtitle"> · {table.label}</span>}
            </h2>
          </div>
          <button
            type="button"
            className="mm-drawer-close"
            onClick={onClose}
            aria-label="Close table details drawer"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="mm-drawer-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "specs"}
            className={`mm-tab-btn ${activeTab === "specs" ? "is-active" : ""}`}
            onClick={() => setActiveTab("specs")}
          >
            Table Specs
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "qr"}
            className={`mm-tab-btn ${activeTab === "qr" ? "is-active" : ""}`}
            onClick={() => setActiveTab("qr")}
          >
            <QrCode size={13} className="mr-1 inline" /> Table QR
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "orders"}
            className={`mm-tab-btn ${activeTab === "orders" ? "is-active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            Orders & Bill
            {status?.unpaidOrders ? <span className="mm-tab-alert-dot" /> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reservations"}
            className={`mm-tab-btn ${activeTab === "reservations" ? "is-active" : ""}`}
            onClick={() => setActiveTab("reservations")}
          >
            Bookings ({tableReservations.length})
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="mm-drawer-body">
          {/* TAB 1: SPECS */}
          {activeTab === "specs" && (
            <TableSpecsForm
              key={table.id}
              table={table}
              sections={sections}
              onSave={(updated) => {
                haptics.confirm();
                onUpdateTable(updated);
                toast.success(`Table ${updated.tableNumber} updated`);
              }}
            />
          )}

          {/* TAB 2: QR GENERATOR BRIDGE */}
          {activeTab === "qr" && (
            <div className="mm-qr-bridge-panel">
              {status?.qrCode?.isActive ? (
                <>
                  <div className="mm-qr-card">
                    {qrSvg ? (
                      <div
                        className="mm-qr-svg-preview"
                        dangerouslySetInnerHTML={{ __html: qrSvg }}
                      />
                    ) : (
                      <div className="mm-qr-placeholder">
                        <QrCode size={48} />
                      </div>
                    )}
                    <div className="mm-qr-meta">
                      <span className="mm-qr-kicker">PERMANENT SERVICE POINT</span>
                      <h3>Table {table.tableNumber} Standee</h3>
                      <p className="text-muted-foreground truncate text-xs">{tableOrderUrl}</p>
                    </div>
                  </div>

                  <div className="mm-qr-actions">
                    <button
                      type="button"
                      className="mm-action-btn mm-action-outline"
                      onClick={handleCopyLink}
                    >
                      <Copy size={14} /> Copy Table Link
                    </button>
                    <button
                      type="button"
                      className="mm-action-btn mm-action-primary"
                      onClick={() => setPrintModalOpen(true)}
                    >
                      <Printer size={14} /> Print Table Standee
                    </button>
                  </div>

                  <div className="mm-qr-subnote">
                    <p>
                      Scanning this QR automatically routes diners to Table {table.tableNumber}.
                      Menu updates publish immediately without re-printing.
                    </p>
                    <Link
                      href="/dashboard/qr-codes"
                      className="mm-qr-link mt-2 inline-flex items-center gap-1 text-xs font-semibold"
                    >
                      Manage in QR Studio <ExternalLink size={12} />
                    </Link>
                  </div>
                </>
              ) : (
                <div className="mm-qr-missing-state">
                  <div className="mm-qr-missing-icon">
                    <QrCode size={36} />
                  </div>
                  <h3>No Tabletop QR Assigned</h3>
                  <p>
                    This table does not have an active QR code service point yet. Generate one in
                    one click to let guests order directly from Table {table.tableNumber}.
                  </p>
                  <button
                    type="button"
                    className="mm-action-btn mm-action-primary mt-4 w-full"
                    onClick={handleGenerateQrClick}
                    disabled={generatingQr}
                  >
                    <Sparkles size={15} />
                    {generatingQr
                      ? "Generating QR Code..."
                      : `Generate QR for Table ${table.tableNumber}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ORDERS & BILLING */}
          {activeTab === "orders" && (
            <div className="mm-orders-panel">
              {/* Service Request Bell Card (if ringing) */}
              {status?.hasServiceRequest && (
                <div className="mm-service-bell-card">
                  <div className="mm-bell-icon-pulse">
                    <BellRing size={20} />
                  </div>
                  <div className="mm-bell-content">
                    <strong>
                      {status.hasServiceRequest.signal === "water_refill"
                        ? "Water Refill Requested"
                        : status.hasServiceRequest.signal === "bill_request"
                          ? "Bill Payment Requested"
                          : "Server Called to Table"}
                    </strong>
                    <span className="text-xs text-amber-900/80 dark:text-amber-300">
                      Ringing at Table {table.tableNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="mm-resolve-btn"
                    onClick={() => handleResolveBell(status.hasServiceRequest!.id)}
                    disabled={resolvingBell}
                  >
                    Resolve
                  </button>
                </div>
              )}

              {/* Order metrics */}
              <div className="mm-order-stats-grid">
                <div className="mm-stat-box">
                  <span className="mm-stat-label">Active Orders</span>
                  <strong className="mm-stat-val">{status?.activeOrders ?? 0}</strong>
                </div>
                <div className="mm-stat-box">
                  <span className="mm-stat-label">Unpaid Tabs</span>
                  <strong className={`mm-stat-val ${status?.unpaidOrders ? "text-rose-600" : ""}`}>
                    {status?.unpaidOrders ?? 0}
                  </strong>
                </div>
                <div className="mm-stat-box col-span-2">
                  <span className="mm-stat-label">Total Amount Due</span>
                  <strong className="mm-stat-val text-xl">
                    {formatCurrency(status?.dueMinor ?? "0")}
                  </strong>
                </div>
              </div>

              {/* Quick links */}
              <div className="mm-order-links">
                {status?.latestOrderId ? (
                  <Link
                    href={`/dashboard/pos?attachOrder=${encodeURIComponent(status.latestOrderId)}`}
                    className="mm-action-btn mm-action-primary w-full justify-center"
                  >
                    <CreditCard size={15} /> Open in POS Till
                  </Link>
                ) : null}
                <Link
                  href="/dashboard/orders"
                  className="mm-action-btn mm-action-outline w-full justify-center"
                >
                  <UtensilsCrossed size={15} /> View Kitchen Orders Rail
                </Link>
              </div>
            </div>
          )}

          {/* TAB 4: RESERVATIONS */}
          {activeTab === "reservations" && (
            <div className="mm-reservations-panel">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Today&apos;s Bookings
                </span>
                <button
                  type="button"
                  className="mm-res-add-btn text-brand-700 dark:text-brand-300 inline-flex items-center gap-1 text-xs font-semibold"
                  onClick={() => onOpenNewReservation(table)}
                >
                  <Plus size={13} /> Add Booking
                </button>
              </div>

              {tableReservations.length === 0 ? (
                <div className="mm-res-empty">
                  <CalendarDays size={28} className="text-muted-foreground/60 mb-2" />
                  <p className="text-sm font-semibold">No bookings for this table</p>
                  <p className="text-muted-foreground text-xs">
                    Table {table.tableNumber} is open for walk-ins or new reservations.
                  </p>
                </div>
              ) : (
                <ul className="mm-res-list">
                  {tableReservations.map((r) => (
                    <li key={r.id} className="mm-res-item">
                      <div className="mm-res-item-head">
                        <strong>{r.guestName}</strong>
                        <span className={`mm-res-status mm-res-${r.status}`}>
                          {r.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="mm-res-item-details">
                        <span>
                          <Users size={12} className="mr-1 inline" />
                          {r.partySize} Guests
                        </span>
                        <span>
                          {new Date(r.reservationTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {r.notes && <p className="mm-res-notes">&ldquo;{r.notes}&rdquo;</p>}
                      {r.status === "confirmed" && (
                        <button
                          type="button"
                          className="mm-seat-btn"
                          onClick={() => onSeatReservation(r.id)}
                        >
                          <CheckCircle2 size={13} /> Seat Party Now
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Printable Standee Sheet Modal Preview */}
      {printModalOpen && (
        <div className="mm-print-modal-overlay" onClick={() => setPrintModalOpen(false)}>
          <div
            className="mm-print-modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Tabletop standee print sheet"
          >
            <div className="mm-print-modal-header">
              <h3>Tabletop Standee Preview</h3>
              <button
                type="button"
                className="mm-print-modal-close"
                onClick={() => setPrintModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mm-standee-sheet-preview">
              <div className="mm-standee-header">
                <span className="mm-standee-kicker">WELCOME TO</span>
                <h4>{outletName}</h4>
              </div>

              <div className="mm-standee-qr-frame" dangerouslySetInnerHTML={{ __html: qrSvg }} />

              <div className="mm-standee-footer">
                <span className="mm-standee-table-num">TABLE {table.tableNumber}</span>
                <p>Scan with your phone camera to order & pay</p>
              </div>
            </div>

            <div className="mm-print-modal-footer">
              <button
                type="button"
                className="mm-action-btn mm-action-outline"
                onClick={() => setPrintModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mm-action-btn mm-action-primary"
                onClick={() => {
                  window.print();
                }}
              >
                <Printer size={15} /> Print Standee
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
