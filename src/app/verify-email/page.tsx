"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeReturnPath } from "@/lib/auth-return";
function Form() {
  const params = useSearchParams(),
    next = safeReturnPath(params.get("next"), "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  return (
    <AuthShell
      eyebrow="ONE QUICK SECURITY STEP"
      title="Check your inbox."
      description={
        (email ? "We sent a verification link to " + email + ". " : "") +
        "It can take a few minutes to arrive; check your spam folder too. You can keep using MenuMinute while you wait."
      }
      extra={
        <Link href={next ? "/login?next=" + encodeURIComponent(next) : "/login"}>
          Return to sign in
        </Link>
      }
    >
      <form
        className="mm-auth-form"
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setStatus("");
          setError("");
          try {
            const url = "/login?verified=1" + (next ? "&next=" + encodeURIComponent(next) : "");
            const result = await authClient.sendVerificationEmail({ email, callbackURL: url });
            if (result.error) throw new Error("Unable to send a new link. Try again.");
            setStatus("If the address is eligible, a verification link has been sent.");
            setCooldown(60);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to request a link.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="mm-auth-field" htmlFor="verification-email">
          Email address
          <input
            id="verification-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button className="mm-auth-submit" disabled={busy || cooldown > 0}>
          {busy
            ? "Sending…"
            : cooldown > 0
              ? "Resend available in " + cooldown + "s"
              : "Resend verification email"}
        </button>
        {status && (
          <p className="mm-auth-message" role="status" aria-live="polite">
            {status}
          </p>
        )}
        {error && (
          <p className="mm-auth-message mm-auth-message--error" role="alert">
            {error}
          </p>
        )}
        <p>
          <Link href={next || "/dashboard"}>Continue to my workspace</Link> — verification is only
          needed for team invitations and billing.
        </p>
      </form>
    </AuthShell>
  );
}
export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
