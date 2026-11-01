"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Shared lifecycle for animated marketing sections.
 * - `ready`: script is running (CSS uses it to add first-view reveals; without script nothing hides).
 * - `reduced`: the visitor prefers reduced motion.
 * - `visible`: the section is on screen (start loops, pause when off screen).
 * Elements marked `data-reveal` get `data-in="true"` the first time they scroll into view.
 */
export function useSectionMotion(rootRef: RefObject<HTMLElement | null>) {
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReduced(preference.matches);
    setReady(true);
    syncPreference();
    preference.addEventListener("change", syncPreference);
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.in = "true";
            reveal.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    for (const element of root.querySelectorAll<HTMLElement>("[data-reveal]")) {
      reveal.observe(element);
    }
    const presence = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.25 }
    );
    presence.observe(root);
    return () => {
      preference.removeEventListener("change", syncPreference);
      reveal.disconnect();
      presence.disconnect();
    };
  }, [rootRef]);

  return { ready, reduced, visible };
}
