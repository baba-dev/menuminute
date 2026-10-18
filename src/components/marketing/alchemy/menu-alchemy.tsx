"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, Check, Pause, Play, RotateCcw, ScanText, Sparkles } from "lucide-react";
import { MENU_ALCHEMY_SVG } from "./alchemy-artwork";
import { ALCHEMY_DURATION_MS, alchemyStage, renderAlchemy } from "./alchemy-motion";
import "./menu-alchemy.css";

type Controls = { pause: () => void; resume: () => void; replay: () => void };
const dishes = [
  { name: "Paneer Tikka", price: "₹260", category: "Starters", art: "paneer" },
  { name: "Dal Makhani", price: "₹220", category: "Main Course", art: "dal" },
  { name: "Masala Dosa", price: "₹180", category: "South Indian", art: "dosa" },
] as const;

/** Marketing illustration only. It does not invoke OCR, an image provider or menu import. */
export function MenuAlchemy() {
  const rootRef = useRef<HTMLElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const stage = artRef.current;
    const artwork = stage?.querySelector<SVGSVGElement>("svg");
    if (!root || !stage || !artwork) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let elapsed = ALCHEMY_DURATION_MS;
    let lastFrame = 0;
    let frame = 0;
    let running = false;
    let entered = false;
    let visible = false;
    let manuallyPaused = false;
    let reducedMotion = preference.matches;
    let phase = 3;

    function paint() {
      if (!artwork || !root) return;
      renderAlchemy(artwork, elapsed, running && !reducedMotion);
      const next = alchemyStage(elapsed);
      if (next !== phase) {
        phase = next;
        root.dataset.phase = String(phase);
      }
    }
    function stop() {
      running = false;
      lastFrame = 0;
      window.cancelAnimationFrame(frame);
      setPlaying(false);
    }
    function tick(timestamp: number) {
      if (!running) return;
      if (lastFrame === 0) lastFrame = timestamp;
      elapsed = Math.min(ALCHEMY_DURATION_MS, elapsed + Math.min(timestamp - lastFrame, 100));
      lastFrame = timestamp;
      paint();
      if (elapsed >= ALCHEMY_DURATION_MS) {
        stop();
        return;
      }
      frame = window.requestAnimationFrame(tick);
    }
    function start() {
      if (running || !visible || document.hidden || reducedMotion) return;
      if (elapsed >= ALCHEMY_DURATION_MS) elapsed = 0;
      running = true;
      lastFrame = 0;
      setPlaying(true);
      paint();
      frame = window.requestAnimationFrame(tick);
    }
    function syncVisibility() {
      if (!visible || document.hidden) {
        stop();
      } else if (entered && !manuallyPaused && !reducedMotion && elapsed < ALCHEMY_DURATION_MS) {
        start();
      }
    }
    function syncPreference() {
      reducedMotion = preference.matches;
      setReduced(reducedMotion);
      if (reducedMotion) {
        stop();
        elapsed = ALCHEMY_DURATION_MS;
        entered = true;
        paint();
      }
    }

    controlsRef.current = {
      pause: () => {
        manuallyPaused = true;
        stop();
      },
      resume: () => {
        manuallyPaused = false;
        entered = true;
        start();
      },
      replay: () => {
        stop();
        elapsed = 0;
        entered = true;
        manuallyPaused = false;
        paint();
        start();
      },
    };
    paint();
    syncPreference();
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              visible = Boolean(entry?.isIntersecting);
              if (visible && !entered && !reducedMotion) {
                entered = true;
                elapsed = 0;
                paint();
              }
              syncVisibility();
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.15 }
          )
        : null;
    if (observer) observer.observe(root.querySelector(".ma-stage") ?? stage);
    else {
      visible = true;
      if (!reducedMotion) {
        entered = true;
        elapsed = 0;
        paint();
        start();
      }
    }
    document.addEventListener("visibilitychange", syncVisibility);
    preference.addEventListener("change", syncPreference);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
      preference.removeEventListener("change", syncPreference);
      controlsRef.current = null;
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className="menu-alchemy"
      aria-labelledby="menu-alchemy-heading"
      data-testid="menu-alchemy"
      data-phase="3"
    >
      <div className="ma-container">
        <header className="ma-intro">
          <span className="ma-kicker">
            <Sparkles size={14} aria-hidden="true" />
            03 / COMING SOON — SMART MENU IMPORT
          </span>
          <h2 id="menu-alchemy-heading">
            Your menu already exists.
            <span>Why type it all again?</span>
          </h2>
          <p>
            We&apos;re building a smarter way to bring your restaurant online. Turn photos of your
            existing menu into organized, editable dish records with prices and suggested imagery.
          </p>
        </header>

        <div className="ma-stage" aria-label="Illustrated preview of the proposed menu import experience">
          <div
            ref={artRef}
            className="ma-desktop-art"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: MENU_ALCHEMY_SVG }}
          />
          <div className="ma-mobile-art" aria-hidden="true">
            <div className="ma-mobile-sheet">
              <div className="ma-mobile-flourish">✧ THE SPICE HOUSE ✧</div>
              <strong>A little taste of home</strong>
              <div className="ma-mobile-menu-rows">
                {dishes.map((dish) => (
                  <div key={dish.name}>
                    <span>{dish.name}</span>
                    <b>{dish.price}</b>
                  </div>
                ))}
              </div>
              <div className="ma-mobile-beam" />
            </div>
            <div className="ma-mobile-transform">
              <ScanText size={21} aria-hidden="true" />
              <span>Reading dishes &amp; prices</span>
              <ArrowRight size={18} aria-hidden="true" />
            </div>
            <div className="ma-mobile-board">
              <div className="ma-mobile-board-head">
                <span>Menu Studio <small>THE SPICE HOUSE</small></span>
                <small>DRAFT</small>
              </div>
              <strong>Your imported dishes</strong>
              {dishes.map((dish) => (
                <div className="ma-mobile-dish" key={dish.name}>
                  <div className={`ma-dish-art ma-dish-art--${dish.art}`}>
                    {dish.art === "paneer" ? "▣" : dish.art === "dal" ? "◉" : "◕"}
                  </div>
                  <div><b>{dish.name}</b><small>{dish.category} · Image suggested</small></div>
                  <strong>{dish.price}</strong>
                </div>
              ))}
              <div className="ma-mobile-review"><Check size={16} /> Ready for your finishing touch</div>
            </div>
          </div>
        </div>

        <div className="ma-toolbar">
          <span className="ma-sample-note">Illustrative preview · No live import is performed</span>
          <div className="ma-controls" role="group" aria-label="Illustration playback controls">
            <button
              type="button"
              onClick={() => controlsRef.current?.replay()}
              disabled={reduced}
              aria-label="Replay the nine-second illustration"
              title="Replay illustration"
            >
              <RotateCcw size={17} aria-hidden="true" />
              <span>Replay</span>
            </button>
            <button
              type="button"
              onClick={() => (playing ? controlsRef.current?.pause() : controlsRef.current?.resume())}
              disabled={reduced}
              aria-label={playing ? "Pause illustration" : "Play illustration"}
              title={playing ? "Pause illustration" : "Play illustration"}
            >
              {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
              <span>{playing ? "Pause" : "Play"}</span>
            </button>
          </div>
          {reduced && <span className="ma-reduced-note">Static preview for reduced motion</span>}
        </div>

        <div className="ma-outro">
          <div className="ma-path">
            <span><Camera size={17} aria-hidden="true" /> Photograph</span>
            <i aria-hidden="true" />
            <span><ScanText size={17} aria-hidden="true" /> Organize</span>
            <i aria-hidden="true" />
            <span><Check size={17} aria-hidden="true" /> Review</span>
          </div>
          <h3>From your first photograph to your first digital menu.</h3>
          <p>Your dishes. Your prices. Your finishing touch. Nothing is published without your approval.</p>
          <Link className="ma-cta" href="/register">
            Create your free menu today <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <p className="ma-cta-note">Manual menu creation is available now; smart photo import is in development.</p>
        </div>
      </div>
    </section>
  );
}
