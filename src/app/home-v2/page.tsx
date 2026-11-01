import type { Metadata } from "next";
import Link from "next/link";
import { HomeNav } from "@/components/marketing/navigation/home-nav";
import { DashboardBuild } from "@/components/marketing/dashboard-build/dashboard-build";
import { ScanToOrder } from "@/components/marketing/scan-to-order/scan-to-order";
import { STICKER_DEMO_URL } from "@/components/marketing/storefront-studio/sticker-config";
import QRCode from "qrcode";
import "../home-layout.css";

// Work in progress: not indexed and not in the sitemap until the page is approved.
export const metadata: Metadata = {
  title: "MenuMinute — Home v2 (preview)",
  robots: { index: false, follow: false },
};

export default async function HomeV2Page() {
  const qrDataUrl = await QRCode.toDataURL(STICKER_DEMO_URL, {
    type: "image/png",
    errorCorrectionLevel: "H",
    margin: 1,
    scale: 8,
    color: { dark: "#101820", light: "#ffffff" },
  });
  return (
    <div className="mm-homepage mm-homepage-v2">
      <div className="db-nav">
        <HomeNav />
      </div>
      <main>
        <DashboardBuild />
        <ScanToOrder qrDataUrl={qrDataUrl} />
        <section className="db-cta" aria-labelledby="db-cta-title">
          <h2 id="db-cta-title">See it for yourself</h2>
          <p>
            Everything above is a sample outlet. Explore the public demo, or compare plans to see
            which areas your outlet would get.
          </p>
          <div className="db-cta__actions">
            <Link href="/demo" className="db-cta__primary">
              Try the live demo
            </Link>
            <Link href="/pricing" className="db-cta__secondary">
              See plans
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
