"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getOnlineStatus,
  getServerOnlineStatus,
  subscribeOnlineStatus,
} from "@/lib/pwa/connectivity";
import styles from "./guest-offline-coordinator.module.css";

type GuestWorkerMessage = {
  type?: string;
  pageUrl?: string;
  syncedAt?: string;
};

function storageKey(token: string, locale: string | null) {
  return `menuminute:guest-offline:${token}:${locale ?? "canonical"}`;
}

export function GuestOfflineCoordinator({
  enabled,
  token,
  locale,
}: {
  enabled: boolean;
  token: string;
  locale: string | null;
}) {
  const online = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus
  );
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      try {
        setSyncedAt(localStorage.getItem(storageKey(token, locale)));
      } catch {
        // The snapshot still works when private storage is unavailable; only the timestamp is lost.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enabled, locale, token]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator) ||
      (!online && enabled)
    ) {
      return;
    }

    let disposed = false;
    const pagePath = window.location.pathname + window.location.search;
    const localeQuery = locale ? `?lang=${encodeURIComponent(locale)}` : "";
    const apiPath = `/api/public-menu/${encodeURIComponent(token)}${localeQuery}`;
    const expectedPageUrl = new URL(pagePath, window.location.origin).href;

    const onMessage = (event: MessageEvent<GuestWorkerMessage>) => {
      if (event.data?.pageUrl !== expectedPageUrl) return;
      if (event.data.type === "GUEST_OFFLINE_READY" && event.data.syncedAt) {
        setSnapshotError(false);
        setSyncedAt(event.data.syncedAt);
        try {
          localStorage.setItem(storageKey(token, locale), event.data.syncedAt);
        } catch {
          // The worker cache remains authoritative when timestamp storage is unavailable.
        }
      } else if (event.data.type === "GUEST_OFFLINE_REMOVED") {
        setSyncedAt(null);
        try {
          localStorage.removeItem(storageKey(token, locale));
        } catch {
          // Removal from the worker is sufficient.
        }
      } else if (event.data.type === "GUEST_OFFLINE_ERROR") {
        setSnapshotError(true);
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    void navigator.serviceWorker.ready.then((registration) => {
      if (disposed) return;
      const worker = registration.active ?? navigator.serviceWorker.controller;
      worker?.postMessage({
        type: "SET_GUEST_OFFLINE",
        enabled,
        pagePath,
        apiPath,
      });
    });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [enabled, locale, online, token]);

  if (!enabled) return null;

  const formatted = syncedAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(syncedAt)
      )
    : null;

  if (!online) {
    return (
      <aside className={styles.offline} role="status" aria-live="polite">
        <strong>Viewing a saved menu</strong>
        <span>
          {formatted ? `Last synced ${formatted}. ` : ""}Prices and availability may have changed.
          Ordering is paused until you reconnect.
        </span>
      </aside>
    );
  }

  if (snapshotError) {
    return (
      <p className={styles.status} role="status">
        Offline copy unavailable. Keep this page open and try again when your connection is stable.
      </p>
    );
  }

  return formatted ? (
    <p className={styles.status} role="status">
      Available offline · last synced {formatted}
    </p>
  ) : null;
}
