"use client";
import { useEffect, useRef, useState } from "react";

/**
 * A thin light that travels around its parent's border. Independent implementation
 * inspired by Magic UI's "Border Beam" (https://magicui.design/docs/components/border-beam).
 *
 * Kitchen rules: subtle by default (1px, low opacity), never the only signal (the
 * parent also states the wait in text), static when the beam budget is spent or the
 * user prefers reduced motion, and paused while off-screen. The parent must be
 * `position: relative` with a border radius; styles live in kitchen.css (`.kk-beam`).
 */
export function BorderBeam({
  level,
  animate = true,
}: {
  /** "wait" = amber, "late" = red and a little faster. */
  level: "wait" | "late";
  /** False renders a faint static ring instead of a moving beam. */
  animate?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || !animate || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry?.isIntersecting ?? true)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animate]);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={"kk-beam kk-beam-" + level + (animate ? "" : " kk-beam-static")}
      data-active={animate && visible ? "true" : "false"}
    />
  );
}
