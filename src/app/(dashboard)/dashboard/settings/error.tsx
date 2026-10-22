"use client";
import "./settings.css";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="product mm-settings os-settings-empty" role="alert">
      <span className="os-eyebrow">OUTLET ATELIER</span>
      <h1>Settings unavailable.</h1>
      <p>No settings have been changed. Retry your authorized workspace request.</p>
      <button className="os-action os-action-primary" type="button" onClick={reset}>
        Retry
      </button>
    </main>
  );
}
