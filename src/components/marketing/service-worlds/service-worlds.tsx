"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChefHat,
  Pause,
  Play,
  RotateCcw,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { SECTION6_SVG } from "./service-worlds-art";
import "./service-worlds.css";

type Mode = "dine" | "take" | "cloud";
type Controls = { choose: (mode: Mode) => void; replay: () => void; toggle: () => void };
const END = 9000;
const STAGES = [1500, 3000, 4500, 6000, 7500, END] as const;
const OPTIONS = [
  {
    id: "dine",
    label: "Dine-in",
    Icon: UtensilsCrossed,
    headline: "Make every table a little more inviting.",
    detail:
      "Guests scan a permanent table QR and browse a beautiful menu. No app or guest account needed.",
    status: "FREE QR MENU · AVAILABLE TODAY",
  },
  {
    id: "take",
    label: "Takeout",
    Icon: ShoppingBag,
    headline: "Your counter deserves a digital front door.",
    detail:
      "Give your pickup-focused business a beautiful digital menu. Online pickup ordering is in development.",
    status: "PICKUP ORDERING · IN DEVELOPMENT",
  },
  {
    id: "cloud",
    label: "Cloud kitchen",
    Icon: ChefHat,
    headline: "A home for your delivery-first food brand.",
    detail:
      "Present your dishes online without a dining room. Connected ordering and kitchen experiences are planned.",
    status: "CONNECTED WORKFLOWS · IN DEVELOPMENT",
  },
] as const;

