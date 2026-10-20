"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
function Form() {
  const router = useRouter(),
    token = useSearchParams().get("token");
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <AuthShell
      eyebrow="ACCOUNT RECOVERY"
      title="Choose a new password."
      description="Use a strong password you do not use elsewhere. Resetting it revokes your other sessions."
      extra={<Link href="/login">Return to sign in</Link>}
    >
      {!token ? (
        <p role="alert" className="mm-auth-message mm-auth-message--error">
          This link is missing or invalid. <Link href="/forgot-password">Request a new one.</Link>
        </p>
      ) : (
        <form
          className="mm-auth-form"
          aria-busy={busy}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (password !== confirm) {
              setError("Passwords do not match.");
              return;
            }
            setBusy(true);
            try {
              const r = await authClient.resetPassword({ token, newPassword: password });
              if (r.error) {
                setError("This link may have expired. Request a new reset link.");
                return;
              }
              router.replace("/login?reset=1");
            } catch {
              setError("Unable to reset your password. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="mm-auth-field" htmlFor="new-password">
            New password
            <input
              id="new-password"
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="mm-auth-field" htmlFor="confirm-password">
            Confirm password
            <input
              id="confirm-password"
              type="password"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={Boolean(error && password !== confirm)}
              aria-describedby={error ? "reset-error" : undefined}
            />
          </label>
          {error && (
            <p id="reset-error" role="alert" className="mm-auth-message mm-auth-message--error">
              {error}
            </p>
          )}
          <button className="mm-auth-submit" disabled={busy}>
            {busy ? "Resetting…" : "Reset password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
