"use client";

import "./tiffin.css";

export default function TiffinError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="tiffin-shell" role="alert">
      <h1>We couldn’t load the tiffin menu.</h1>
      <p className="tiffin-muted">Nothing has been changed. Try loading it again.</p>
      <button type="button" className="tiffin-btn tiffin-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
