"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardCopy, Eye, Printer, Repeat2, RotateCcw, Search, X } from "lucide-react";
import type { PosRegisterPage, PosRegisterRow } from "@/modules/pos/service";

const money = (minor: string, currency: string) => {
  const precision =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    Number(minor) / 10 ** precision
  );
};
const serviceName = (value: string) =>
  ({
    pending: "Awaiting acceptance",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready",
    served: "Served",
    collected: "Collected",
    cancelled: "Cancelled",
    rejected: "Declined",
    expired: "Expired",
  })[value as "pending"] ?? value;
const sourceName = (source: string) =>
  ({
    staff_pos: "Staff POS",
    guest_menu: "Customer menu",
    online: "Online",
    unknown: "Order",
  })[source as "staff_pos"] ?? "Order";
const paymentName = (row: PosRegisterRow) =>
  row.paymentStatus === "paid"
    ? row.paymentEvidence === "staff_recorded"
      ? "Staff-recorded paid"
      : "Paid"
    : row.paymentStatus === "unpaid"
      ? "Pending"
      : "Voided";

export function PosOrderRegister({
  organizationId,
  outletId,
  onRepeat,
  refreshVersion,
}: {
  organizationId: string;
  outletId: string;
  onRepeat: (order: PosRegisterRow) => Promise<void>;
  refreshVersion: number;
}) {
  const endpoint =
    "/api/organizations/" +
    encodeURIComponent(organizationId) +
    "/outlets/" +
    encodeURIComponent(outletId) +
    "/pos";
  const [period, setPeriod] = useState("today");
  const [source, setSource] = useState("all");
  const [payment, setPayment] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<PosRegisterRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PosRegisterRow | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const sequence = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (cursor?: string, signal?: AbortSignal) => {
      const request = ++sequence.current;
      setBusy(true);
      try {
        const params = new URLSearchParams({
          view: "register",
          period,
          source,
          payment,
          status,
          search: debounced,
        });
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(endpoint + "?" + params, { cache: "no-store", signal });
        const data = (await response.json().catch(() => null)) as
          (PosRegisterPage & { message?: string }) | null;
        if (!response.ok || !data || !Array.isArray(data.items))
          throw new Error(data?.message ?? "Order register is unavailable.");
        if (signal?.aborted || request !== sequence.current) return;
        setRows((old) =>
          cursor
            ? [
                ...old,
                ...data.items.filter((item) => !old.some((prev) => prev.orderId === item.orderId)),
              ]
            : data.items
        );
        setNextCursor(data.nextCursor);
        setTotal(data.total);
        setError(null);
      } catch (error) {
        if (!signal?.aborted && request === sequence.current)
          setError(error instanceof Error ? error.message : "Order register is unavailable.");
      } finally {
        if (!signal?.aborted && request === sequence.current) setBusy(false);
      }
    },
    [endpoint, period, source, payment, status, debounced]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(undefined, controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      sequence.current += 1;
    };
  }, [load, refreshVersion]);

  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    else if (!selected && dialog.current?.open) dialog.current?.close();
  }, [selected]);

  const filtersActive =
    Boolean(search.trim()) ||
    period !== "today" ||
    source !== "all" ||
    payment !== "all" ||
    status !== "all";
  const resetFilters = () => {
    setSearch("");
    setPeriod("today");
    setSource("all");
    setPayment("all");
    setStatus("all");
  };

  return (
    <section className="pos-order-register" aria-labelledby="pos-register-title">
      <header className="till-sectionhead">
        <div>
          <span className="till-eyebrow">04 / ORDER REGISTER</span>
          <h2 id="pos-register-title">Recent Orders &amp; Sales</h2>
          <p className="pos-register-subtitle">
            Find orders, reprint bills, repeat dishes or manage refunds.
          </p>
        </div>
        <span aria-live="polite">{total === null ? "—" : total} orders</span>
      </header>

      <div className="pos-register-controls" role="search" aria-label="Find orders">
        <label className="pos-register-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search orders by number, guest, table or dish</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order #, guest, table, dish…"
            maxLength={80}
          />
          {search && (
            <button
              type="button"
              className="pos-register-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </label>
        <select
          aria-label="Date range"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
        >
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="all">All dates</option>
        </select>
        <select
          aria-label="Order source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="all">All sources</option>
          <option value="staff_pos">Staff POS</option>
          <option value="guest_menu">Customer menu</option>
          <option value="online">Online</option>
          <option value="unknown">Other</option>
        </select>
        <select
          aria-label="Payment status"
          value={payment}
          onChange={(event) => setPayment(event.target.value)}
        >
          <option value="all">All payments</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="voided">Voided</option>
        </select>
        <select
          aria-label="Service status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="all">All service states</option>
          <option value="pending">Awaiting acceptance</option>
          <option value="accepted">Accepted</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="served">Served</option>
          <option value="collected">Collected</option>
          <option value="cancelled">Cancelled</option>
          <option value="rejected">Declined</option>
          <option value="expired">Expired</option>
        </select>
      </div>
      {filtersActive && (
        <button type="button" className="pos-register-reset" onClick={resetFilters}>
          <X size={14} aria-hidden="true" /> Reset filters
        </button>
      )}

      {error && (
        <p role="alert" className="till-notice">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {total === null && busy && (
        <p className="till-empty" role="status">
          Loading orders…
        </p>
      )}
      {total === 0 && !busy && (
        <p className="till-empty" role="status">
          {filtersActive
            ? "No matching orders. Try another search or reset your filters."
            : "No orders recorded for today yet."}
        </p>
      )}

      {rows.length > 0 && (
        <div className="pos-register-scroll">
          <table className="pos-register-table">
            <caption className="sr-only">
              Order history with details, bill reprinting, repeat and refund actions
            </caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer / table</th>
                <th scope="col">Service</th>
                <th scope="col">Payment</th>
                <th scope="col">Total</th>
                <th scope="col" className="pos-register-action-heading">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.orderId}>
                  <th scope="row" className="pos-register-id">
                    <strong>#{row.orderNumber}</strong>
                    <small>{sourceName(row.source)}</small>
                  </th>
                  <td data-label="Customer / table">
                    <span>
                      {row.servicePoint ??
                        row.customerName ??
                        row.fulfillmentMode.replace("_", " ")}
                    </span>
                    <small>{new Date(row.createdAt).toLocaleString()}</small>
                  </td>
                  <td data-label="Service">
                    <span className={"pos-register-pill pos-register-service-" + row.status}>
                      {serviceName(row.status)}
                    </span>
                    {row.partReady && (
                      <span className="pos-partready">
                        Part ready · {row.partReady.released} of {row.partReady.total} dishes
                      </span>
                    )}
                    <small>
                      {row.items.reduce((sum, item) => sum + item.quantity, 0)} food items
                    </small>
                  </td>
                  <td data-label="Payment">
                    <span className={"pos-register-pill pos-register-payment-" + row.paymentStatus}>
                      {paymentName(row)}
                    </span>
                  </td>
                  <td data-label="Total" className="pos-register-total">
                    <strong>{money(row.totalMinor, row.currency)}</strong>
                  </td>
                  <td data-label="Actions">
                    <div
                      className="pos-register-actions"
                      role="group"
                      aria-label={"Order #" + row.orderNumber + " actions"}
                    >
                      <button
                        type="button"
                        className="pos-register-icon"
                        aria-label={"View order #" + row.orderNumber}
                        title="View order details"
                        onClick={() => setSelected(row)}
                      >
                        <Eye size={17} aria-hidden="true" />
                      </button>
                      {row.saleId && (
                        <Link
                          className="pos-register-icon"
                          aria-label={"Reprint bill for order #" + row.orderNumber}
                          title="Reprint bill"
                          target="_blank"
                          rel="noopener noreferrer"
                          href={
                            "/dashboard/pos/receipts/" + encodeURIComponent(row.saleId) + "?auto=1"
                          }
                        >
                          <Printer size={17} aria-hidden="true" />
                        </Link>
                      )}
                      <button
                        type="button"
                        className="pos-register-icon"
                        aria-label={"Repeat order #" + row.orderNumber + " into new ticket"}
                        title="Repeat into new ticket"
                        onClick={() => void onRepeat(row)}
                      >
                        <Repeat2 size={17} aria-hidden="true" />
                      </button>
                      {row.saleId && row.paymentStatus === "paid" && (
                        <Link
                          className="pos-register-icon pos-register-refund"
                          aria-label={"Refund or correct payment for order #" + row.orderNumber}
                          title="Refund / payment correction"
                          href={
                            "/dashboard/pos/ledger?refundSale=" + encodeURIComponent(row.saleId)
                          }
                        >
                          <RotateCcw size={17} aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextCursor && (
        <button
          className="pos-register-more"
          type="button"
          disabled={busy}
          onClick={() => void load(nextCursor)}
        >
          {busy ? "Loading…" : "Load more orders"}
        </button>
      )}

      <dialog
        className="pos-order-detail"
        ref={dialog}
        onClose={() => setSelected(null)}
        aria-labelledby="pos-order-detail-title"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        {selected && (
          <div>
            <header>
              <div>
                <small>{sourceName(selected.source)}</small>
                <h2 id="pos-order-detail-title">Order #{selected.orderNumber}</h2>
                <p>{selected.customerName ?? selected.servicePoint ?? "Restaurant order"}</p>
              </div>
              <button
                aria-label="Close order details"
                type="button"
                onClick={() => dialog.current?.close()}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <p>
              {serviceName(selected.status)}
              {selected.partReady
                ? ` (part ready: ${selected.partReady.released} of ${selected.partReady.total} dishes released)`
                : ""}{" "}
              · {paymentName(selected)}
            </p>
            <div className="pos-order-detail-items">
              {selected.items.map((item, index) => (
                <div key={index}>
                  <span>
                    {item.quantity} × {item.name}
                    {item.variant ? " · " + item.variant : ""}
                  </span>
                  <strong>{money(String(item.totalMinor), selected.currency)}</strong>
                  {item.notes && <small>{item.notes}</small>}
                </div>
              ))}
            </div>
            <div className="pos-order-detail-total">
              <strong>Recorded total</strong>
              <strong>{money(selected.totalMinor, selected.currency)}</strong>
            </div>
            <div className="pos-order-detail-actions">
              {selected.saleId && (
                <Link
                  target="_blank"
                  rel="noopener noreferrer"
                  href={
                    "/dashboard/pos/receipts/" + encodeURIComponent(selected.saleId) + "?auto=1"
                  }
                >
                  <Printer size={16} aria-hidden="true" /> Reprint bill
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  dialog.current?.close();
                  void onRepeat(selected);
                }}
              >
                <Repeat2 size={16} aria-hidden="true" /> Repeat order
              </button>
              {selected.saleId && selected.paymentStatus === "paid" && (
                <Link
                  href={"/dashboard/pos/ledger?refundSale=" + encodeURIComponent(selected.saleId)}
                >
                  <RotateCcw size={16} aria-hidden="true" /> Refund
                </Link>
              )}
              <button type="button" onClick={() => dialog.current?.close()}>
                Close
              </button>
            </div>
            <details>
              <summary>Technical details</summary>
              <code>{selected.orderId}</code>
              <button
                type="button"
                aria-label="Copy order ID"
                onClick={() => void navigator.clipboard?.writeText(selected.orderId)}
              >
                <ClipboardCopy size={15} aria-hidden="true" />
              </button>
            </details>
          </div>
        )}
      </dialog>
    </section>
  );
}
