"use client";

import Link from "next/link";
import { StatusPage } from "@/components/ui/status-page";

/** Last-resort boundary for routes without their own. Never renders error details. */
export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StatusPage
      role="alert"
      eyebrow="Something went wrong"
      title="This page didn’t load."
      description="It’s a problem on our side, and nothing you saved has been changed. Try again in a moment."
    >
      <button type="button" className="mm-action mm-action--flow" onClick={reset}>
        Try again
      </button>
      <Link href="/" className="mm-action mm-action--quiet">
        Back to homepage
      </Link>
    </StatusPage>
  );
}
