import "@/components/orders/service-counter.css";
export default function Loading() {
  return (
    <div className="service-counter" role="status" aria-live="polite">
      <div
        className="sc-hero"
        style={{ display: "grid", alignContent: "center", padding: "clamp(25px,5vw,65px)" }}
      >
        <h1 style={{ fontSize: "clamp(35px,4vw,56px)" }}>Preparing The Service Counter…</h1>
      </div>
      <div className="sc-body">
        <p>Loading your outlet-specific order workspace.</p>
      </div>
    </div>
  );
}
