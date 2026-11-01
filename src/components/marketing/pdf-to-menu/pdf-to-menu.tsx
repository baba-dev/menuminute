"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowRight, Check, FileText, RotateCcw, ScanLine, Upload } from "lucide-react";
import { RollingNumber } from "../rolling-number/rolling-number";
import { formatInr } from "../scan-to-order/scan-to-order-fixture";
import { spotlightVars } from "../scan-to-order/scan-to-order-motion";
import { useSectionMotion } from "../shared/use-section-motion";
import {
  IMPORT_CARDS,
  IMPORT_NOTE,
  SOURCE_LINES,
  SOURCE_SUBTITLE,
  SOURCE_TITLE,
} from "./pdf-to-menu-fixture";
import {
  blockers,
  canConfirm,
  canPublish,
  confirmedCount,
  publish,
  seedRows,
  setPrice,
  statusOf,
  stepOf,
  toggleConfirm,
  type ImportRow,
  type Phase,
} from "./pdf-to-menu-logic";
import "./pdf-to-menu.css";

const SCAN_MS = 2600;
const AUTOSTART_MS = 1600;
const STEPS = ["Upload", "Review", "Publish"] as const;

export function PdfToMenu({ qrDataUrl }: { qrDataUrl: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const started = useRef(false);
  const { ready, reduced, visible } = useSectionMotion(rootRef);

  const [phase, setPhase] = useState<Phase>("idle");
  const [rows, setRows] = useState<ImportRow[]>(seedRows);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const step = stepOf(phase);
  const done = confirmedCount(rows);
  const open = blockers(rows);
  const locked = phase === "published";

  const start = () => {
    started.current = true;
    setPhase(reduced ? "review" : "scanning");
    setAnnouncement("Sample PDF uploaded. Reading the menu.");
  };

  // The upload plays by itself once the section is seen; the button works at any time.
  useEffect(() => {
    if (!ready || !visible || phase !== "idle" || started.current) return;
    const timer = window.setTimeout(
      () => {
        started.current = true;
        setPhase(reduced ? "review" : "scanning");
      },
      reduced ? 0 : AUTOSTART_MS
    );
    return () => window.clearTimeout(timer);
  }, [ready, visible, phase, reduced]);

  useEffect(() => {
    if (phase !== "scanning") return;
    const timer = window.setTimeout(() => {
      setPhase("review");
      setAnnouncement("Menu read. Review each dish against the source.");
    }, SCAN_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const publishNow = () => {
    if (!canPublish(rows)) return;
    setPhase((current) => publish(current, rows));
    setActiveLine(null);
    setAnnouncement("Menu published. Your QR code is live.");
  };

  const reset = () => {
    started.current = true; // do not auto-run again after a manual reset
    setRows(seedRows());
    setActiveLine(null);
    setPhase("idle");
    setAnnouncement("Preview reset.");
  };

  const onCardMove = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const { mx, my } = spotlightVars(
      { x: event.clientX, y: event.clientY },
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    );
    event.currentTarget.style.setProperty("--mx", mx);
    event.currentTarget.style.setProperty("--my", my);
  };

  return (
    <section
      ref={rootRef}
      className="pm"
      aria-labelledby="pm-heading"
      data-testid="pdf-to-menu"
      data-ready={ready}
      data-paused={!visible}
      data-phase={phase}
    >
      <div className="pm-container">
        <header className="pm-intro" data-reveal>
          <span className="pm-eyebrow">04 / FROM PDF TO LIVE MENU</span>
          <span className="pm-badge">SAMPLE MENU · SCRIPTED PREVIEW · NO FILE UPLOADED</span>
          <h2 id="pm-heading">
            {["Upload.", "Review.", "Live."].map((word, index) => (
              <span className="pm-word" key={word} style={{ "--i": index } as CSSProperties}>
                {word}
              </span>
            ))}
          </h2>
          <p className="pm-lead">
            Turn the menu you already have into a live QR menu. The scanner drafts it; you approve
            every dish before anything goes public.
          </p>
        </header>

        <ol className="pm-steps" aria-label="Import steps" data-reveal>
          {STEPS.map((label, index) => (
            <li
              key={label}
              data-state={index + 1 < step ? "done" : index + 1 === step ? "current" : "todo"}
              aria-current={index + 1 === step ? "step" : undefined}
            >
              <span aria-hidden="true">{index + 1 < step ? <Check size={14} /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <div className="pm-grid">
          {/* Source: a printed menu. The scanner reads it line by line. */}
          <div className="pm-source" data-reveal>
            <span className="pm-beam" aria-hidden="true" />
            <div className="pm-file">
              <FileText size={16} aria-hidden="true" />
              <span>{SOURCE_SUBTITLE}</span>
            </div>
            <div className="pm-paper" aria-label="Sample printed menu">
              <h3>{SOURCE_TITLE}</h3>
              <div className="pm-lines">
                <ul>
                  {SOURCE_LINES.map((line, index) => (
                    <li
                      key={line.name}
                      className="pm-line"
                      data-read={phase === "review" || phase === "published"}
                      style={{ "--l": index } as CSSProperties}
                    >
                      <span>{line.name}</span>
                      <i aria-hidden="true" />
                      <b data-smudged={Boolean(line.smudged)} data-unclear={Boolean(line.unclear)}>
                        {line.price}
                      </b>
                    </li>
                  ))}
                </ul>
                {phase === "scanning" && <span className="pm-laser" aria-hidden="true" />}
                {activeLine !== null && !locked && (
                  <span
                    className="pm-hit"
                    aria-hidden="true"
                    style={{ "--l": activeLine } as CSSProperties}
                  />
                )}
              </div>
            </div>
            {phase === "idle" && (
              <button type="button" className="pm-shimmer" onClick={start}>
                <Upload size={15} aria-hidden="true" /> Upload the sample PDF
              </button>
            )}
            {phase === "scanning" && (
              <p className="pm-status">
                <ScanLine size={15} aria-hidden="true" /> Reading the menu…
              </p>
            )}
            {(phase === "review" || phase === "published") && (
              <p className="pm-status">Hover or focus a dish to see where it was read.</p>
            )}
          </div>

          {/* Review: the owner confirms every dish against the source. */}
          <div className="pm-review" data-reveal>
            <div className="pm-review__head">
              <h3>Review the draft</h3>
              <span className="pm-count">
                <RollingNumber text={String(done)} /> of {rows.length} confirmed
              </span>
            </div>
            <div
              className="pm-progress"
              style={{ "--p": rows.length ? done / rows.length : 0 } as CSSProperties}
              aria-hidden="true"
            />
            {phase === "idle" || phase === "scanning" ? (
              <p className="pm-empty">
                {phase === "idle"
                  ? "Upload the sample PDF to see the draft."
                  : "The draft appears when the scan finishes."}
              </p>
            ) : (
              <ol className="pm-rows" aria-label="Imported dishes">
                {rows.map((item, index) => {
                  const status = statusOf(item);
                  const editable = item.flag !== "unreviewed";
                  return (
                    <li
                      key={item.id}
                      className="pm-row"
                      data-tone={status.tone}
                      style={{ "--i": index } as CSSProperties}
                      onPointerEnter={() => setActiveLine(item.line)}
                      onPointerLeave={() => setActiveLine(null)}
                      onFocus={() => setActiveLine(item.line)}
                      onBlur={() => setActiveLine(null)}
                    >
                      <div className="pm-row__main">
                        <strong>{item.name}</strong>
                        <span className="pm-chip" data-tone={status.tone}>
                          {status.label}
                        </span>
                      </div>
                      <div className="pm-row__price">
                        {editable && !locked ? (
                          <label>
                            <span className="pm-sr">Price in rupees for {item.name}</span>
                            <span aria-hidden="true">₹</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              placeholder="Enter"
                              value={item.price === null ? "" : String(item.price)}
                              onChange={(event) =>
                                setRows((current) =>
                                  setPrice(
                                    current,
                                    item.id,
                                    event.target.value.replace(/\D/g, "").slice(0, 5)
                                  )
                                )
                              }
                            />
                          </label>
                        ) : (
                          <span>{item.price === null ? "—" : formatInr(item.price * 100)}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="pm-confirm"
                        aria-pressed={item.confirmed}
                        disabled={locked || !canConfirm(item)}
                        aria-label={`${item.confirmed ? "Unconfirm" : "Confirm"} ${item.name}`}
                        onClick={() => setRows((current) => toggleConfirm(current, item.id))}
                      >
                        {item.confirmed ? (
                          <>
                            <Check size={14} aria-hidden="true" /> Confirmed
                          </>
                        ) : (
                          "Confirm"
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            {(phase === "review" || phase === "published") && (
              <div className="pm-publish">
                <button
                  type="button"
                  className="pm-shimmer"
                  onClick={publishNow}
                  disabled={locked || !canPublish(rows)}
                  aria-describedby="pm-blockers"
                >
                  {locked ? (
                    <>
                      <Check size={15} aria-hidden="true" /> Published
                    </>
                  ) : (
                    "Publish menu"
                  )}
                </button>
                <p id="pm-blockers">
                  {locked
                    ? "You published this menu. The scanner never does."
                    : open.length
                      ? open.join(" ")
                      : "Every dish is confirmed. Ready to publish."}
                </p>
              </div>
            )}
            {phase !== "idle" && (
              <button type="button" className="pm-ghost" onClick={reset}>
                <RotateCcw size={14} aria-hidden="true" /> Reset the preview
              </button>
            )}
          </div>

          {/* Live: appears only after the owner publishes. */}
          <aside
            className="pm-live"
            data-on={locked}
            aria-label="Published menu preview"
            data-reveal
          >
            {locked ? (
              <>
                <span className="pm-beam" aria-hidden="true" />
                <div className="pm-live__head">
                  <strong>{SOURCE_TITLE}</strong>
                  <span className="pm-pill">Live</span>
                </div>
                <ul>
                  {rows.map((item, index) => (
                    <li key={item.id} style={{ "--i": index } as CSSProperties}>
                      <span>{item.name}</span>
                      <b>{item.price === null ? "—" : formatInr(item.price * 100)}</b>
                    </li>
                  ))}
                </ul>
                <div className="pm-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL, server generated */}
                  <img src={qrDataUrl} alt="QR code to the sample menu" width={112} height={112} />
                  <p>Guests scan this permanent QR. Edit prices later and it stays the same.</p>
                </div>
              </>
            ) : (
              <p className="pm-empty">
                Your live menu and QR code appear here after you confirm every dish and publish.
              </p>
            )}
          </aside>
        </div>

        <div className="pm-cards">
          {IMPORT_CARDS.map((card) => (
            <article className="pm-card" key={card.title} data-reveal onPointerMove={onCardMove}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <Link href={card.href}>
                {card.cta} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>

        <p className="pm-note">{IMPORT_NOTE}</p>
        <div className="pm-sr" role="status" aria-live="polite">
          {announcement}
        </div>
      </div>
    </section>
  );
}
