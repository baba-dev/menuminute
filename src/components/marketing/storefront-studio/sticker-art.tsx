import type { StickerFormat } from "./sticker-config";

function BrandMark() {
  return (
    <span className="ss-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" focusable="false" aria-hidden="true">
        <path d="M7 10q8-2 13 4q5-6 13-4v19q-8-1-13 4q-5-5-13-4z" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" />
        <path d="M20 14v19M11 16l5 2m-5 3 5 2m-5 3 5 2" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <circle cx="27" cy="22" r="5" fill="white" /><path d="M27 19v3l-2 2" stroke="#F3490B" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`ss-brand ${small ? "ss-brand--small" : ""}`}>
      <BrandMark />
      <span className="ss-brand-copy"><strong>Menu<b>Minute</b></strong><small>by BabaBuilds</small></span>
    </span>
  );
}
function Code({ qrDataUrl, mini = false }: { qrDataUrl: string; mini?: boolean }) {
  return (
    <span className={`ss-code ${mini ? "ss-code--mini" : ""}`}>
      {/* Existing QR library produced these pixels on the server for the canonical public demo URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="" width="220" height="220" decoding="async" />
    </span>
  );
}

/** Print-like, inline design artwork; this is a sample catalogue, not a print/download service. */
export function StickerArt({
  design,
  qrDataUrl,
  thumbnail = false,
}: {
  design: StickerFormat;
  qrDataUrl: string;
  thumbnail?: boolean;
}) {
  return (
    <div className={`ss-sticker ss-sticker--${design} ${thumbnail ? "ss-sticker--thumb" : ""}`} aria-hidden={thumbnail || undefined}>
      {design === "primary" && (
        <><Brand /><Code qrDataUrl={qrDataUrl} /><span className="ss-sticker-footer">▯ &nbsp; Scan to see the menu</span></>
      )}
      {design === "circular" && (
        <><span className="ss-circle-top">SCAN ME</span><Code qrDataUrl={qrDataUrl} /><span className="ss-circle-bottom">MenuMinute</span></>
      )}
      {design === "cling" && (
        <><Brand /><Code qrDataUrl={qrDataUrl} /><span className="ss-cling-copy">BROWSE OUR MENU</span><span className="ss-cling-bottom">SCAN FOR MENU ↗</span></>
      )}
      {design === "premium" && (
        <><div className="ss-premium-copy"><Brand small /><strong>View<br />Menu<br /><em>Here.</em></strong><small>No app. Just scan.</small></div><Code qrDataUrl={qrDataUrl} /></>
      )}
      {design === "hours" && (
        <><Brand small /><div className="ss-hours-body"><strong>EXAMPLE HOURS</strong>{["MON  9–9", "TUE  9–9", "WED  9–9", "THU  9–9", "FRI  9–10", "SAT  9–10", "SUN  9–9"].map((line) => <span key={line}>{line}</span>)}</div><div className="ss-hours-foot"><Code qrDataUrl={qrDataUrl} mini /><b>Scan to<br />see the menu</b></div></>
      )}
      {design === "compact" && (
        <><Brand small /><Code qrDataUrl={qrDataUrl} /><span className="ss-sticker-footer">SCAN MENU</span></>
      )}
    </div>
  );
}
