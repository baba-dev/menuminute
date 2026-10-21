"use client";

import Image from "next/image";
import type { PrintFormat, QR } from "./qr-studio-types";
import { qrDestination } from "./qr-studio-types";
import styles from "./qr-print.module.css";

const names: Record<PrintFormat, string> = {
  stand: "Table Stand",
  sticker: "Window / Counter Sticker",
  insert: "Menu Insert",
};

export function QrPrintSheet({
  qr,
  format,
  restaurant,
  origin,
  active,
}: {
  qr: QR;
  format: PrintFormat;
  restaurant: string;
  origin: string;
  active: boolean;
}) {
  if (!qr.isActive) return null;
  const url = qrDestination(origin, qr.destinationToken);
  return (
    <div className={styles.printCanvas} data-print-ready={active ? "true" : "false"} aria-label={names[format] + " print preview"}>
      <article className={styles.sheet} data-format={format}>
        <div className={styles.brand}>
          <Image src="/brand/qr/centre-mark-circle.svg" alt="" width={36} height={36} />
          <span>MenuMinute · by BabaBuilds</span>
        </div>
        <span className={styles.eyebrow}>WELCOME TO OUR TABLE</span>
        <h3>{restaurant}</h3>
        {qr.tableId && <p className={styles.point}>{qr.label ?? "Your table"}</p>}
        {/* This is the exact authenticated, server-generated QR matrix, never the decorative artwork. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.matrix}
          src={`/api/qr/${encodeURIComponent(qr.id)}/download?format=svg&inline=1`}
          width={300}
          height={300}
          alt={`Scan to open ${restaurant}'s permanent menu`}
        />
        <strong>Scan to explore our menu</strong>
        <p className={styles.note}>Your menu, always up to date.</p>
        <code className={styles.url}>{url}</code>
        <span className={styles.paperFooter}>PRINT ONCE. KEEP SERVING.</span>
      </article>
      <p className={styles.printTip}>Preview: {names[format]}. Use actual size in your browser print dialogue; scan a proof before distributing.</p>
    </div>
  );
}
