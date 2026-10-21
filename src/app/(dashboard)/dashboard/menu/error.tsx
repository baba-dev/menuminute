"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function MenuStudioError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      className="product studio-atelier atelier-route-error"
      role="alert"
      aria-labelledby="studio-error-title"
    >
      <span className="atelier-eyebrow">YOUR WORKSPACE</span>
      <h1 id="studio-error-title">We couldn’t load Menu Studio.</h1>
      <p>
        Your saved and published menus have not been changed by this loading error. Try opening the
        workspace again.
      </p>
      <div className="row">
        <button type="button" className="ember" onClick={reset}>
          <RotateCcw size={16} aria-hidden="true" /> Try again
        </button>
        <Link className="action" href="/dashboard">
          Return to overview
        </Link>
      </div>
    </section>
  );
}
