"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
      <Link href="/" className="font-bold text-orange-700">
        MenuMinute
      </Link>
      <h1 className="text-3xl font-extrabold">Two-factor verification</h1>
      <p>
        {backup
          ? "Use one of your saved single-use recovery codes."
          : "Enter the six-digit code from your authenticator app."}
      </p>
      <form
        className="grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = backup
              ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: false })
              : await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
            if (result.error) {
              setError("Invalid or expired code. Try again.");
              return;
            }
            router.replace("/dashboard");
            router.refresh();
          } catch {
            setError("Verification failed. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="factor-code">{backup ? "Recovery code" : "Authenticator code"}</label>
        <input
          id="factor-code"
          className="rounded border p-3"
          required
          autoComplete={backup ? "off" : "one-time-code"}
          inputMode={backup ? "text" : "numeric"}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button disabled={busy} className="rounded bg-orange-600 p-3 font-semibold text-white">
          {busy ? "Verifying…" : "Continue"}
        </button>
        <p role="alert">{error}</p>
      </form>
      <button
        className="text-left underline"
        onClick={() => {
          setBackup(!backup);
          setCode("");
        }}
      >
        {backup ? "Use authenticator" : "Use recovery code"}
      </button>
      <Link href="/login" className="underline">
        Return to sign in
      </Link>
    </main>
  );
}
