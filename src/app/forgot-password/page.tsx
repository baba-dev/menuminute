"use client";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <AuthShell
      eyebrow="ACCOUNT RECOVERY"
      title="Reset your password."
      description="An expiring reset link will be sent if the address has an account."
      extra={<Link href="/login">Return to sign in</Link>}
    >
      <form
        className="mm-auth-form"
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            await authClient.requestPasswordReset({
              email,
              redirectTo: window.location.origin + "/reset-password",
            });
            setMessage("If an account exists, an expiring password-reset link has been sent.");
          } catch {
            setMessage("We could not process your request. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="mm-auth-field" htmlFor="recovery-email">
          Email address
          <input
            id="recovery-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button className="mm-auth-submit" disabled={busy}>
          {busy ? "Requesting…" : "Send reset link"}
        </button>
        <p className="mm-auth-message" role="status" aria-live="polite">
          {message}
        </p>
      </form>
    </AuthShell>
  );
}
