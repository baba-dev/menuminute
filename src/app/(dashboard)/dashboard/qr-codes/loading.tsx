import "@/components/menu-product/qr-studio.css";

export default function QrStudioLoading() {
  return (
    <div className="product qr-studio" role="status" aria-label="Loading QR Studio">
      <span className="sr-only">Loading your QR library…</span>
      <div className="qr-loading-hero" aria-hidden="true"><div/><div/><div/></div>
      <div className="qr-loading-metrics" aria-hidden="true"><div/><div/><div/><div/></div>
    </div>
  );
}
