"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Counts smoothly to a new value instead of jumping. Independent implementation
 * inspired by Magic UI's "Number Ticker". Reduced-motion users get the value at once.
 * Assistive tech reads only the final number, never the in-between frames.
 */
export function NumberTicker({ value, durationMs = 550 }: { value: number; durationMs?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (
      start === value ||
      typeof window === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      from.current = value;
      const frame = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(start + (value - start) * eased);
      from.current = current;
      setShown(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);
  return (
    <>
      <span aria-hidden="true" className="kk-ticker">
        {shown}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
