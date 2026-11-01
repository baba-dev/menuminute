import type { Metadata } from "next";
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
    </main>
  );
}
