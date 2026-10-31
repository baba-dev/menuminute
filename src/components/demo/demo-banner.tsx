"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import "./demo-banner.css";

const INTERVAL_MS = 30 * 60 * 1000;
const next = (now: number) => (Math.floor(now / INTERVAL_MS) + 1) * INTERVAL_MS;
function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Slim banner for the shared public demo. The reset happens on :00 and :30 (UTC, same in IST), so the
 * countdown needs no server call. Purely informational: it never gates anything.
 */
export function DemoBanner() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Start from callbacks (not the effect body) so server and first client render match.
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  const remaining = now === null ? null : next(now) - now;
  // The worker runs the reset within moments of the boundary; invite a refresh once it is due.
  const justReset = remaining !== null && INTERVAL_MS - remaining < 45_000 && now !== null;
  return (
    <div
      role="region"
      aria-label="Public demo notice"
      className="mm-demo-banner"
      data-testid="demo-banner"
    >
      <span className="mm-demo-banner-pill">Public demo</span>
      <span className="mm-demo-banner-text">
        Shared by all visitors. Sample data resets every 30 minutes
        {remaining !== null && !justReset ? (
          <>
            {" "}
            · next reset in{" "}
            <time className="mm-demo-banner-time" suppressHydrationWarning>
              {format(remaining)}
            </time>
          </>
        ) : null}
        {justReset ? " · just reset" : null}.
      </span>
      {justReset ? (
        <button
          type="button"
          className="mm-demo-banner-button"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={13} aria-hidden="true" /> Refresh
        </button>
      ) : null}
    </div>
  );
}
