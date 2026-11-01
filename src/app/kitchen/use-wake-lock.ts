"use client";
import { useEffect, useState } from "react";

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<WakeLockSentinelLike> };
const wakeLockApi = (): WakeLockApi | null =>
  typeof navigator !== "undefined" && "wakeLock" in navigator
    ? (navigator as unknown as { wakeLock: WakeLockApi }).wakeLock
    : null;

/**
 * Keeps the screen awake while `active` (a tablet at the pass must not sleep mid-service).
 * The browser drops the lock whenever the tab is hidden, so it is re-acquired on return.
 * Unsupported browsers and refusals (low battery, policy) degrade silently: `supported`
 * lets the UI hide the control and `held` reports what is really in effect.
 */
export function useWakeLock(active: boolean) {
  const [supported, setSupported] = useState(false);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSupported(wakeLockApi() !== null));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const api = wakeLockApi();
    if (!active || !api) {
      const frame = requestAnimationFrame(() => setHeld(false));
      return () => cancelAnimationFrame(frame);
    }
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await api.request("screen");
        if (cancelled) {
          void sentinel.release().catch(() => {});
          sentinel = null;
        } else setHeld(true);
      } catch {
        if (!cancelled) setHeld(false);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
      else setHeld(false);
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
  return { supported, held };
}
