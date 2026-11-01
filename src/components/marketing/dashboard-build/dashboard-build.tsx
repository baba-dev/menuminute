"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import {
  CHAPTERS,
  chapterAt,
  dampProgress,
  isInteractive,
  pieceById,
  pieceStyle,
  renderDashboardBuild,
  scrollProgress,
  stageStyle,
  type PieceId,
} from "./dashboard-build-timeline";
import "./dashboard-build.css";

/**
 * Pinned, scroll-assembled dashboard. PLACEHOLDER PANELS: this slice proves the scroll
 * mechanics only. The real dashboard styling and sample data arrive in a later slice.
 * Marketing fixture: no API calls, no auth, no tenant data.
 */

function Panel({
  id,
  href,
  label,
  className,
  children,
}: {
  id: PieceId;
  href: string;
  label: string;
  className: string;
  children?: ReactNode;
}) {
  // Server-render the exploded (p = 0) pose so there is no assembled-then-collapsed flash.
  const style = pieceStyle(0, pieceById(id));
  return (
    <Link href={href} className={`db-panel ${className}`} data-piece={id} style={style}>
      <span className="db-panel__label">{label}</span>
      {children}
    </Link>
  );
}

const KPIS: readonly { id: PieceId; label: string; target?: number }[] = [
  { id: "kpi-1", label: "Published menus", target: 3 },
  { id: "kpi-2", label: "Categories", target: 14 },
  { id: "kpi-3", label: "Dishes", target: 236 },
  { id: "kpi-4", label: "Active QR codes", target: 12 },
  { id: "kpi-5", label: "Menus to publish", target: 0 },
  { id: "kpi-6", label: "Public menu" },
];

export function DashboardBuild() {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let target = 0;
    let displayed = 0;
    let frame = 0;
    let last = 0;

    const measure = () => {
      if (motion.matches) return 1;
      const rect = root.getBoundingClientRect();
      return scrollProgress(rect.top, rect.height, window.innerHeight);
    };
    const apply = (p: number) => {
      renderDashboardBuild(stage, p);
      const ready = isInteractive(p);
      if (stage.hasAttribute("inert") === ready) stage.toggleAttribute("inert", !ready);
      const chapter = chapterAt(p).id;
      if (root.dataset["chapter"] !== chapter) root.dataset["chapter"] = chapter;
      root.dataset["p"] = p.toFixed(3);
    };
    const tick = (timestamp: number) => {
      const dt = last ? Math.min(timestamp - last, 100) : 16;
      last = timestamp;
      displayed = dampProgress(displayed, target, dt);
      apply(displayed);
      if (displayed !== target) {
        frame = window.requestAnimationFrame(tick);
      } else {
        frame = 0;
        last = 0;
      }
    };
    const onScroll = () => {
      target = measure();
      if (!frame) frame = window.requestAnimationFrame(tick);
    };

    // First paint lands directly on the right state, e.g. after a mid-page reload.
    target = measure();
    displayed = target;
    apply(displayed);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    motion.addEventListener("change", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      motion.removeEventListener("change", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  function goToChapter(at: number) {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = root.getBoundingClientRect();
    const travel = Math.max(0, rect.height - window.innerHeight);
    window.scrollTo({
      top: window.scrollY + rect.top + at * travel,
      behavior: reduced ? "auto" : "smooth",
    });
  }

  return (
    <section ref={rootRef} className="db" aria-labelledby="db-title" data-chapter="navigate">
      <div className="db__sticky">
        <h2 id="db-title" className="db__title">
          Your real dashboard, assembled as you scroll
        </h2>
        <div className="db__perspective">
          <div
            ref={stageRef}
            className="db__stage"
            style={stageStyle(0)}
            role="group"
            aria-label="Dashboard preview (placeholder panels)"
          >
            <div
              className="db__shell"
              data-piece="shell"
              style={pieceStyle(0, pieceById("shell"))}
            />
            <Panel id="sidebar" href="/help" label="Sidebar" className="db-panel--sidebar" />
            <Panel id="topbar" href="/docs" label="Top bar" className="db-panel--topbar" />
            <Panel id="hero" href="/demo" label="Overview hero" className="db-panel--hero" />
            <div className="db__kpis">
              {KPIS.map((kpi) => (
                <Panel
                  key={kpi.id}
                  id={kpi.id}
                  href="/demo"
                  label={kpi.label}
                  className="db-panel--kpi"
                >
                  <strong className="db-panel__value">
                    {kpi.target === undefined ? "Live" : <span data-count-to={kpi.target}>0</span>}
                  </strong>
                </Panel>
              ))}
            </div>
            <Panel
              id="priorities"
              href="/help"
              label="Priorities"
              className="db-panel--priorities"
            />
            <Panel id="health" href="/help" label="Outlet health" className="db-panel--health" />
            <Panel id="pulse" href="/demo" label="Service pulse" className="db-panel--pulse" />
            <Panel id="floor" href="/demo" label="Floor map" className="db-panel--floor" />
            <Panel id="order" href="/demo" label="New order" className="db-panel--order" />
          </div>
        </div>
        <nav className="db__rail" aria-label="Dashboard build chapters">
          {CHAPTERS.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              className="db__rail-item"
              data-chapter-id={chapter.id}
              onClick={() => goToChapter(chapter.at)}
            >
              {chapter.label}
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
