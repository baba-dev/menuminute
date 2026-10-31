"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getOnlineStatus,
  getServerOnlineStatus,
  subscribeOnlineStatus,
} from "@/lib/pwa/connectivity";
import styles from "./pwa-lifecycle.module.css";

const INSTALL_DISMISSED_AT = "menuminute:pwa-install-dismissed-at";
const INSTALL_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function installPromptWasRecentlyDismissed() {
  try {
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISSED_AT));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < INSTALL_DISMISS_MS;
  } catch {
    return false;
  }
}

export function PwaLifecycle() {
  const online = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus
  );
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const refreshRequested = useRef(false);

  const dismissInstall = useCallback(() => {
    try {
      localStorage.setItem(INSTALL_DISMISSED_AT, String(Date.now()));
    } catch {
      // Installation remains optional when storage is unavailable.
    }
    setInstallEvent(null);
    setShowIosHelp(false);
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      if (isStandalone() || installPromptWasRecentlyDismissed()) return;
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowIosHelp(false);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setShowIosHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    let iosHelpTimer: number | undefined;
    if (isIos() && !isStandalone() && !installPromptWasRecentlyDismissed()) {
      iosHelpTimer = window.setTimeout(() => setShowIosHelp(true), 0);
    }

    return () => {
      if (iosHelpTimer) window.clearTimeout(iosHelpTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;

    const watchInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
        }
      });
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (disposed) return;
        if (registration.waiting) setWaitingWorker(registration.waiting);
        watchInstallingWorker(registration.installing);
        registration.addEventListener("updatefound", () =>
          watchInstallingWorker(registration?.installing ?? null)
        );
        await registration.update();
      } catch {
        // The app remains a normal network application if registration is unavailable.
      }
    };

    const onControllerChange = () => {
      if (refreshRequested.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      disposed = true;
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "dismissed") dismissInstall();
    else setInstallEvent(null);
  };

  const applyUpdate = () => {
    if (!waitingWorker) return;
    refreshRequested.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <>
      {!online ? (
        <div className={styles.offlineStatus} role="status" aria-live="polite">
          You&apos;re offline. Live actions and ordering are unavailable.
        </div>
      ) : null}

      {waitingWorker ? (
        <aside className={styles.prompt} aria-labelledby="pwa-update-title">
          <p className={styles.eyebrow}>Update ready</p>
          <h2 className={styles.title} id="pwa-update-title">
            A fresh MenuMinute is available
          </h2>
          <p className={styles.copy}>
            Reload when you are ready. Unsaved form changes may be lost.
          </p>
          <div className={styles.actions}>
            <button className={styles.primary} type="button" onClick={applyUpdate}>
              Reload app
            </button>
            <button
              className={styles.secondary}
              type="button"
              onClick={() => setWaitingWorker(null)}
            >
              Later
            </button>
          </div>
        </aside>
      ) : installEvent || showIosHelp ? (
        <aside className={styles.prompt} aria-labelledby="pwa-install-title">
          <p className={styles.eyebrow}>Install MenuMinute</p>
          <h2 className={styles.title} id="pwa-install-title">
            Keep your menu workspace close
          </h2>
          <p className={styles.copy}>
            {showIosHelp
              ? "In Safari, tap Share, then Add to Home Screen. Ordering still requires a connection."
              : "Add MenuMinute to this device for an app-like launch. Ordering still requires a connection."}
          </p>
          <div className={styles.actions}>
            {installEvent ? (
              <button className={styles.primary} type="button" onClick={() => void install()}>
                Install app
              </button>
            ) : null}
            <button className={styles.secondary} type="button" onClick={dismissInstall}>
              Not now
            </button>
          </div>
        </aside>
      ) : null}
    </>
  );
}
