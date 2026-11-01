import type { Metadata } from "next";
import Link from "next/link";
import { DashboardBuild } from "@/components/marketing/dashboard-build/dashboard-build";

// Work in progress: not indexed and not in the sitemap until the page is approved.
export const metadata: Metadata = {
  title: "MenuMinute — Home v2 (preview)",
  robots: { index: false, follow: false },
};

export default function HomeV2Page() {
  return (
    <main className="mm-homepage-v2">
      <DashboardBuild />
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
  );
}
