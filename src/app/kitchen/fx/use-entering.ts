"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Ids that appeared since the previous render (never on first render), kept for a
 * short window so a CSS entrance animation can run once. Inspired by Magic UI's
 * "Animated List", without the animation library.
 */
export function useEnteringIds(ids: readonly string[], windowMs = 700): ReadonlySet<string> {
  const known = useRef<Set<string> | null>(null);
  const [entering, setEntering] = useState<ReadonlySet<string>>(new Set());
  const key = ids.join("|");
  useEffect(() => {
    const current = new Set(ids);
    if (known.current === null) {
      known.current = current;
      return;
    }
    const fresh = ids.filter((id) => !known.current!.has(id));
    known.current = current;
    if (!fresh.length) return;
    const frame = requestAnimationFrame(() => setEntering(new Set(fresh)));
    const timer = setTimeout(() => setEntering(new Set()), windowMs);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
    // `key` is the stable identity of `ids`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, windowMs]);
  return entering;
}
