"use client";
import Link from "next/link";
import "./kitchen.css";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <main className="product mm-kitchen"><section className="kk-hero"><div className="kk-hero-content" role="alert">
    <span className="kk-eyebrow">KITCHEN PRO</span><h1>Kitchen workspace unavailable.</h1>
    <p>We could not load your authorized station view. No ticket status has been changed.</p>
    <div className="kk-hero-actions"><button type="button" className="kk-hero-primary" onClick={reset}>Retry</button>
      <Link className="kk-hero-outline" href="/dashboard/orders">Return to orders</Link></div>
  </div></section></main>;
}
