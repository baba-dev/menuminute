"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ChefHat,
  ClipboardCheck,
  Pause,
  Play,
  RotateCcw,
  Route,
  Timer,
  Wifi,
} from "lucide-react";
import {
  DARK_DESKTOP,
  DARK_MOBILE,
  LIGHT_DESKTOP,
  LIGHT_MOBILE,
} from "./chef-pass-art";
import { CHEF_PASS_DURATION_MS, chefPassStage, renderChefPass } from "./chef-pass-motion";
import "./chef-pass.css";

type Playback = { pause: () => void; resume: () => void; replay: () => void };

const capabilities = [
  {
    label: "Intelligent station routing",
    detail: "Accepted preparation work directed to the appropriate station.",
    Icon: Route,
  },
  {
    label: "Preparation at a glance",
    detail: "Clear quantities, modifiers, timing and individual progress.",
    Icon: Timer,
  },
  {
    label: "A coordinated final pass",
    detail: "Required station work brought together before authorized release.",
    Icon: ClipboardCheck,
  },
  {
    label: "Designed for busy service",
    detail: "Planned connection awareness and recoverable kitchen workflows.",
    Icon: Wifi,
  },
] as const;

/** Visual marketing fixture, not the live Kitchen Pro / guest-order interface. */
export function ChefPass() {
  const rootRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<Playback | null>(null);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stage = root.querySelector<HTMLElement>(".cp-stage");
    const dark = root.querySelector<SVGSVGElement>(".cp-desktop-dark svg");
    const light = root.querySelector<SVGSVGElement>(".cp-desktop-light svg");
    if (!stage || !dark || !light) return;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobilePreference = window.matchMedia("(max-width: 680px)");
    let elapsed = CHEF_PASS_DURATION_MS;
    let previous = 0;
    let frame = 0;
    let running = false;
    let started = false;
    let visible = false;
    let manualPause = false;
    let reduceMotion = motionPreference.matches;
    let phone = mobilePreference.matches;

    function paint() {
      if (!dark || !light || !root) return;
      renderChefPass(dark, elapsed, "dark");
      renderChefPass(light, elapsed, "light");
      root.dataset.phase = String(chefPassStage(elapsed));
    }
    function stop() {
      running = false;
      previous = 0;
      window.cancelAnimationFrame(frame);
      setPlaying(false);
    }
    function tick(timestamp: number) {
      if (!running) return;
      if (!previous) previous = timestamp;
      elapsed = Math.min(CHEF_PASS_DURATION_MS, elapsed + Math.min(timestamp - previous, 100));
      previous = timestamp;
      paint();
      if (elapsed >= CHEF_PASS_DURATION_MS) {
        stop();
        return;
      }
      frame = window.requestAnimationFrame(tick);
    }
    function start() {
      if (running || !visible || document.hidden || reduceMotion || phone) return;
      if (elapsed >= CHEF_PASS_DURATION_MS) elapsed = 0;
      running = true;
      previous = 0;
      setPlaying(true);
      paint();
      frame = window.requestAnimationFrame(tick);
    }
    function syncVisibility() {
      if (!visible || document.hidden || reduceMotion || phone) {
        stop();
      } else if (started && !manualPause && elapsed < CHEF_PASS_DURATION_MS) {
        start();
      }
    }
    function syncPreferences() {
      reduceMotion = motionPreference.matches;
      phone = mobilePreference.matches;
      setReduced(reduceMotion);
      setMobile(phone);
      if (reduceMotion || phone) {
        stop();
        elapsed = CHEF_PASS_DURATION_MS;
        paint();
      } else if (!started && visible) {
        started = true;
        elapsed = 0;
        paint();
      }
      syncVisibility();
    }

    controlsRef.current = {
      pause() {
        manualPause = true;
        stop();
      },
      resume() {
        manualPause = false;
        started = true;
        start();
      },
      replay() {
        stop();
        manualPause = false;
        started = true;
        elapsed = 0;
        paint();
        start();
      },
    };
    paint();
    syncPreferences();
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              visible = Boolean(entry?.isIntersecting);
              if (visible && !started && !reduceMotion && !phone) {
                started = true;
                elapsed = 0;
                paint();
              }
              syncVisibility();
            },
            { threshold: 0.08 }
          )
        : null;
    if (observer) observer.observe(stage);
    else {
      visible = true;
      if (!reduceMotion && !phone) {
        started = true;
        elapsed = 0;
        paint();
        start();
      }
    }
    const onVisibility = () => syncVisibility();
    motionPreference.addEventListener("change", syncPreferences);
    mobilePreference.addEventListener("change", syncPreferences);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      motionPreference.removeEventListener("change", syncPreferences);
      mobilePreference.removeEventListener("change", syncPreferences);
      document.removeEventListener("visibilitychange", onVisibility);
      controlsRef.current = null;
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="chef-pass"
      aria-labelledby="chef-pass-heading"
      data-testid="chef-pass"
      data-phase="4"
    >
      <div className="cp-container">
        <header className="cp-intro">
          <span className="cp-eyebrow">
            <ChefHat size={17} aria-hidden="true" /> 05 / THE CHEF&apos;S PASS
          </span>
          <span className="cp-roadmap">KITCHEN PRO · IN DEVELOPMENT</span>
          <h2 id="chef-pass-heading">
            One order. Every station. <em>In sync.</em>
          </h2>
          <p className="cp-lead">The kitchen is where everything comes together.</p>
          <p className="cp-description">
            From Grill to Tandoor to Drinks, discover the multi-station Kitchen Display System
            we&apos;re designing to keep preparation coordinated and the final handoff deliberate.
          </p>
        </header>

        <div
          className="cp-stage"
          role="img"
          aria-label="Illustrative future Kitchen Pro: accepted order 1042 splits into distinct Grill, Tandoor and Drinks assignments. Drinks finishes before Grill and Tandoor. The order stays unreleased until all stations finish and an expeditor confirms the handoff."
        >
          <div
            className="cp-desktop-art cp-desktop-dark"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: DARK_DESKTOP }}
          />
          <div
            className="cp-desktop-art cp-desktop-light"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: LIGHT_DESKTOP }}
          />
          <div
            className="cp-mobile-art cp-mobile-dark"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: DARK_MOBILE }}
          />
          <div
            className="cp-mobile-art cp-mobile-light"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: LIGHT_MOBILE }}
          />
        </div>

        <div className="cp-toolbar">
          <span>Illustrative product preview · No live orders or kitchen actions</span>
          <div className="cp-controls" role="group" aria-label="Chef's Pass playback controls">
            <button
              type="button"
              onClick={() => controlsRef.current?.replay()}
              disabled={reduced || mobile}
              aria-label="Replay Chef's Pass animation"
            >
              <RotateCcw size={16} aria-hidden="true" /> Replay
            </button>
            <button
              type="button"
              onClick={() =>
                playing ? controlsRef.current?.pause() : controlsRef.current?.resume()
              }
              disabled={reduced || mobile}
              aria-label={playing ? "Pause Chef's Pass animation" : "Play Chef's Pass animation"}
            >
              {playing ? (
                <Pause size={16} aria-hidden="true" />
              ) : (
                <Play size={16} aria-hidden="true" />
              )}
              {playing ? "Pause" : "Play"}
            </button>
          </div>
          {(reduced || mobile) && (
            <span className="cp-static-hint">
              {reduced ? "Static preview for reduced motion" : "Mobile final-state composition"}
            </span>
          )}
        </div>

        <div className="cp-capabilities" aria-label="Planned Kitchen Pro capabilities">
          {capabilities.map(({ label, detail, Icon }) => (
            <div className="cp-capability" key={label}>
              <span className="cp-capability-icon">
                <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </div>
          ))}
        </div>
        <div className="cp-outro">
          <div>
            <h3>Less chasing tickets. More focus on the food.</h3>
            <p>
              Full multi-station Kitchen Pro is in development and not yet available for purchase.
              Begin with your free QR menu while we build the kitchen experience.
            </p>
          </div>
          <div className="cp-links">
            <Link className="cp-primary" href="/pricing">
              Explore future plans <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <Link className="cp-secondary" href="/register">
              Create your free menu <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
