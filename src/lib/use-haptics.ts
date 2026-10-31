"use client";

import { useCallback } from "react";

/**
 * Haptic and tactile sensory feedback engine for direct manipulation UI.
 * Uses the Web Vibration API with safe fallbacks for non-supporting browsers.
 */
export function useHaptics(enabled: boolean = true) {
  const trigger = useCallback(
    (pattern: number | number[]) => {
      if (!enabled || typeof window === "undefined" || !("vibrate" in navigator)) return;
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignored on platforms where vibration is restricted or unsupported
      }
    },
    [enabled]
  );

  return {
    /** Light tactile click when selecting or hovering a table */
    tick: useCallback(() => trigger(8), [trigger]),
    /** Snappy pulse when dragging table snaps to magnetic grid lines */
    snap: useCallback(() => trigger(14), [trigger]),
    /** Solid physical drop feeling when placing table down on the canvas */
    drop: useCallback(() => trigger(22), [trigger]),
    /** Double confirmation pulse for actions (e.g. seated guests, QR generated) */
    confirm: useCallback(() => trigger([12, 35, 12]), [trigger]),
    /** Urgent double buzz when an alert or service request bell is triggered */
    alert: useCallback(() => trigger([35, 50, 35]), [trigger]),
  };
}
