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
import type { PrintDesign, PrintFormat, PrintPalette } from "./qr-print-contract";
import { QrPrintSheet } from "./qr-print-sheet";
import styles from "./qr-print-studio.module.css";

const formats = ["stand", "sticker", "insert"] as const;
const palettes: { id: PrintPalette; name: string; description: string }[] = [
  { id: "ember", name: "Classic Ember", description: "Cream and tangerine" },
  { id: "ink", name: "Midnight Ink", description: "Contrast and elegance" },
  { id: "botanical", name: "Botanical", description: "Olive and parchment" },
];

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
  const [matrixReady, setMatrixReady] = useState<string | null>(null);
  const [proof, setProof] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printTarget, setPrintTarget] = useState(false);
  const [error, setError] = useState("");
  const printingRef = useRef(false);
  const previewRef = useRef<HTMLElement>(null);

  const selectedKey = selected ? selected.id : "";
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
    setDesign((current) => ({ ...current, ...patch }));
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
        "/api/qr/" + encodeURIComponent(selected.id) + "/download?format=svg&inline=1";
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
                  key={selected.id}
                  qr={selected}
                  format={format}
                  restaurant={restaurant}
                  origin={origin}
                  design={design}
                  active={printTarget}
                  onMatrixReady={() => setMatrixReady(selected.id)}
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
                <legend>Colour story</legend>
                <div className={styles.paletteChoices}>
                  {palettes.map((palette) => (
                    <button
                      type="button"
                      key={palette.id}
                      className={styles.paletteButton}
                      aria-pressed={design.palette === palette.id}
                      onClick={() => updateDesign({ palette: palette.id })}
                    >
                      <span
                        className={styles.swatch}
                        data-palette={palette.id}
                        aria-hidden="true"
                      />
                      <span>
                        <strong>{palette.name}</strong>
                        <small>{palette.description}</small>
                      </span>
                      {design.palette === palette.id && (
                        <CheckCircle2 size={16} aria-label="Selected" />
                      )}
                    </button>
                  ))}
                </div>
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
                    checked={design.showBrand}
                    onChange={(event) => updateDesign({ showBrand: event.target.checked })}
                  />{" "}
                  Include MenuMinute signature
                </label>
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
                  Restaurant name, service-point identity and QR destination come from the selected
                  outlet; appearance changes never alter the QR token.
                </p>
              </div>
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
