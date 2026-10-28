"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BellRing, RefreshCw } from "lucide-react";
import type { GuestServiceRequest } from "@/modules/hospitality/service";

export function ServiceRequestsPanel({
  organizationId,
  outletId,
  timezone,
}: {
  organizationId: string;
  outletId: string;
  timezone: string;
}) {
  const [items, setItems] = useState<GuestServiceRequest[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const url =
    "/api/organizations/" +
    encodeURIComponent(organizationId) +
    "/outlets/" +
    encodeURIComponent(outletId) +
    "/service-requests";

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) throw new Error("Service request queue unavailable or access denied.");
      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected service request response.");
      setItems(data as GuestServiceRequest[]);
      setError("");
    } catch (cause) {
      setItems(null);
      setError(cause instanceof Error ? cause.message : "Request queue unavailable.");
    } finally {
      setRefreshing(false);
    }
  }, [url]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 12_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function change(item: GuestServiceRequest, action: "acknowledge" | "resolve") {
    if (busy) return;
    setBusy(item.id);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: item.id, action }),
      });
      if (!res.ok) throw new Error("Could not update request. Refresh and retry.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed.");
    } finally {
      setBusy("");
    }
  }

  function localTime(stamp: string) {
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) return "Time unavailable";
    try {
      return new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
    } catch {
      return date.toISOString().slice(11, 16) + " UTC";
    }
  }

  return (
    <section className="mm-dashboard-ops-panel" aria-labelledby="service-bells-title">
      <div className="mm-ops-head">
        <div>
          <span className="mm-dashboard-eyebrow">GUEST SERVICE</span>
          <h2 id="service-bells-title">At your service</h2>
          <p>
            Staff calls, water refills and bill requests · Checked approximately every 12 seconds.
          </p>
        </div>
        <BellRing size={34} aria-hidden="true" className="mm-ops-bell" />
      </div>
      <div className="mm-ops-actions">
        <button type="button" disabled={refreshing} onClick={() => void refresh()}>
          <RefreshCw size={15} aria-hidden="true" />{" "}
          {refreshing ? "Refreshing…" : "Refresh requests"}
        </button>
        <Link href="/dashboard/orders">
          Open Orders <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {error && (
        <p role="alert" className="mm-ops-error">
          {error}
        </p>
      )}
      {items === null ? (
        <div className="mm-ops-empty" role="status">
          <BellRing size={26} aria-hidden="true" />
          <p>Request queue unavailable. There is no verified count of outstanding requests.</p>
        </div>
      ) : items.length === 0 ? (
        <div className="mm-ops-empty">
          <div className="mm-ops-art-wrap" aria-hidden="true">
            <Image
              className="mm-ops-art mm-ops-art--light"
              src="/brand/dashboard/editorial/service-dispatch-light.svg"
              alt=""
              width={155}
              height={116}
            />
            <Image
              className="mm-ops-art mm-ops-art--dark"
              src="/brand/dashboard/editorial/service-dispatch-dark.svg"
              alt=""
              width={155}
              height={116}
            />
          </div>
          <p>
            No outstanding guest requests. New requests appear here for acknowledgement and
            resolution.
          </p>
        </div>
      ) : (
        <ul className="mm-ops-items">
          {items.map((item) => (
            <li key={item.id} className="mm-ops-item">
              <strong>
                Table {item.tableNumber} · Order #{item.orderNumber}
              </strong>
              <p>
                {item.signal === "call_server"
                  ? "Call server"
                  : item.signal === "water_refill"
                    ? "Water refill"
                    : "Bill request"}
              </p>
              <span>
                {item.status} · {localTime(item.requestedAt)}
              </span>
              <button
                type="button"
                disabled={busy !== ""}
                onClick={() =>
                  void change(item, item.status === "requested" ? "acknowledge" : "resolve")
                }
              >
                {busy === item.id
                  ? "Saving…"
                  : item.status === "requested"
                    ? "Acknowledge"
                    : "Mark resolved"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
