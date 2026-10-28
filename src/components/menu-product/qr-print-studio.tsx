"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  Download,
  FileImage,
  LayoutTemplate,
  Palette,
  Printer,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Square,
  TriangleAlert,
} from "lucide-react";
import type { QR } from "./qr-studio-types";
import {
  DEFAULT_PRINT_DESIGN,
  normalizePrintCopy,
  printableQr,
  PRINT_FORMATS,
} from "./qr-print-contract";
import type { PrintDesign, PrintFormat } from "./qr-print-contract";
import { PRINT_THEMES } from "./qr-print-themes";
import { PRINT_FONTS } from "./qr-print-fonts";
import { QR_INK_PRESETS, qrInkContrast, safeQrInk } from "@/modules/qr/ink";
import { QrPrintSheet } from "./qr-print-sheet";
import styles from "./qr-print-studio.module.css";

const formats = ["stand", "sticker", "insert"] as const;
export function QrPrintStudio({
  codes,
  selectedId,
  onSelect,
  onBack,
  restaurant,
  outletId,
  origin,
}: {
  codes: QR[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  restaurant: string;
  outletId: string;
  origin: string;
}) {
  const selected = printableQr(codes, selectedId);
  const [format, setFormat] = useState<PrintFormat>("stand");
  const [design, setDesign] = useState<PrintDesign>(DEFAULT_PRINT_DESIGN);
  const [customInk, setCustomInk] = useState(DEFAULT_PRINT_DESIGN.ink);
  const [matrixReady, setMatrixReady] = useState<string | null>(null);
  const [proof, setProof] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printTarget, setPrintTarget] = useState(false);
  const [error, setError] = useState("");
  const printingRef = useRef(false);
  const previewRef = useRef<HTMLElement>(null);

  const selectedKey = selected ? selected.id + ":" + design.ink : "";
  const imageReady = Boolean(selected && matrixReady === selectedKey);
  useEffect(() => {
    const resetPrint = () => {
      setPrintTarget(false);
      printingRef.current = false;
      setPrinting(false);
    };
    window.addEventListener("afterprint", resetPrint);
    return () => window.removeEventListener("afterprint", resetPrint);
  }, []);
  function invalidateProof() {
    setProof(false);
    setError("");
  }

  function updateDesign(patch: Partial<PrintDesign>) {
    if (patch.ink !== undefined) setMatrixReady(null);
    setDesign((current) => ({ ...current, ...patch }));
    invalidateProof();
  }
  function updateInk(next: string) {
    setCustomInk(next);
    if (safeQrInk(next)) updateDesign({ ink: next.toUpperCase() });
  }
  function resetDesign() {
    setCustomInk(DEFAULT_PRINT_DESIGN.ink);
    setMatrixReady(null);
    setDesign(DEFAULT_PRINT_DESIGN);
    invalidateProof();
  }
  async function printDesign() {
    if (!selected || !imageReady || !proof || printingRef.current) return;
    printingRef.current = true;
    setPrinting(true);
    setError("");
    try {
      // The active-code endpoint rechecks membership, outlet scope and revocation at export time.
      const endpoint =
        "/api/qr/" +
        encodeURIComponent(selected.id) +
        "/download?format=svg&inline=1&ink=" +
        encodeURIComponent(design.ink);
      const response = await fetch(endpoint, {
        headers: { "x-outlet-id": outletId },
        cache: "no-store",
      });
      if (!response.ok || !(response.headers.get("content-type") ?? "").includes("image/svg+xml")) {
        throw new Error("This QR is no longer available for printing. Refresh your QR library.");
      }
      const image = previewRef.current?.querySelector<HTMLImageElement>("[data-real-qr-matrix]");
      if (!image || !image.complete || image.naturalWidth === 0) {
        throw new Error("The QR image has not loaded. Check your connection and try again.");
      }
      await image.decode();
      await document.fonts.ready;
      flushSync(() => setPrintTarget(true));
      window.print(); // Browser Print supports physical printers and 'Save as PDF' without a third-party provider.
    } catch (cause) {
      setPrintTarget(false);
      setError(
        cause instanceof Error ? cause.message : "Could not prepare this design for printing."
      );
    } finally {
      printingRef.current = false;
      setPrinting(false);
    }
  }

  return (
    <section
      className={styles.studio}
      aria-labelledby="atelier-heading"
      data-testid="qr-print-atelier"
    >
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className="qr-eyebrow">THE PRINT ATELIER / MENUMINUTE</span>
          <h2 id="atelier-heading">Make every table an invitation.</h2>
          <p>
            Choose a physical format, tailor the welcome and prepare a real scannable QR for your
            guests.
          </p>
          <button type="button" className={styles.back} onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to QR Library
          </button>
        </div>
        <Image
          src="/brand/qr-studio/tabletop-press/print-studio-illustration.webp"
          alt=""
          width={310}
          height={233}
          className={styles.heroArt}
          priority={false}
        />
      </div>
      {!selected ? (
        <div className={styles.noCode} role="status">
          <QrCode size={42} aria-hidden="true" />
          <h3>Create an active QR to begin.</h3>
          <p>
            Only active, outlet-authorized permanent destinations can be included in printed
            materials.
          </p>
          <button type="button" className="ember" onClick={onBack}>
            Open QR Library
          </button>
        </div>
      ) : (
        <>
          <div className={styles.flowHeading}>
            <div>
              <span className="qr-eyebrow">01 / CHOOSE YOUR FORMAT</span>
              <h3>What are we making?</h3>
            </div>
            <span>Three thoughtfully composed physical formats</span>
          </div>
          <div className={styles.formatGrid} role="group" aria-label="Physical print format">
            {formats.map((id) => {
              const item = PRINT_FORMATS[id];
              const Icon = id === "stand" ? LayoutTemplate : id === "sticker" ? Square : BookOpen;
              return (
                <button
                  key={id}
                  type="button"
                  className={styles.formatCard}
                  aria-pressed={format === id}
                  onClick={() => {
                    setFormat(id);
                    invalidateProof();
                  }}
                >
                  <span className={styles.formatIcon}>
                    <Icon size={27} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                    <em>
                      {item.widthMm} × {item.heightMm} mm
                    </em>
                  </span>
                  <span className={styles.formatCheck}>
                    {format === id ? <CheckCircle2 size={21} aria-label="Selected" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
          <div className={styles.flowHeading}>
            <div>
              <span className="qr-eyebrow">02 / MAKE IT YOURS</span>
              <h3>The design workbench.</h3>
            </div>
            <span>True QR. True proportions. Your restaurant.</span>
          </div>
          <div className={styles.workbench}>
            <section
              className={styles.previewPane}
              aria-labelledby="print-preview-heading"
              ref={previewRef}
            >
              <div className={styles.paneHeader}>
                <div>
                  <span className="qr-eyebrow">LIVE PROOF</span>
                  <h4 id="print-preview-heading">{PRINT_FORMATS[format].name}</h4>
                </div>
                <span>
                  {PRINT_FORMATS[format].widthMm} × {PRINT_FORMATS[format].heightMm} mm
                </span>
              </div>
              <div className={styles.stage}>
                <QrPrintSheet
                  key={selectedKey}
                  qr={selected}
                  format={format}
                  restaurant={restaurant}
                  origin={origin}
                  design={design}
                  active={printTarget}
                  onMatrixReady={() => setMatrixReady(selectedKey)}
                  onMatrixError={() => {
                    setMatrixReady(null);
                    setError(
                      "The real QR image could not load. Refresh the studio before printing."
                    );
                  }}
                />
              </div>
              <p className={styles.previewHint}>
                <ShieldCheck size={16} aria-hidden="true" /> The QR matrix is generated by
                MenuMinute&apos;s authenticated endpoint, never the decorative artwork.
              </p>
            </section>
            <section className={styles.inspector} aria-label="Print design controls">
              <div className={styles.paneHeader}>
                <div>
                  <span className="qr-eyebrow">DESIGN DETAILS</span>
                  <h4>Personalize your print.</h4>
                </div>
                <Palette size={21} aria-hidden="true" />
              </div>
              <label className={styles.field}>
                Permanent QR
                <select
                  value={selected.id}
                  onChange={(event) => {
                    setMatrixReady(null);
                    invalidateProof();
                    onSelect(event.target.value);
                  }}
                  aria-label="Choose permanent QR"
                >
                  {codes
                    .filter((q) => q.isActive)
                    .map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.label ?? "Menu QR"}
                        {q.pointLabel ? " · " + q.pointLabel : ""}
                      </option>
                    ))}
                </select>
              </label>
              <fieldset className={styles.paletteField}>
                <legend>
                  Choose a design theme <small>· Nine distinctive looks</small>
                </legend>
                <div className={styles.themeGallery}>
                  {PRINT_THEMES.map((theme) => (
                    <button
                      type="button"
                      key={theme.id}
                      className={styles.themeCard}
                      aria-pressed={design.palette === theme.id}
                      onClick={() => updateDesign({ palette: theme.id })}
                    >
                      <span
                        className={styles.themeSample}
                        data-theme-preview={theme.id}
                        style={
                          {
                            "--theme-paper": theme.paper,
                            "--theme-accent": theme.accent,
                          } as React.CSSProperties
                        }
                        aria-hidden="true"
                      >
                        <span>✦ MENUMINUTE ✦</span>
                        <QrCode size={35} strokeWidth={1.8} />
                        <span>SCAN THE MENU</span>
                      </span>
                      <span className={styles.themeName}>{theme.name}</span>
                      <small>{theme.description}</small>
                      {design.palette === theme.id && (
                        <CheckCircle2
                          className={styles.themeCheck}
                          size={18}
                          aria-label="Selected"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className={styles.paletteField}>
                <legend>
                  Typography <small>· Five expressive fonts</small>
                </legend>
                <div className={styles.fontGallery}>
                  {PRINT_FONTS.map((font) => (
                    <button
                      type="button"
                      className={styles.fontCard}
                      key={font.id}
                      data-font-preview={font.id}
                      aria-pressed={design.font === font.id}
                      onClick={() => updateDesign({ font: font.id })}
                    >
                      <span className={styles.fontSample}>Aa</span>
                      <span>
                        <strong>{font.name}</strong>
                        <small>{font.description}</small>
                      </span>
                      {design.font === font.id && <CheckCircle2 size={16} aria-label="Selected" />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className={styles.paletteField}>
                <legend>
                  QR ink colour <small>· Protected scan contrast</small>
                </legend>
                <div className={styles.inkSwatches}>
                  {QR_INK_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.name}
                      title={preset.name}
                      aria-label={"Use " + preset.name + " QR ink"}
                      aria-pressed={design.ink === preset.hex}
                      className={styles.inkButton}
                      style={{ "--ink-swatch": preset.hex } as React.CSSProperties}
                      onClick={() => {
                        setCustomInk(preset.hex);
                        updateDesign({ ink: preset.hex });
                      }}
                    >
                      {design.ink === preset.hex && <CheckCircle2 size={19} aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                <div className={styles.inkCustom}>
                  <label htmlFor="qr-ink-picker">
                    Pick a colour
                    <input
                      id="qr-ink-picker"
                      type="color"
                      value={safeQrInk(customInk) ? customInk : design.ink}
                      onChange={(event) => updateInk(event.target.value)}
                    />
                  </label>
                  <label htmlFor="qr-ink-hex">
                    HEX
                    <input
                      id="qr-ink-hex"
                      type="text"
                      maxLength={7}
                      spellCheck={false}
                      value={customInk}
                      onChange={(event) => updateInk(event.target.value)}
                      aria-describedby="qr-ink-contrast"
                    />
                  </label>
                </div>
                <p className={styles.inkNotice} id="qr-ink-contrast" role="status">
                  {safeQrInk(customInk)
                    ? "Scan-safe on white · " + qrInkContrast(customInk).toFixed(1) + ":1 contrast"
                    : "Too light or invalid. The previous safe colour remains selected."}
                </p>
                <p className={styles.inkHint}>
                  The QR is rendered server-side on solid white with its four-module quiet zone.
                  Decorative effects never overlap the matrix.
                </p>
              </fieldset>
              <label className={styles.field}>
                Guest invitation
                <input
                  maxLength={52}
                  value={design.invitation}
                  onChange={(event) => updateDesign({ invitation: event.target.value })}
                  onBlur={() =>
                    updateDesign({ invitation: normalizePrintCopy(design.invitation, 52) })
                  }
                  placeholder="Scan to explore our menu"
                />
                <small>Keep it short and welcoming. Up to 52 characters.</small>
              </label>
              <label className={styles.field}>
                Supporting line
                <input
                  maxLength={72}
                  value={design.supportingCopy}
                  onChange={(event) => updateDesign({ supportingCopy: event.target.value })}
                  onBlur={() =>
                    updateDesign({ supportingCopy: normalizePrintCopy(design.supportingCopy, 72) })
                  }
                  placeholder="Fresh choices, always up to date."
                />
              </label>
              <div className={styles.toggleGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={design.showUrl}
                    onChange={(event) => updateDesign({ showUrl: event.target.checked })}
                  />{" "}
                  Include permanent fallback URL
                </label>
              </div>
              <div className={styles.help}>
                <CircleHelp size={17} aria-hidden="true" />
                <p>
                  MenuMinute branding is included on every print. Restaurant and service-point
                  identity come from your selected outlet; appearance never changes a QR token.
                </p>
              </div>
              <button type="button" className={styles.resetDesign} onClick={resetDesign}>
                Restore design defaults
              </button>
            </section>
          </div>
          <section className={styles.export} aria-labelledby="print-export-heading">
            <div className={styles.exportIntro}>
              <span className="qr-eyebrow">03 / PROOF & PRODUCE</span>
              <h3 id="print-export-heading">Your finished invitation.</h3>
              <p>
                {PRINT_FORMATS[format].guidance} Choose <strong>Actual size / 100%</strong> in the
                printer dialogue. For a PDF select <strong>Save as PDF</strong> as the destination.
              </p>
              <div className={styles.readiness}>
                <span>
                  {imageReady ? <CheckCircle2 size={16} /> : <RefreshCw size={16} />}
                  {imageReady ? "Real QR loaded" : "Loading real QR"}
                </span>
                <span>
                  <CheckCircle2 size={16} /> Quiet zone protected
                </span>
                <span>
                  <CheckCircle2 size={16} /> Physical size defined
                </span>
              </div>
              <label className={styles.proof}>
                <input
                  type="checkbox"
                  checked={proof}
                  onChange={(e) => setProof(e.target.checked)}
                />{" "}
                I reviewed the restaurant, table label and destination, and will scan a physical
                proof before distributing.
              </label>
              {error && (
                <p className={styles.error} role="alert">
                  <TriangleAlert size={17} aria-hidden="true" />
                  {error}
                </p>
              )}
            </div>
            <div className={styles.exportActions}>
              <button
                type="button"
                className="ember"
                disabled={!proof || !imageReady || printing || !design.invitation.trim()}
                onClick={() => void printDesign()}
              >
                <Printer size={17} aria-hidden="true" /> Print / Save as PDF
              </button>
              <a href={"/api/qr/" + encodeURIComponent(selected.id) + "/download?format=svg"}>
                <FileImage size={16} aria-hidden="true" /> Raw SVG
              </a>
              <a href={"/api/qr/" + encodeURIComponent(selected.id) + "/download"}>
                <Download size={16} aria-hidden="true" /> Raw PNG
              </a>
              <small>
                Printed design and raw QR downloads are separate. Your original QR URL remains
                unchanged.
              </small>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
