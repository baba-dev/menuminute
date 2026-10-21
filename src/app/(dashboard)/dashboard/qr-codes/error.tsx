"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import "@/components/menu-product/qr-studio.css";

export default function QrStudioError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="product qr-studio qr-route-error" role="alert" aria-labelledby="qr-error-title">
      <span className="qr-eyebrow">THE TABLETOP PRESS</span>
      <h1 id="qr-error-title">We couldn’t load your QR library.</h1>
      <p>This page-loading error has not changed your saved QR destinations. Try loading the workspace again.</p>
      <div className="row">
        <button type="button" className="ember" onClick={reset}><RotateCcw size={16} aria-hidden="true"/> Try again</button>
        <Link className="action" href="/dashboard">Return to overview</Link>
      </div>
    </section>
  );
}
