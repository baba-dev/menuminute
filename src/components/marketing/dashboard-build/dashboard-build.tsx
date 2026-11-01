"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { NewOrderContext } from "./dashboard-build-beats";
import { CHAPTER_CAPTIONS } from "./dashboard-build-fixture";
import {
  CHAPTERS,
  NAV_PX,
  beatOn,
  chapterAt,
  cueOpacity,
  dampProgress,
  pieceById,
  pieceStyle,
  pinnedProgress,
  renderDashboardBuild,
  stageStyle,
} from "./dashboard-build-timeline";
import {
  ReplicaBody,
  ReplicaBottomBar,
  ReplicaHero,
  ReplicaSidebar,
  ReplicaTopbar,
} from "./dashboard-replica";
import "@/app/(dashboard)/workspace.css";
import "@/app/(dashboard)/workspace-delight.css";
import "@/app/(dashboard)/dashboard/dashboard-operations.css";
import "./dashboard-build.css";

/**
 * Pinned, scroll-assembled dashboard. The sidebar, top bar, hero, KPI row, priorities and outlet
 * health are faithful replicas of the real workspace (real class names, nav model, icons and
 * artwork). Captions beside it carry the explanatory copy and links, because the stage itself is a
 * non-interactive picture. Marketing fixture: no API calls, no auth, no tenant data.
 */

export function DashboardBuild(): ReactNode {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  // The new order's data changes, not just its text, so React re-renders the floor and pulse panels
  // when the scroll passes the table beat. Default `true` is the finished state (server, no-JS).
  const [newOrder, setNewOrder] = useState(true);
  const newOrderRef = useRef(true);
  const repaint = useRef<(() => void) | null>(null);

  // After the panels re-render with the new data, repaint so scroll-driven numbers are re-applied.
  useEffect(() => {
    repaint.current?.();
  }, [newOrder]);

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
      return pinnedProgress(rect.top, rect.height, window.innerHeight);
    };
    const camera = stage.querySelector<HTMLElement>("[data-camera]");
    // The page is taller than the window; the camera pans by the difference (unscaled px).
    const measureTravel = () => {
      if (!camera) return;
      const travel = String(Math.max(0, camera.offsetHeight - stage.clientHeight));
      if (stage.dataset["travel"] !== travel) stage.dataset["travel"] = travel;
    };
    const apply = (p: number) => {
      renderDashboardBuild(stage, p);
      const cue = cueRef.current;
      if (cue) cue.style.opacity = String(Math.round(cueOpacity(p) * 100) / 100);
      const landed = beatOn(p, "table");
      if (newOrderRef.current !== landed) {
        newOrderRef.current = landed;
        setNewOrder(landed);
      }
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
    repaint.current = () => apply(displayed);
    measureTravel();
    target = measure();
    displayed = target;
    apply(displayed);

    // Fonts and images change the page height after mount; re-measure and repaint when they do.
    const observer = camera ? new ResizeObserver(() => (measureTravel(), apply(displayed))) : null;
    if (camera) observer?.observe(camera);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    motion.addEventListener("change", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      motion.removeEventListener("change", onScroll);
      repaint.current = null;
      observer?.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  function goToChapter(at: number) {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rect = root.getBoundingClientRect();
    const travel = Math.max(0, rect.height - (window.innerHeight - NAV_PX));
    window.scrollTo({
      top: window.scrollY + rect.top - NAV_PX + at * travel,
      behavior: reduced ? "auto" : "smooth",
    });
  }

  return (
    <section
      ref={rootRef}
      className="db"
      aria-labelledby="db-title"
      data-chapter="navigate"
      style={{ ["--db-nav" as string]: `${NAV_PX}px` }}
    >
      <div className="db__sticky">
        <h2 id="db-title" className="db__title">
          Your real dashboard, assembled as you scroll
        </h2>
        <p className="sr-only">
          Animated preview of the MenuMinute dashboard for a sample restaurant: workspace
          navigation, a top bar with search, till status and notifications, a welcome banner, six
          at-a-glance menu statistics, today’s priorities and outlet health with setup progress.
        </p>
        <div className="db__perspective">
          <div ref={cueRef} className="db__cue" aria-hidden="true">
            <span className="db__cue-text">Scroll to build your dashboard</span>
            <span className="db__cue-mouse">
              <i />
            </span>
            <span className="db__cue-chevrons">
              <ChevronDown size={18} />
              <ChevronDown size={18} />
            </span>
          </div>
          <div className="db__fit">
            <div
              ref={stageRef}
              className="db__stage"
              style={stageStyle(0)}
              aria-hidden="true"
              inert
            >
              <div className="db__ghost" data-ghost>
                <span className="db__ghost-side" />
                <span className="db__ghost-top" />
                <span className="db__ghost-hero" />
                <span className="db__ghost-kpis">
                  {Array.from({ length: 6 }, (_, i) => (
                    <i key={i} />
                  ))}
                </span>
                <span className="db__ghost-card" data-n="1" />
                <span className="db__ghost-card" data-n="2" />
              </div>
              <div
                className="db__shell"
                data-piece="shell"
                style={pieceStyle(0, pieceById("shell"))}
              />
              <NewOrderContext.Provider value={newOrder}>
                <div className="db__camera" data-camera>
                  <ReplicaTopbar />
                  <div className="mm-dashboard db-replica-dashboard">
                    <ReplicaHero />
                    <ReplicaBody />
                  </div>
                </div>
              </NewOrderContext.Provider>
              <ReplicaSidebar />
              <ReplicaBottomBar />
            </div>
          </div>
        </div>
        <div className="db__captions">
          {CHAPTERS.map((chapter) => {
            const caption = CHAPTER_CAPTIONS[chapter.id]!;
            return (
              <div key={chapter.id} className="db__caption" data-for={chapter.id}>
                <strong>{caption.title}</strong>
                <span>{caption.body}</span>
                <Link href={caption.href}>
                  {caption.cta} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            );
          })}
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
