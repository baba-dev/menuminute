"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  WifiOff,
} from "lucide-react";
import styles from "./pwa-device-panel.module.css";

type ServerState = {
  enabled: boolean;
  publicKey: string | null;
  outletId: string;
  subscriptions: Array<{
    id: string;
    endpointHash: string;
    newOrders: boolean;
    kitchenUpdates: boolean;
    updatedAt: string;
  }>;
};

async function endpointHash(endpoint: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

function applicationServerKey(base64url: string) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const data = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const buffer = new ArrayBuffer(data.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
  return buffer;
}

async function postSubscription(input: Record<string, string | boolean>) {
  const result = await fetch("/api/pwa/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!result.ok) {
    const json = (await result.json().catch(() => ({}))) as { message?: string };
    throw new Error(json.message || "MenuMinute could not save these device settings.");
  }
}

export function PwaDevicePanel({ outletName }: { outletName: string }) {
  const [remote, setRemote] = useState<ServerState | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registered, setRegistered] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [newOrders, setNewOrders] = useState(true);
  const [kitchenUpdates, setKitchenUpdates] = useState(false);
  const [enabledForDevice, setEnabledForDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState("Checking your device and notification settings…");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!online) {
      setStatus("You're offline. Reconnect to check account and device settings.");
      return;
    }
    try {
      const response = await fetch("/api/pwa/push", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not verify your outlet permissions.");
      const state = (await response.json()) as ServerState;
      setRemote(state);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setInstalled(standalone);
      setPermission("Notification" in window ? Notification.permission : "unsupported");
      const reg =
        "serviceWorker" in navigator
          ? await navigator.serviceWorker.getRegistration("/")
          : undefined;
      setRegistered(Boolean(reg?.active));
      const current = reg && "pushManager" in reg ? await reg.pushManager.getSubscription() : null;
      setSubscription(current);
      const hash = current ? await endpointHash(current.endpoint) : null;
      const currentRecord = state.subscriptions.find((item) => item.endpointHash === hash);
      setEnabledForDevice(Boolean(currentRecord));
      if (currentRecord) {
        setNewOrders(currentRecord.newOrders);
        setKitchenUpdates(currentRecord.kitchenUpdates);
        setLastUpdated(currentRecord.updatedAt);
      } else setLastUpdated(null);
      setStatus(
        !state.enabled
          ? "Alerts are not enabled for this outlet yet. Other app features still work."
          : currentRecord
            ? "This device is subscribed. Alerts may be delayed and are not order confirmations."
            : "Device alerts are optional and are off until you enable them."
      );
    } catch {
      setStatus("Could not check device alerts. Refresh after your connection returns.");
    }
  }, []);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    // Never ask notification permission on mount.
    void refresh();
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [refresh]);

  async function enable() {
    if (!remote?.enabled || !remote.publicKey) return;
    setBusy(true);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator))
        throw new Error("This browser does not support Web Push notifications.");
      const granted =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted")
        throw new Error("Notifications are blocked. Change your browser permissions to enable them.");
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg?.active || !("pushManager" in reg))
        throw new Error("The MenuMinute app worker is not ready. Install or reload the app.");
      const current =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(remote.publicKey),
        }));
      await postSubscription({
        action: "subscribe",
        endpoint: current.endpoint,
        newOrders,
        kitchenUpdates,
      });
      await refresh();
      setStatus("Saved. This device can receive generic activity alerts while the app is closed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not subscribe this device.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!subscription) return;
    setBusy(true);
    try {
      await postSubscription({ action: "unsubscribe", endpoint: subscription.endpoint });
      // Do not unsubscribe the browser globally: another outlet may use the same endpoint.
      await refresh();
      setStatus("Alerts for this outlet are now off on this device.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not remove alerts.");
    } finally {
      setBusy(false);
    }
  }

  async function clearOffline() {
    setBusy(true);
    try {
      if (!("caches" in window)) throw new Error("Offline storage is not available.");
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith("menuminute-pwa-")).map((name) => caches.delete(name))
      );
      setStatus("Saved public pages cleared. Private orders and financial data were never stored there.");
    } catch {
      setStatus("Offline storage could not be cleared in this browser.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.stack}>
      <section className={styles.intro}>
        <span className={styles.eyebrow}>YOUR DEVICE · {outletName}</span>
        <h1>MenuMinute on this device</h1>
        <p>
          Keep service alerts and offline viewing under your control. Live orders,
          Kitchen and Point of Sale always need a working connection.
        </p>
      </section>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <Smartphone size={21} aria-hidden="true" />
          <span>App launch</span>
          <strong>{installed ? "Installed app" : "Browser tab"}</strong>
        </div>
        <div className={styles.stat}>
          <ShieldCheck size={21} aria-hidden="true" />
          <span>Offline shell</span>
          <strong>{registered ? "Ready" : "Not registered"}</strong>
        </div>
        <div className={styles.stat}>
          <Bell size={21} aria-hidden="true" />
          <span>Device permission</span>
          <strong>{permission === "unsupported" ? "Unsupported" : permission}</strong>
        </div>
      </div>
      <section className={styles.panel} aria-labelledby="device-alerts">
        <div className={styles.panelTitle}>
          <div className={styles.heading}>
            {enabledForDevice ? <Bell size={22} aria-hidden="true" /> : <BellOff size={22} aria-hidden="true" />}
            <div>
              <h2 id="device-alerts">Activity alerts</h2>
              <p>Only for this device and the currently selected outlet.</p>
            </div>
          </div>
          <button type="button" onClick={() => void refresh()} className={styles.secondary}>
            <RefreshCw size={16} aria-hidden="true" /> Refresh
          </button>
        </div>
        <div className={styles.preferences}>
          <label className={styles.option}>
            <span><strong>New orders</strong><small>Check the latest tickets in MenuMinute</small></span>
            <input type="checkbox" checked={newOrders} disabled={busy || !remote?.enabled} onChange={(e) => setNewOrders(e.target.checked)} />
          </label>
          <label className={styles.option}>
            <span><strong>Kitchen activity</strong><small>Generic station activity reminders, not job acknowledgements</small></span>
            <input type="checkbox" checked={kitchenUpdates} disabled={busy || !remote?.enabled} onChange={(e) => setKitchenUpdates(e.target.checked)} />
          </label>
        </div>
        <div className={styles.actions}>
          {enabledForDevice ? (
            <>
              <button className={styles.primary} onClick={() => void enable()} disabled={busy || !remote?.enabled || !online} type="button">
                Save preferences
              </button>
              <button className={styles.danger} onClick={() => void disable()} disabled={busy || !online} type="button">
                Stop alerts
              </button>
            </>
          ) : (
            <button className={styles.primary} onClick={() => void enable()} disabled={busy || !remote?.enabled || !online || (!newOrders && !kitchenUpdates)} type="button">
              Enable device alerts
            </button>
          )}
        </div>
        {lastUpdated && <p className={styles.footnote}>Last saved {new Date(lastUpdated).toLocaleString()}</p>}
        <p className={styles.footnote}>
          On iPhone or iPad, first install using Safari → Share → Add to Home Screen
          (iOS/iPadOS 16.4 or later). Permission is requested only after your tap.
          Push delivery is best effort; always check the live order and kitchen queues.
        </p>
      </section>
      <section className={styles.panel} aria-labelledby="device-storage">
        <div className={styles.heading}>
          <HardDrive size={22} aria-hidden="true" />
          <div>
            <h2 id="device-storage">Offline storage</h2>
            <p>Clear previously saved public menu pages and app assets on this device.</p>
          </div>
        </div>
        <button className={styles.secondary} onClick={() => void clearOffline()} disabled={busy} type="button">
          <Trash2 size={16} aria-hidden="true" /> Clear saved public pages
        </button>
        <p className={styles.footnote}>
          This does not remove your account, browser sign-in, unfinished cart or other websites’ storage.
          Private outlet reports, orders and financial records are not cached.
        </p>
      </section>
      <div className={styles.result} role="status" aria-live="polite">
        {status.includes("offline") ? <WifiOff size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
        <span>{status}</span>
      </div>
    </div>
  );
}
