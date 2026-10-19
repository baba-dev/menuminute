"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
function VerificationForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
      <Link href="/" className="font-bold text-orange-700">
        MenuMinute
      </Link>
      <h1 className="text-3xl font-extrabold">Verify your email</h1>
      <p>
        Check your inbox for a verification link. Existing accounts must verify their address before
        accessing restaurant data.
      </p>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setStatus("");
          try {
            await authClient.sendVerificationEmail({ email, callbackURL: "/login?verified=1" });
            setStatus("If this address is eligible, a verification link has been sent.");
          } catch {
            setStatus("Unable to request a link. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="verification-email">Email address</label>
        <input
          id="verification-email"
          className="rounded border p-3"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button disabled={busy} className="rounded bg-orange-600 p-3 font-semibold text-white">
          {busy ? "Sending…" : "Resend verification email"}
        </button>
        <p role="status" aria-live="polite">
          {status}
        </p>
      </form>
      <Link href="/login" className="underline">
        Return to sign in
      </Link>
    </main>
  );
}
export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerificationForm />
    </Suspense>
  );
}
