"use client";

import Image from "next/image";
import type { QR } from "./qr-studio-types";
import { qrDestination } from "./qr-studio-types";
import { PRINT_FORMATS } from "./qr-print-contract";
import type { PrintDesign, PrintFormat } from "./qr-print-contract";
import styles from "./qr-print.module.css";

export function QrPrintSheet({
  qr,
  format,
  restaurant,
  origin,
  design,
  active,
  onMatrixReady,
  onMatrixError,
}: {
  qr: QR;
  format: PrintFormat;
  restaurant: string;
  origin: string;
  design: PrintDesign;
  active: boolean;
  onMatrixReady: () => void;
  onMatrixError: () => void;
}) {
  if (!qr.isActive) return null;
  const url = qrDestination(origin, qr.destinationToken);
  const spec = PRINT_FORMATS[format];
  return (
    <div
      className={styles.printCanvas}
      data-print-ready={active ? "true" : "false"}
      aria-label={spec.name + " print preview"}
    >
      <article
        className={styles.sheet}
        data-format={format}
        data-palette={design.palette}
        style={
          {
            "--sheet-width": spec.widthMm + "mm",
            "--sheet-height": spec.heightMm + "mm",
            "--matrix-size": spec.qrMm + "mm",
          } as React.CSSProperties
        }
      >
        <span className={styles.ornament} aria-hidden="true">
          {format === "stand"
            ? "✦     ✳     ✦"
            : format === "insert"
              ? "✳   THE DAILY TABLE   ✳"
              : "✦"}
        </span>
        <div className={styles.identity}>
          <span className={styles.kicker}>
            {format === "sticker" ? "YOUR MENU IS HERE" : "WELCOME TO OUR TABLE"}
          </span>
          <h3>{restaurant}</h3>
          {qr.tableId && <p className={styles.point}>{qr.pointLabel ?? "Your table"}</p>}
        </div>
        <div className={styles.matrixFrame}>
          {/* Authenticated, outlet-authorized SVG; never use illustration-board QR symbols. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-real-qr-matrix
            className={styles.matrix}
            src={`/api/qr/${encodeURIComponent(qr.id)}/download?format=svg&inline=1`}
            width={300}
            height={300}
            alt={`Real QR opening ${restaurant}'s menu`}
            onLoad={onMatrixReady}
            onError={onMatrixError}
          />
        </div>
        <div className={styles.invitation}>
          <strong>{design.invitation.trim() || "Scan to explore our menu"}</strong>
          {design.supportingCopy.trim() && <p>{design.supportingCopy.trim()}</p>}
        </div>
        {design.showUrl && <p className={styles.fallbackUrl}>{url}</p>}
        <div className={styles.footer}>
          {design.showBrand ? (
            <span className={styles.brand}>
              <Image src="/brand/qr/centre-mark-circle.svg" alt="" width={19} height={19} />{" "}
              MenuMinute · by BabaBuilds
            </span>
          ) : (
            <span className={styles.brand}>PRINT ONCE. KEEP SERVING.</span>
          )}
        </div>
      </article>
      <span className={styles.previewCaption} aria-hidden="true">
        Actual size: {spec.widthMm} × {spec.heightMm} mm · Scan a printed proof
      </span>
    </div>
  );
}
