"use client";

import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export default function LoginError({ reset }: { reset: () => void }) {
  return (
    <AuthShell
      eyebrow="CONNECTION / RECOVERY"
      title="We can't check your session right now."
      description="A temporary service problem does not mean your account was signed out. Please retry."
      extra={<Link href="/">Return to homepage</Link>}
    >
      <button className="mm-auth-submit" type="button" onClick={reset}>
        Retry session check
      </button>
    </AuthShell>
  );
}
