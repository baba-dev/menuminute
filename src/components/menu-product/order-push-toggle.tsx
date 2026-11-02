"use client";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

const LINK_CACHE = "menuminute-guest-push";
const LINK_KEY = "/__guest-push-link";
const SAFE = /^[A-Za-z0-9_-]{1,128}$/;

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}
function applicationServerKey(base64url: string) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const data = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
  return bytes;
}
function orderLink(token: string, orderId: string, capability: string) {
  if (
    ![token, orderId].every((part) => SAFE.test(part)) ||
    !/^[A-Za-z0-9_-]{12,128}$/.test(capability)
  )
    return null;
  return `/m/${token}/orders/${orderId}?trackingToken=${capability}`;
}
/** Origin-private note the service worker reads to know where a push should lead. */
async function storeLink(link: string | null) {
  const cache = await caches.open(LINK_CACHE);
  if (!link) return void (await cache.delete(LINK_KEY));
  await cache.put(
    LINK_KEY,
    new Response(JSON.stringify({ url: link, savedAt: Date.now() }), {
      headers: { "content-type": "application/json" },
    })
  );
}

type Phase = "loading" | "hidden" | "off" | "on" | "busy" | "blocked" | "ios";

/**
 * Explicit, per-order opt-in to an "order update" push. Nothing is requested until the diner taps.
 * Messages carry no content; the service worker just says there is an update and opens this order.
 */
export function OrderPushToggle({
  token,
  orderId,
  capability,
  finished,
}: {
  token: string;
  orderId: string;
  capability: string;
  finished: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const url = `/api/public-orders/${encodeURIComponent(orderId)}/push`;
  const headers = { "x-tracking-token": capability };

  useEffect(() => {
    if (finished) {
      void storeLink(null).catch(() => undefined);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const supported =
          "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
        let hash = "";
        if (supported) {
          const registration = await navigator.serviceWorker.ready;
          const existing = await registration.pushManager.getSubscription();
          if (existing) hash = await sha256Hex(existing.endpoint);
        }
        const response = await fetch(
          `${url}?token=${encodeURIComponent(token)}${hash ? `&hash=${hash}` : ""}`,
          { cache: "no-store", headers }
        );
        const state = response.ok
          ? ((await response.json()) as {
              enabled?: boolean;
              publicKey?: string | null;
              subscribed?: boolean;
            })
          : null;
        if (!active) return;
        if (!state?.enabled || !state.publicKey) return setPhase("hidden");
        setPublicKey(state.publicKey);
        if (!supported) {
          const iPhone = /iPad|iPhone|iPod/.test(navigator.userAgent);
          const installed = (navigator as unknown as { standalone?: boolean }).standalone === true;
          return setPhase(iPhone && !installed ? "ios" : "hidden");
        }
        if (Notification.permission === "denied") return setPhase("blocked");
        setPhase(state.subscribed && Notification.permission === "granted" ? "on" : "off");
      } catch {
        if (active) setPhase("hidden");
      }
    })();
    return () => {
      active = false;
    };
    // headers is derived from capability and recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, token, capability, finished]);

  const enable = useCallback(async () => {
    setError("");
    const link = orderLink(token, orderId, capability);
    if (!publicKey || !link) return setError("Notifications are not available for this order.");
    setPhase("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setPhase(permission === "denied" ? "blocked" : "off");
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(publicKey),
        }));
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, trackingToken: capability, endpoint: subscription.endpoint }),
      });
      if (!response.ok) throw new Error("save failed");
      await storeLink(link);
      setPhase("on");
    } catch {
      setError("We couldn't turn notifications on. You can keep this page open instead.");
      setPhase("off");
    }
  }, [publicKey, token, orderId, capability, url]);

  const disable = useCallback(async () => {
    setError("");
    setPhase("busy");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(url, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token,
            trackingToken: capability,
            endpoint: subscription.endpoint,
          }),
        });
      }
      await storeLink(null);
      setPhase("off");
    } catch {
      setError(
        "We couldn't turn notifications off. Close this order's alerts in your browser settings."
      );
      setPhase("on");
    }
  }, [token, capability, url]);

  if (finished || phase === "loading" || phase === "hidden") return null;
  return (
    <div className="panel stack" style={{ gap: "0.4rem" }}>
      {phase === "ios" ? (
        <p style={{ margin: 0 }}>
          To get an alert when your order is ready on iPhone, add this site to your Home Screen,
          then open it from there.
        </p>
      ) : phase === "blocked" ? (
        <p style={{ margin: 0 }}>
          Notifications are blocked in your browser settings. Keep this page open to see updates.
        </p>
      ) : phase === "on" ? (
        <div
          className="row between"
          style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}
        >
          <span role="status">
            <Bell size={16} aria-hidden="true" /> We&apos;ll alert you when this order changes.
          </span>
          <button type="button" className="action" style={{ minHeight: "44px" }} onClick={disable}>
            <BellOff size={16} aria-hidden="true" /> Turn off
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="action ember"
          style={{ minHeight: "44px", alignSelf: "start" }}
          disabled={phase === "busy"}
          onClick={enable}
        >
          <Bell size={16} aria-hidden="true" />{" "}
          {phase === "busy" ? "Working…" : "Notify me about this order"}
        </button>
      )}
      <small className="quiet">
        Alerts are sent only for this order, carry no details, and stop when it&apos;s finished.
      </small>
      {error && (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
    </div>
  );
}
