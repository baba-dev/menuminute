"use client";

import { useEffect } from "react";
import {
  SESSION_CONTINUITY_INTERVAL_MS,
  SESSION_CONTINUITY_MIN_GAP_MS,
} from "@/lib/auth-session-policy";

/**
 * Best-effort browser-side session renewal. The ordinary get-session endpoint is
 * same-origin, sets its own signed HttpOnly cookie and verifies PostgreSQL state.
 * Server Component reads cannot reliably forward their Set-Cookie to the browser.
 * No redirect, identity cache or logout on network/5xx failures.
 */
export function SessionContinuity() {
  useEffect(() => {
    let lastAttempt = 0;
    let inFlight = false;
    let disposed = false;
    async function refresh() {
      if (
        disposed ||
        inFlight ||
        !navigator.onLine ||
        document.visibilityState !== "visible" ||
        Date.now() - lastAttempt < SESSION_CONTINUITY_MIN_GAP_MS
      )
        return;
      lastAttempt = Date.now();
      inFlight = true;
      try {
        await fetch("/api/auth/get-session", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { accept: "application/json" },
        });
      } catch {
        // A network error never proves that the session expired.
      } finally {
        inFlight = false;
      }
    }
    void refresh();
    const onFocus = () => void refresh();
    const timer = window.setInterval(onFocus, SESSION_CONTINUITY_INTERVAL_MS);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
  return null;
}
