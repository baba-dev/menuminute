"use client";
import Link from "next/link";
import Image from "next/image";
import {
  Clock3,
  ChefHat,
  PackageCheck,
  BellRing,
  ArrowUpRight,
  UtensilsCrossed,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { MerchantOrder, ServicePulse } from "./types";
import { actionFor, statusLabels } from "@/modules/orders/presentation";

export function ServicePulseRail({
  pulse,
  show,
}: {
  pulse: ServicePulse | null;
  show: (lane: string) => void;
}) {
  const metrics = [
    {
      label: "Needs acceptance",
      value: pulse?.pending,
      hint: "Incoming tickets",
      icon: BellRing,
      lane: "incoming",
    },
    {
      label: "In preparation",
      value: pulse?.preparing,
      hint: "Accepted + preparing",
      icon: ChefHat,
      lane: "preparing",
    },
    {
      label: "Ready for handoff",
      value: pulse?.ready,
      hint: "Awaiting service",
      icon: PackageCheck,
      lane: "ready",
    },
    {
      label: "Completed today",
      value: pulse?.completedToday,
      hint: "Outlet business date",
      icon: UtensilsCrossed,
      lane: "today",
    },
  ];
  return (
    <section className="sc-pulse" aria-label="Today's service pulse">
      <div className="sc-section-top">
        <h2>Today&apos;s service pulse</h2>
        <span>Current outlet · Authoritative counts</span>
      </div>
      <div className="sc-pulse-grid">
        {metrics.map(({ label, value, hint, icon: Icon, lane }) => (
          <button type="button" key={label} className="sc-pulse-cell" onClick={() => show(lane)}>
            <span className="sc-pulse-label">
              <span className="sc-icon">
                <Icon size={19} aria-hidden="true" />
              </span>
              <strong>{label}</strong>
            </span>
            <span className="sc-pulse-number">{value ?? "—"}</span>
            <span className="sc-faint">{hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function Ticket({
  order,
  now,
  open,
  perform,
  decline,
  pay,
  busy,
}: {
  order: MerchantOrder;
  now: number;
  open: (order: MerchantOrder) => void;
  perform: (order: MerchantOrder, status: string) => void;
  decline: (order: MerchantOrder) => void;
  pay: (order: MerchantOrder) => void;
  busy: boolean;
}) {
  const action = actionFor(order);
  const age = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60000));
  return (
    <article
      className={"sc-ticket sc-ticket-" + order.status}
      aria-label={"Order #" + order.orderNumber}
    >
      <div className="sc-ticket-heading">
        <div>
          <span className="sc-eyebrow">ORDER TICKET</span>
          <h3>#{order.orderNumber}</h3>
        </div>
        <span className={"sc-status sc-status-" + order.status}>
          {statusLabels[order.status] ?? order.status}
        </span>
      </div>
      <div className="sc-ticket-meta">
        <span>
          {order.fulfillmentMode === "pickup" ? "Pickup" : "Dine-in"}
          {order.servicePoint ? " · " + order.servicePoint : ""}
        </span>
        <span>
          <Clock3 size={13} aria-hidden="true" /> {age} min ago
        </span>
      </div>
      {order.customerName && <p className="sc-ticket-customer">{order.customerName}</p>}
      <div className="sc-ticket-items">
        {order.items.map((item) => (
          <div key={item.id} className="sc-item">
            <span>
              <strong>{item.quantity}×</strong> {item.itemName}
              {item.variantName && <small> · {item.variantName}</small>}
              {item.selectedOptions.length > 0 && (
                <small>{item.selectedOptions.map((v) => v.optionName).join(", ")}</small>
              )}
              {item.notes && <em>{item.notes}</em>}
            </span>
            <b>{formatPrice(item.totalMinor, order.currency)}</b>
          </div>
        ))}
      </div>
      {order.notes && (
        <div className="sc-ticket-note">
          <strong>Guest instructions</strong>
          <p>{order.notes}</p>
        </div>
      )}
      <div className="sc-ticket-total">
        <span>Total · {order.paymentStatus}</span>
        <strong>{formatPrice(order.totalMinor, order.currency)}</strong>
      </div>
      {order.kitchenManaged && (
        <p className="sc-managed">Kitchen Pro managed · Ready requires Expeditor release</p>
      )}
      <div className="sc-ticket-actions">
        {action && (
          <button
            type="button"
            className="sc-primary"
            disabled={busy}
            onClick={() => perform(order, action.status)}
          >
            {busy ? "Updating…" : action.label}
          </button>
        )}
        {order.status === "pending" && order.canCancel && (
          <button
            type="button"
            className="sc-danger-secondary"
            disabled={busy}
            onClick={() => decline(order)}
          >
            Decline
          </button>
        )}
        <button type="button" className="sc-secondary" onClick={() => open(order)}>
          Details <ArrowUpRight size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="sc-ticket-footer">
        {order.canManagePayment && order.paymentStatus === "unpaid" && (
          <button type="button" disabled={busy} onClick={() => pay(order)}>
            Record Paid
          </button>
        )}
        {order.kitchenManaged && <Link href="/kitchen">Open Kitchen Pro ↗</Link>}
      </div>
    </article>
  );
}
export function RailEmpty({ lane, filtered }: { lane: string; filtered: boolean }) {
  const image =
    lane === "incoming"
      ? "service-bell.webp"
      : lane === "ready"
        ? "service-complete.webp"
        : "ticket-stack.webp";
  return (
    <div className="sc-empty">
      <Image
        src={"/brand/orders/service-counter/" + image}
        width={210}
        height={150}
        alt=""
        aria-hidden="true"
      />
      <strong>
        {filtered
          ? "No matching tickets"
          : lane === "incoming"
            ? "All caught up."
            : lane === "ready"
              ? "No handoffs waiting."
              : "Nothing cooking right now."}
      </strong>
      <p>
        {filtered
          ? "Try removing a filter."
          : "New tickets will appear here after synchronization."}
      </p>
    </div>
  );
}
