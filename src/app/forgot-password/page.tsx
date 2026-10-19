"use client";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
      <Link href="/" className="font-bold text-orange-700">
        MenuMinute
      </Link>
      <h1 className="text-3xl font-extrabold">Reset your password</h1>
      <p>Enter your account email. If an account exists, we will send an expiring reset link.</p>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await authClient.requestPasswordReset({
              email,
              redirectTo: `${window.location.origin}/reset-password`,
            });
            setMessage("If an account exists, a password-reset link has been sent.");
          } catch {
            setMessage("We could not process your request. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="recovery-email">Email address</label>
        <input
          id="recovery-email"
          type="email"
          autoComplete="email"
          required
          className="rounded border p-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button disabled={busy} className="rounded bg-orange-600 p-3 font-semibold text-white">
          {busy ? "Requesting…" : "Send reset link"}
        </button>
        <p role="status" aria-live="polite">
          {message}
        </p>
      </form>
      <Link href="/login" className="underline">
        Back to login
      </Link>
    </main>
  );
}