/** Marketing illustration only: the QR motif is decorative; no orders are sent and no camera is accessed. */
export function ServiceWorlds() {
  const stageRef = useRef<HTMLDivElement>(null);
  const controls = useRef<Controls | null>(null);
  const [mode, setMode] = useState<Mode>("dine");
  const [phase, setPhase] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const stage = stageRef.current;
    const svg = stage?.querySelector<SVGSVGElement>("svg[data-mm6]");
    if (!svg) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 680px)");
    let elapsed = END;
    let last: number | null = null;
    let frame = 0;
    let running = false;
    let visible = false;
    let entered = false;
    let manuallyPaused = false;
    let selected: Mode = "dine";
    let reduce = preference.matches || compact.matches;

    const paint = () => {
      const next = STAGES.findIndex((time) => elapsed < time);
      const step = next === -1 ? 6 : next;
      svg.dataset.step = String(step);
      svg.dataset.mode = selected;
      svg.classList.toggle("is-intro", step < 6);
      svg.classList.toggle("paused", !running);
      svg
        .querySelector<SVGElement>("#mm6-progress-value")
        ?.setAttribute("width", String(1284 * Math.min(elapsed / END, 1)));
      const status = svg.querySelector<SVGElement>("#mm6-status");
      if (status)
        status.textContent =
          step < 6
            ? ([
                "01 / DRAW THE ROOM",
                "02 / SET THE TABLES",
                "03 / GUEST SCANS TABLE QR",
                "04 / MENU OPENS ON PHONE",
                "05 / CHOOSE YOUR SERVICE WORLD",
                "06 / YOUR RESTAURANT, YOUR WAY",
              ][step] ?? "")
            : {
                dine: "DINE-IN  /  QR MENU AVAILABLE TODAY",
                take: "TAKEOUT  /  PICKUP ORDERING PLANNED",
                cloud: "CLOUD KITCHEN  /  CONNECTED WORKFLOWS PLANNED",
              }[selected];
      setPhase((previous) => (previous === step ? previous : step));
    };
    const stop = () => {
      running = false;
      last = null;
      window.cancelAnimationFrame(frame);
      svg.classList.add("paused");
      setPlaying(false);
    };
    const tick = (now: number) => {
      if (!running) return;
      if (last === null) last = now;
      elapsed = Math.min(END, elapsed + Math.min(now - last, 100));
      last = now;
      if (elapsed >= END) {
        stop();
        paint();
        return;
      }
      paint();
      frame = window.requestAnimationFrame(tick);
    };
    const start = () => {
      if (running || !visible || document.hidden || reduce || manuallyPaused || elapsed >= END)
        return;
      running = true;
      last = null;
      setPlaying(true);
      svg.classList.remove("paused");
      frame = window.requestAnimationFrame(tick);
    };
    const sync = () => {
      if (!visible || document.hidden || reduce) stop();
      else if (entered) start();
    };
    const finish = () => {
      stop();
      elapsed = END;
      paint();
    };
    controls.current = {
      choose(next) {
        selected = next;
        setMode(next);
        finish();
      },
      replay() {
        stop();
        selected = "dine";
        setMode("dine");
        entered = true;
        manuallyPaused = false;
        elapsed = reduce ? END : 0;
        paint();
        start();
      },
      toggle() {
        if (elapsed >= END) {
          controls.current?.replay();
        } else if (running) {
          manuallyPaused = true;
          stop();
        } else {
          manuallyPaused = false;
          start();
        }
      },
    };
    const syncTheme = () => {
      const dark = document.documentElement.dataset.theme === "dark";
      svg.classList.toggle("theme-dark", dark);
      svg.classList.toggle("theme-light", !dark);
    };
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const syncPreference = () => {
      reduce = preference.matches || compact.matches;
      setReduced(reduce);
      if (reduce) {
        entered = true;
        finish();
      } else sync();
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              visible = Boolean(entry?.isIntersecting);
              if (visible && !entered) {
                entered = true;
                manuallyPaused = false;
                elapsed = reduce ? END : 0;
                paint();
              }
              sync();
            },
            { threshold: 0.08 }
          );
    syncTheme();
    paint();
    if (observer && stage) observer.observe(stage);
    else {
      visible = true;
      entered = true;
      elapsed = reduce ? END : 0;
      paint();
      sync();
    }
    syncPreference();
    preference.addEventListener("change", syncPreference);
    compact.addEventListener("change", syncPreference);
    document.addEventListener("visibilitychange", sync);
    return () => {
      stop();
      observer?.disconnect();
      themeObserver.disconnect();
      preference.removeEventListener("change", syncPreference);
      compact.removeEventListener("change", syncPreference);
      document.removeEventListener("visibilitychange", sync);
      controls.current = null;
    };
  }, []);

  const chosen = OPTIONS.find((item) => item.id === mode) ?? OPTIONS[0];
  return (
    <section
      className="service-worlds"
      aria-labelledby="service-worlds-heading"
      data-testid="service-worlds"
    >
      <div className="mm6-container">
        <header className="mm6-header">
          <span className="mm6-eyebrow">06 / BUILT FOR YOUR WORLD</span>
          <h2 id="service-worlds-heading">
            Different kitchens. <em>One beautiful beginning.</em>
          </h2>
          <p>
            Whether you serve at tables, over the counter or from a delivery-first kitchen,
            MenuMinute starts with your kind of business.
          </p>
        </header>
        <div
          className="mm6-modes"
          role="group"
          aria-label="Choose your restaurant environment"
          data-ready={phase >= 4 || reduced}
        >
          {OPTIONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className="mm6-mode"
              aria-pressed={mode === id}
              onClick={() => controls.current?.choose(id)}
            >
              <Icon size={18} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        <div
          ref={stageRef}
          className="mm6-stage"
          data-testid="service-worlds-stage"
          dangerouslySetInnerHTML={{ __html: SECTION6_SVG }}
        />
        <div className="mm6-toolbar">
          <span>Original illustrated preview · No real scan, order or payment takes place</span>
          <div className="mm6-controls" role="group" aria-label="Animation playback">
            <button
              type="button"
              onClick={() => controls.current?.replay()}
              disabled={reduced}
              aria-label="Replay introduction"
            >
              <RotateCcw size={16} aria-hidden="true" /> Replay
            </button>
            <button
              type="button"
              onClick={() => controls.current?.toggle()}
              disabled={reduced}
              aria-label={
                playing
                  ? "Pause introduction"
                  : phase < 6
                    ? "Resume introduction"
                    : "Replay introduction"
              }
            >
              {playing ? (
                <Pause size={16} aria-hidden="true" />
              ) : (
                <Play size={16} aria-hidden="true" />
              )}
              {playing ? "Pause" : phase < 6 ? "Resume" : "Play"}
            </button>
          </div>
        </div>
        {reduced && (
          <p className="mm6-static-note">
            Static composition for smaller screens or reduced-motion preferences; all three
            environments remain selectable.
          </p>
        )}
        <div className="mm6-explainer" aria-live="polite">
          <span className="mm6-state">{chosen.status}</span>
          <h3>{chosen.headline}</h3>
          <p>{chosen.detail}</p>
        </div>
        <div className="mm6-outro">
          <div>
            <h3>However you serve, start beautifully.</h3>
            <p>
              Your free digital menu is the beginning. Ordering and kitchen workflows are coming
              later.
            </p>
          </div>
          <div className="mm6-links">
            <Link href="/register" className="mm6-primary">
              Create your free menu <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/demo" className="mm6-secondary">
              Explore the live QR demo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
