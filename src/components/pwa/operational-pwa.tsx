"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getOnlineStatus,
  getServerOnlineStatus,
  subscribeOnlineStatus,
} from "@/lib/pwa/connectivity";
import styles from "./operational-pwa.module.css";

function subscribeStandalone(onStoreChange: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener?.("change", onStoreChange);
  window.addEventListener("appinstalled", onStoreChange);
  return () => {
    displayMode.removeEventListener?.("change", onStoreChange);
    window.removeEventListener("appinstalled", onStoreChange);
  };
}

function getStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function OperationalPwa({ workspace }: { workspace: "POS" | "Kitchen" }) {
  const online = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus
  );
  const standalone = useSyncExternalStore(subscribeStandalone, getStandalone, () => false);
  const [recoveryRequired, setRecoveryRequired] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine
  );
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockMessage, setWakeLockMessage] = useState<string | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const releaseWakeLock = useCallback(async () => {
    const current = wakeLock.current;
    wakeLock.current = null;
    setWakeLockActive(false);
    if (current && !current.released) await current.release().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onOffline = () => {
      setRecoveryRequired(true);
      setWakeLockMessage(null);
      void releaseWakeLock();
    };
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, [releaseWakeLock]);

  useEffect(() => {
    if (!recoveryRequired) return;
    const workspaces = Array.from(document.querySelectorAll<HTMLElement>("main"));
    for (const element of workspaces) element.inert = true;
    return () => {
      for (const element of workspaces) element.inert = false;
    };
  }, [recoveryRequired]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") void releaseWakeLock();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void releaseWakeLock();
    };
  }, [releaseWakeLock]);

  const requestWakeLock = async () => {
    if (!standalone || !online || recoveryRequired || document.visibilityState !== "visible")
      return;
    if (!("wakeLock" in navigator)) {
      setWakeLockMessage("This device does not support keeping the screen awake.");
      return;
    }
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      wakeLock.current = sentinel;
      setWakeLockActive(true);
      setWakeLockMessage(null);
      sentinel.addEventListener(
        "release",
        () => {
          if (wakeLock.current === sentinel) wakeLock.current = null;
          setWakeLockActive(false);
        },
        { once: true }
      );
    } catch {
      setWakeLockMessage("The device declined the screen wake lock. You can continue normally.");
      setWakeLockActive(false);
    }
  };

  return (
    <>
      {standalone && !recoveryRequired ? (
        <aside className={styles.wakeControl} aria-label={`${workspace} display controls`}>
          <button
            type="button"
            onClick={() => void (wakeLockActive ? releaseWakeLock() : requestWakeLock())}
            disabled={!online}
          >
            {wakeLockActive ? "Allow screen sleep" : "Keep screen awake"}
          </button>
          {wakeLockMessage ? <span role="status">{wakeLockMessage}</span> : null}
        </aside>
      ) : null}

      {recoveryRequired ? (
        <section
          className={styles.outage}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="operational-outage-title"
          aria-describedby="operational-outage-detail"
        >
          <div className={styles.outageCard}>
            <p className={styles.eyebrow}>{workspace} safety pause</p>
            <h1 id="operational-outage-title">
              {online ? "Connection restored—reload required" : "Connection lost"}
            </h1>
            <p id="operational-outage-detail">
              {online
                ? `Reload ${workspace} before taking another action. This verifies current outlet state and prevents work from continuing on a stale screen.`
                : `Do not assume any ${workspace} action completed. This workspace is locked until the connection returns.`}
            </p>
            {online ? (
              <button type="button" onClick={() => window.location.reload()} autoFocus>
                Reload and sync {workspace}
              </button>
            ) : (
              <strong role="status">Waiting for a network connection…</strong>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
