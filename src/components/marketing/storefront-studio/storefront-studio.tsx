"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play, RotateCcw, ScanLine, Sparkles } from "lucide-react";
import { StickerArt } from "./sticker-art";
import { MOUNTING_SURFACES, STICKER_DEMO_URL, STICKER_FORMATS } from "./sticker-config";
import type { MountingSurface, StickerFormat } from "./sticker-config";
import { StorefrontScene } from "./storefront-scene";
import "./storefront-studio.css";

const DURATION = 7000;
const PHASE_END = [1500, 3000, 4500, 5500, 7000] as const;
type Playback = "ready" | "running" | "paused" | "done";
type Player = { finish: () => void; toggle: () => void };

/** Interactive marketing fixture. Only the public Spice Route Kitchen demo URL is encoded. */
export function StorefrontStudio({ qrDataUrl }: { qrDataUrl: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [design, setDesign] = useState<StickerFormat>("primary");
  const [mount, setMount] = useState<MountingSurface>("window");
  const [playback, setPlayback] = useState<Playback>("ready");
  const [phase, setPhase] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const selected = STICKER_FORMATS.find((item) => item.id === design) ?? STICKER_FORMATS[0];

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let elapsed = 0;
    let last = 0;
    let frame = 0;
    let visible = false;
    let started = false;
    let manualPause = false;
    let done = false;
    let reduce = motion.matches;
    setReduced(reduce);

    const stopFrame = () => {
      window.cancelAnimationFrame(frame);
      last = 0;
    };
    const finish = () => {
      done = true;
      elapsed = DURATION;
      stopFrame();
      setPhase(5);
      setPlayback("done");
    };
    const tick = (time: number) => {
      if (last === 0) last = time;
      elapsed = Math.min(DURATION, elapsed + Math.min(time - last, 100));
      last = time;
      const next = PHASE_END.findIndex((end) => elapsed < end);
      setPhase(next === -1 ? 5 : next);
      if (elapsed >= DURATION) {
        finish();
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    const sync = () => {
      if (done) return;
      if (!visible || document.hidden || reduce || manualPause) {
        stopFrame();
        if (started) setPlayback("paused");
        return;
      }
      if (!started) started = true;
      stopFrame();
      setPlayback("running");
      frame = window.requestAnimationFrame(tick);
    };
    const onMotion = () => {
      reduce = motion.matches;
      setReduced(reduce);
      if (reduce) finish();
      else sync();
    };
    playerRef.current = {
      finish,
      toggle() {
        manualPause = !manualPause;
        sync();
      },
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              visible = Boolean(entry?.isIntersecting);
              sync();
            },
            { threshold: 0.1 }
          );
    if (observer) observer.observe(stage);
    else {
      visible = true;
      sync();
    }
    if (reduce) finish();
    motion.addEventListener("change", onMotion);
    document.addEventListener("visibilitychange", sync);
    return () => {
      stopFrame();
      observer?.disconnect();
      motion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", sync);
      playerRef.current = null;
    };
  }, [epoch]);

  const select = (next: StickerFormat) => {
    playerRef.current?.finish();
    setDesign(next);
  };
  const chooseSurface = (next: MountingSurface) => {
    playerRef.current?.finish();
    setMount(next);
  };
  const replay = () => {
    if (reduced) return;
    setDesign("primary");
    setMount("window");
    setPhase(0);
    setPlayback("ready");
    setEpoch((previous) => previous + 1);
  };

  return (
    <section
      className="storefront-studio"
      aria-labelledby="storefront-studio-heading"
      data-testid="storefront-studio"
      data-intro={playback}
      data-phase={phase}
    >
      <div className="ss-container">
        <header className="ss-header">
          <span className="ss-eyebrow">
            <Sparkles size={15} aria-hidden="true" /> 07 / FROM MENU TO STOREFRONT
          </span>
          <h2 id="storefront-studio-heading">
            Your menu deserves <em>a place in the window.</em>
          </h2>
          <p>
            Six distinctive MenuMinute sticker concepts for doors, windows and counters. Choose a
            design and see it come to life.
          </p>
        </header>

        <div className="ss-layout">
          <div className="ss-visual-column">
            <div
              className="ss-stage"
              ref={stageRef}
              data-testid="sticker-stage"
              data-mount={mount}
              data-design={design}
              role="img"
              aria-label={`${selected.name} restaurant menu QR sticker illustrated on a ${MOUNTING_SURFACES.find((s) => s.id === mount)?.name.toLowerCase() ?? "window"}; sample artwork using the public Spice Route Kitchen demo QR`}
            >
              <div className="ss-scene-wrap" key={`scene-${epoch}`}>
                <StorefrontScene />
              </div>
              <div
                className="ss-decal-host"
                data-design={design}
                key={`${epoch}-${design}-${mount}`}
              >
                <div className="ss-decal-shadow" aria-hidden="true" />
                <StickerArt design={design} qrDataUrl={qrDataUrl} />
                <div className="ss-adhesion" aria-hidden="true" />
                <div className="ss-scan-focus" aria-hidden="true">
                  <ScanLine size={31} />
                </div>
              </div>
              <div className="ss-scene-label" aria-hidden="true">
                YOUR RESTAURANT · SAMPLE PREVIEW
              </div>
              <div className="ss-stage-glow" aria-hidden="true" />
            </div>
            <div className="ss-toolbar">
              <span>
                Illustrative storefront · Preview only, not a sticker purchase or printing service
              </span>
              <div className="ss-playback" role="group" aria-label="Storefront animation playback">
                <button
                  type="button"
                  onClick={replay}
                  disabled={reduced}
                  aria-label="Replay storefront introduction"
                >
                  <RotateCcw size={16} aria-hidden="true" /> Replay
                </button>
                <button
                  type="button"
                  onClick={() => (playback === "done" ? replay() : playerRef.current?.toggle())}
                  disabled={reduced}
                  aria-label={
                    playback === "running"
                      ? "Pause storefront introduction"
                      : playback === "paused"
                        ? "Resume storefront introduction"
                        : "Play storefront introduction"
                  }
                >
                  {playback === "running" ? (
                    <Pause size={16} aria-hidden="true" />
                  ) : (
                    <Play size={16} aria-hidden="true" />
                  )}
                  {playback === "running" ? "Pause" : "Play"}
                </button>
              </div>
            </div>
            {reduced && (
              <p className="ss-static-note">
                Static final-state artwork for reduced-motion preferences. All designs and surfaces
                remain selectable.
              </p>
            )}
          </div>

          <div className="ss-catalogue">
            <div className="ss-catalogue-head">
              <span className="ss-catalogue-kicker">THE STICKER COLLECTION</span>
              <span>SELECT A FORMAT</span>
            </div>
            <div className="ss-design-grid" role="radiogroup" aria-label="Choose sticker design">
              {STICKER_FORMATS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className="ss-format"
                  style={{ "--ss-order": index } as React.CSSProperties}
                  role="radio"
                  aria-checked={design === item.id}
                  onClick={() => select(item.id)}
                >
                  <span className="ss-format-art">
                    <StickerArt design={item.id} qrDataUrl={qrDataUrl} thumbnail />
                  </span>
                  <span className="ss-format-meta">
                    <b>
                      {item.number} / {item.name}
                    </b>
                    <small>{item.short}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="ss-selection" aria-live="polite">
              <span>SELECTED · {selected.number} / 06</span>
              <h3>{selected.name}</h3>
              <p>{selected.detail}</p>
            </div>
            <div className="ss-surface-block">
              <span className="ss-catalogue-kicker">SEE IT IN PLACE</span>
              <div className="ss-surfaces" role="radiogroup" aria-label="Sticker preview surface">
                {MOUNTING_SURFACES.map((surface) => (
                  <button
                    key={surface.id}
                    type="button"
                    role="radio"
                    aria-checked={mount === surface.id}
                    onClick={() => chooseSurface(surface.id)}
                  >
                    {surface.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="ss-outro">
          <div className="ss-outro-copy">
            <span>ONE PERMANENT DIGITAL DESTINATION</span>
            <h3>Make your first scan count.</h3>
            <p>
              See how your guests explore a real sample menu. Create your own free menu when you are
              ready; printable sticker tooling is a future concept.
            </p>
            <div className="ss-links">
              <Link href="/register" className="ss-primary">
                Create your free menu <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/demo" className="ss-secondary">
                Explore the live demo
              </Link>
            </div>
          </div>
          <div className="ss-real-qr">
            <div className="ss-real-qr-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code that opens the public Spice Route Kitchen demo menu"
                width="172"
                height="172"
              />
            </div>
            <p>
              <strong>TRY A REAL SCAN</strong>
              <span>Spice Route Kitchen · sample menu</span>
            </p>
            <a href={STICKER_DEMO_URL} rel="noopener noreferrer">
              Open the sample menu ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
