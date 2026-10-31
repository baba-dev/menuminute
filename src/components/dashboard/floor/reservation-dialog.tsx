"use client";

import React, { useState, useEffect } from "react";
import { X, CalendarPlus, AlertTriangle } from "lucide-react";
import type { VisualTable, CreateReservationInput } from "@/modules/hospitality/floor-contracts";
import { useHaptics } from "@/lib/use-haptics";

interface ReservationDialogProps {
  open: boolean;
  onClose: () => void;
  tables: VisualTable[];
  selectedTable: VisualTable | null;
  outletTimezone: string;
  defaultDate: string;
  onSubmit: (input: CreateReservationInput) => Promise<void>;
}

export function ReservationDialog({
  open,
  onClose,
  tables,
  selectedTable,
  outletTimezone,
  defaultDate,
  onSubmit,
}: ReservationDialogProps) {
  const haptics = useHaptics(true);
  const [tableId, setTableId] = useState(selectedTable?.id ?? (tables[0]?.id || ""));
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [partySize, setPartySize] = useState(selectedTable?.capacity || 2);
  const [reservationTime, setReservationTime] = useState(() => {
    // Default to nearest 30 mins
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setTableId(selectedTable?.id ?? tables[0]?.id ?? "");
      setPartySize(selectedTable?.capacity ?? 2);
      setGuestName("");
      setGuestPhone("");
      setGuestEmail("");
      setNotes("");
      setError("");
      if (defaultDate) {
        const now = new Date();
        const today = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
        if (defaultDate !== today) setReservationTime(`${defaultDate}T19:00`);
      }
    }
  }, [open, selectedTable?.id, selectedTable?.capacity, defaultDate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    const focus = document.getElementById("res-guest-name");
    focus?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const currentTable = tables.find((t) => t.id === tableId) ?? null;
  const isOverCapacity = currentTable && partySize > currentTable.capacity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      setError("Please provide the guest's name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!currentTable) throw new Error("Select an active table.");
      if (partySize > currentTable.capacity)
        throw new Error("Party exceeds the seating capacity of the table.");
      await onSubmit({
        tableId: tableId || null,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim() || null,
        guestEmail: guestEmail.trim() || null,
        partySize,
        reservationTime: new Date(reservationTime).toISOString(),
        durationMinutes,
        notes: notes.trim() || null,
      });
      haptics.confirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create reservation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mm-modal-overlay" onClick={onClose} aria-hidden="true">
      <div
        className="mm-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="res-dialog-heading"
        aria-modal="true"
      >
        <div className="mm-modal-header">
          <div className="flex items-center gap-2">
            <div className="bg-brand-100/70 text-brand-800 dark:bg-brand-950/60 dark:text-brand-300 rounded-xl p-2">
              <CalendarPlus size={20} />
            </div>
            <div>
              <h2 id="res-dialog-heading" className="text-lg font-bold">
                New Table Reservation
              </h2>
              <p className="text-muted-foreground text-xs">
                Book a table slot with capacity and time validation.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="mm-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mm-modal-body space-y-4">
          {error && (
            <div className="mm-error-banner" role="alert">
              {error}
            </div>
          )}

          {/* Table Selector */}
          <div className="mm-form-row">
            <label htmlFor="res-table-select">Assigned Table</label>
            <select
              id="res-table-select"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.tableNumber} {t.label ? `(${t.label})` : ""} · {t.capacity} chairs (
                  {t.section})
                </option>
              ))}
            </select>
          </div>

          {/* Guest Name & Contact */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="mm-form-row">
              <label htmlFor="res-guest-name">Guest Name *</label>
              <input
                id="res-guest-name"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Sarah Connor"
                required
              />
            </div>
            <div className="mm-form-row">
              <label htmlFor="res-guest-phone">Phone Number</label>
              <input
                id="res-guest-phone"
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
              />
            </div>
            <div className="mm-form-row">
              <label htmlFor="res-guest-email">Email Address</label>
              <input
                id="res-guest-email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="e.g. guest@example.com"
              />
            </div>
          </div>

          {/* Party Size & Time */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="mm-form-row">
              <label>Party Size</label>
              <div className="mm-stepper">
                <button
                  type="button"
                  onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                  disabled={partySize <= 1}
                >
                  -
                </button>
                <span>{partySize} Guests</span>
                <button
                  type="button"
                  onClick={() => setPartySize((p) => Math.min(30, p + 1))}
                  disabled={partySize >= 30}
                >
                  +
                </button>
              </div>
            </div>

            <div className="mm-form-row sm:col-span-2">
              <label htmlFor="res-time">Date & Arrival Time (device local time)</label>
              <p className="text-muted-foreground text-xs">Outlet timezone: {outletTimezone}</p>
              <input
                id="res-time"
                type="datetime-local"
                value={reservationTime}
                onChange={(e) => setReservationTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Capacity Overload Warning */}
          {isOverCapacity && (
            <div className="mm-warning-banner" role="status">
              <AlertTriangle size={16} className="flex-shrink-0 text-amber-600" />
              <p className="text-xs text-amber-900 dark:text-amber-200">
                Notice: Party size ({partySize}) exceeds Table {currentTable.tableNumber}&apos;s
                capacity ({currentTable.capacity} chairs). Extra seating may be required.
              </p>
            </div>
          )}

          {/* Duration & Notes */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="mm-form-row">
              <label htmlFor="res-duration">Duration</label>
              <select
                id="res-duration"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              >
                <option value={45}>45 mins</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
                <option value={180}>3 hours</option>
              </select>
            </div>
            <div className="mm-form-row sm:col-span-2">
              <label htmlFor="res-notes">Special Requests / Notes</label>
              <input
                id="res-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Window booth preference, High chair"
              />
            </div>
          </div>

          <div className="mm-modal-footer">
            <button
              type="button"
              className="mm-action-btn mm-action-outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="mm-action-btn mm-action-primary" disabled={busy}>
              {busy ? "Booking..." : "Confirm Reservation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
