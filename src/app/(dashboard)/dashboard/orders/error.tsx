"use client";
import "@/components/orders/service-counter.css";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <div className="service-counter sc-no-outlet" role="alert">
    <span className="sc-eyebrow">SERVICE COUNTER</span><h1>Could not load orders.</h1>
    <p>Your previous order state has not been modified. Retry the authorized workspace request.</p>
    <button className="sc-primary" type="button" onClick={reset}>Retry</button>
  </div>;
}
