"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardCopy, Printer, Search, X } from "lucide-react";
import type { PosRegisterPage, PosRegisterRow } from "@/modules/pos/service";

const money = (minor: string, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    Number(minor) / (["OMR", "BHD", "KWD", "JOD", "TND"].includes(currency) ? 1000 : 100)
  );
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

export function PosOrderRegister({
  organizationId,
  outletId,
}: {
  organizationId: string;
  outletId: string;
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
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const load = useCallback(
    async (cursor?: string, signal?: AbortSignal) => {
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
        const result = await fetch(endpoint + "?" + params, { cache: "no-store", signal });
        const data = (await result.json().catch(() => null)) as
          (PosRegisterPage & { message?: string }) | null;
        if (!result.ok || !data || !Array.isArray(data.items))
          throw new Error(data?.message ?? "Register unavailable.");
        if (signal?.aborted) return;
        setRows((prev) =>
          cursor
            ? [
                ...prev,
                ...data.items.filter((item) => !prev.some((old) => old.orderId === item.orderId)),
              ]
            : data.items
        );
        setNextCursor(data.nextCursor);
        setTotal(data.total);
        setError(null);
      } catch (e) {
        if (!signal?.aborted) setError(e instanceof Error ? e.message : "Register unavailable.");
      } finally {
        if (!signal?.aborted) setBusy(false);
      }
    },
    [endpoint, period, source, payment, status, debounced]
  );
  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => void load(undefined, controller.signal), 0);
    return () => {
      controller.abort();
      window.clearTimeout(initial);
    };
  }, [load]);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    else if (!selected && dialog.current?.open) dialog.current?.close();
  }, [selected]);
  return (
    <section className="pos-order-register" aria-labelledby="pos-register-title">
      <header className="till-sectionhead">
        <div>
          <span className="till-eyebrow">04 / ORDER REGISTER</span>
          <h2 id="pos-register-title">Recent Orders &amp; Sales</h2>
        </div>
        <span>{total === null ? "—" : total} orders</span>
      </header>
      <div className="pos-register-controls">
        <label>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search orders</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order #, guest, table, dish…"
            maxLength={80}
          />
        </label>
        <select aria-label="Date range" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="today">Today</option>
          <option value="week">Last 7 days</option>
          <option value="all">All dates</option>
        </select>
        <select
          aria-label="Order source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
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
          onChange={(e) => setPayment(e.target.value)}
        >
          <option value="all">All payments</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="voided">Voided</option>
        </select>
        <select
          aria-label="Service status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
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
      {error && (
        <p role="alert" className="till-notice">
          {error}{" "}
          <button onClick={() => void load()} type="button">
            Retry
          </button>
        </p>
      )}
      {total === null && busy && <p className="till-empty">Loading orders…</p>}
      {total === 0 && !busy && (
        <p className="till-empty">No matching orders. Try a different filter or search.</p>
      )}
      <div className="pos-register-list">
        {rows.map((row) => (
          <article className="pos-register-row" key={row.orderId}>
            <div className="pos-register-identity">
              <strong>Order #{row.orderNumber}</strong>
              <small>{sourceName(row.source)}</small>
              <small>
                {row.servicePoint ?? row.customerName ?? row.fulfillmentMode.replace("_", " ")}
              </small>
            </div>
            <div className="pos-register-state">
              <span>{serviceName(row.status)}</span>
              <small>
                {row.paymentStatus === "paid"
                  ? row.paymentEvidence === "staff_recorded"
                    ? "Paid · Staff recorded"
                    : "Paid"
                  : row.paymentStatus === "unpaid"
                    ? "Payment pending"
                    : "Payment voided"}
              </small>
              <small>{row.items.reduce((sum, item) => sum + item.quantity, 0)} food items</small>
            </div>
            <div className="pos-register-amount">
              <strong>{money(row.totalMinor, row.currency)}</strong>
              <small>{new Date(row.createdAt).toLocaleString()}</small>
            </div>
            <div className="pos-register-actions">
              <button type="button" onClick={() => setSelected(row)}>
                View details
              </button>
              {row.saleId && (
                <Link
                  aria-label={"Print bill for order " + row.orderNumber}
                  target="_blank"
                  rel="noopener"
                  href={"/dashboard/pos/receipts/" + encodeURIComponent(row.saleId)}
                >
                  <Printer size={17} />
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      {nextCursor && (
        <button className="pos-register-more" disabled={busy} onClick={() => void load(nextCursor)}>
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
                <X />
              </button>
            </header>
            <p>
              {serviceName(selected.status)} ·{" "}
              {selected.paymentStatus === "paid" ? "Paid" : "Payment " + selected.paymentStatus}
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
                  rel="noopener"
                  href={"/dashboard/pos/receipts/" + encodeURIComponent(selected.saleId)}
                >
                  <Printer size={16} /> Print bill
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
                <ClipboardCopy size={15} />
              </button>
            </details>
          </div>
        )}
      </dialog>
    </section>
  );
}
