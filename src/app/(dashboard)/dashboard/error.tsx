"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      className="mm-dashboard mm-dashboard-error product"
      role="alert"
      aria-labelledby="dashboard-error-title"
    >
      <AlertCircle size={30} aria-hidden="true" />
      <h1 id="dashboard-error-title">We couldn’t load your overview.</h1>
      <p>
        Your menu and published QR codes have not been changed. Try loading your workspace again.
      </p>
      <button
        type="button"
        className="mm-dashboard-button mm-dashboard-button--primary"
        onClick={reset}
      >
        <RotateCcw size={17} aria-hidden="true" /> Try again
      </button>
    </section>
  );
}
