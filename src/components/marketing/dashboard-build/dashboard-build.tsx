"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  CHAPTERS,
  chapterAt,
  dampProgress,
  pieceById,
  pieceStyle,
  renderDashboardBuild,
  scrollProgress,
  stageStyle,
  type PieceId,
} from "./dashboard-build-timeline";
import {
  ReplicaBottomBar,
  ReplicaGlance,
  ReplicaSidebar,
  ReplicaTopbar,
} from "./dashboard-replica";
import "@/app/(dashboard)/workspace.css";
import "@/app/(dashboard)/workspace-delight.css";
import "./dashboard-build.css";

/**
 * Pinned, scroll-assembled dashboard. The sidebar, top bar and KPI row are faithful replicas of
 * the real workspace (real class names, nav model and icons). The remaining panels are still
 * PLACEHOLDERS and arrive in later slices. Marketing fixture: no API calls, no auth, no tenant data.
 */

function Placeholder({ id, label, className }: { id: PieceId; label: string; className: string }) {
  // Server-render the exploded (p = 0) pose so there is no assembled-then-collapsed flash.
  return (
    <div className={`db-ph ${className}`} data-piece={id} style={pieceStyle(0, pieceById(id))}>
      <span className="db-ph__label">{label}</span>
    </div>
  );
}

export function DashboardBuild(): ReactNode {
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
        <p className="sr-only">
          Animated preview of the MenuMinute dashboard for a sample restaurant: workspace
          navigation, a top bar with search, till status and notifications, and six at-a-glance menu
          statistics.
        </p>
        <div className="db__perspective">
          <div className="db__fit">
            <div ref={stageRef} className="db__stage" style={stageStyle(0)} aria-hidden="true">
              <div
                className="db__shell"
                data-piece="shell"
                style={pieceStyle(0, pieceById("shell"))}
              />
              <ReplicaSidebar />
              <ReplicaTopbar />
              <Placeholder id="hero" label="Overview hero (placeholder)" className="db-ph--hero" />
              <ReplicaGlance />
              <Placeholder
                id="priorities"
                label="Priorities (placeholder)"
                className="db-ph--priorities"
              />
              <Placeholder
                id="health"
                label="Outlet health (placeholder)"
                className="db-ph--health"
              />
              <Placeholder
                id="pulse"
                label="Service pulse (placeholder)"
                className="db-ph--pulse"
              />
              <Placeholder id="floor" label="Floor map (placeholder)" className="db-ph--floor" />
              <Placeholder id="order" label="New order (placeholder)" className="db-ph--order" />
              <ReplicaBottomBar />
            </div>
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
