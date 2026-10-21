"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { clearRememberedAccount, discardPendingLoginPreference } from "@/lib/remembered-account";

export function SwitchAccount({ email, next }: { email: string; next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <AuthShell
      eyebrow="ACCOUNT / SWITCH"
      title="You're already signed in."
      description="Continue with this account, or securely sign out before signing in as somebody else."
      extra={<Link href="/">Back to MenuMinute</Link>}
    >
      <div className="mm-auth-form">
        <div className="mm-auth-remembered">
          <span className="mm-auth-remembered-icon" aria-hidden="true">
            <UserRound size={20} />
          </span>
          <span className="mm-auth-remembered-copy">
            <strong>Current account</strong>
            <small>{email}</small>
          </span>
        </div>
        <Link className="mm-auth-submit mm-auth-continue" href={next || "/dashboard"}>
          Continue <ArrowRight size={18} aria-hidden="true" />
        </Link>
        {error && (
          <p role="alert" className="mm-auth-message mm-auth-message--error">
            {error}
          </p>
        )}
        <button
          type="button"
          className="mm-auth-switch-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const result = await authClient.signOut();
              if (result.error) {
                setError("Unable to switch accounts right now. Try again.");
                return;
              }
              clearRememberedAccount();
              discardPendingLoginPreference();
              router.replace("/login" + (next ? "?next=" + encodeURIComponent(next) : ""));
              router.refresh();
            } catch {
              setError("Connection interrupted. You are still signed in.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Switching…" : "Sign out and use another account"}
        </button>
      </div>
    </AuthShell>
  );
}
