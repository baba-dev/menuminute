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
import { RubberStamp } from "@/components/ui/tactile-elements";
import { getOrderStampVariant } from "@/lib/hospitality-order-status";

export function ServicePulseRail({
  pulse,
  state,
  show,
}: {
  pulse: ServicePulse | null;
  state: "initial" | "stale" | "ready";
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
        <div className="flex items-center gap-3">
          <h2>Today&apos;s service pulse</h2>
        </div>
        <span>
          {state === "stale"
            ? "Counters unavailable · Last verified values"
            : state === "initial"
              ? "Connecting · Current outlet"
              : "Current outlet · Authoritative counts"}
        </span>
      </div>
      <div className="sc-pulse-grid" data-testid="service-pulse-grid">
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
  readOnly,
  timezone,
}: {
  order: MerchantOrder;
  now: number;
  open: (order: MerchantOrder) => void;
  perform: (order: MerchantOrder, status: string) => void;
  decline: (order: MerchantOrder) => void;
  pay: (order: MerchantOrder) => void;
  busy: boolean;
  readOnly: boolean;
  timezone: string;
}) {
  const action = actionFor(order);
  const age = now
    ? Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60000))
    : null;
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
        <RubberStamp
          text={statusLabels[order.status] ?? order.status}
          variant={getOrderStampVariant(order.status)}
        />
      </div>
      <div className="sc-ticket-meta">
        <span>
          {order.fulfillmentMode === "pickup" ? "Pickup" : "Dine-in"}
          {order.servicePoint ? " · " + order.servicePoint : ""}
        </span>
        <span>
          <Clock3 size={13} aria-hidden="true" /> {age === null ? "—" : age} min ago
        </span>
      </div>
      {order.requestedFulfillmentAt && (
        <p className="sc-ticket-customer">
          <Clock3 size={14} aria-hidden="true" /> Pickup due{" "}
          {new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit",
            timeZone: timezone,
          }).format(new Date(order.requestedFulfillmentAt))}
        </p>
      )}
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
            disabled={busy || readOnly}
            onClick={() => perform(order, action.status)}
          >
            {busy ? "Updating…" : action.label}
          </button>
        )}
        {order.status === "pending" && order.canCancel && (
          <button
            type="button"
            className="sc-danger-secondary"
            disabled={busy || readOnly}
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
        {order.canManagePayment &&
          ["ready", "served", "collected"].includes(order.status) &&
          order.paymentStatus === "unpaid" && (
            <button type="button" disabled={busy || readOnly} onClick={() => pay(order)}>
              Record Paid
            </button>
          )}
        {order.kitchenManaged && <Link href="/kitchen">Open Kitchen Pro ↗</Link>}
      </div>
      <div className="ticket-receipt-tear -mx-4 mt-3 -mb-4" aria-hidden="true" />
    </article>
  );
}
export function RailEmpty({
  lane,
  filtered,
  state,
}: {
  lane: string;
  filtered: boolean;
  state: "loading" | "unavailable" | "ready";
}) {
  if (state !== "ready") {
    return (
      <div className="sc-empty" role="status">
        <strong>
          {state === "loading" ? "Listening to service line…" : "Pass queue unavailable"}
        </strong>
        <p>
          {state === "loading"
            ? "Connecting to the kitchen rail for real-time ticket activity."
            : "Tickets cannot be confirmed empty until service reconnects."}
        </p>
      </div>
    );
  }
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
            ? "No tickets awaiting acceptance."
            : lane === "ready"
              ? "No orders ready for handoff."
              : "No tickets in this view."}
      </strong>
      <p>
        {filtered
          ? "Try adjusting your filter to view all stations."
          : "New matching tickets will appear here when the queue updates."}
      </p>
    </div>
  );
}
