import type { Metadata } from "next";
import Link from "next/link";
import { StatusPage } from "@/components/ui/status-page";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <StatusPage
      eyebrow="404 / Off the menu"
      title="We couldn’t find that page."
      description="The link may be out of date, or the page may have moved. If you scanned a QR code, ask the restaurant for a fresh one."
    >
      <Link href="/" className="mm-action mm-action--flow">
        Back to homepage
      </Link>
      <Link href="/help" className="mm-action mm-action--quiet">
        Visit Help Center
      </Link>
    </StatusPage>
  );
}
