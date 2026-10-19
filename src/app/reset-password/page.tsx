"use client";
import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
function Form() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
      <Link href="/" className="font-bold text-orange-700">
        MenuMinute
      </Link>
      <h1 className="text-3xl font-extrabold">Choose a new password</h1>
      {!token ? (
        <p role="alert">
          This reset link is missing or invalid.{" "}
          <Link href="/forgot-password" className="underline">
            Request a new one
          </Link>
          .
        </p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password !== confirm) {
              setMessage("Passwords do not match");
              return;
            }
            setBusy(true);
            try {
              const result = await authClient.resetPassword({ token, newPassword: password });
              if (result.error) {
                setMessage("This link could not be used. It may have expired. Request a new link.");
                return;
              }
              router.replace("/login?reset=1");
            } catch {
              setMessage("Unable to reset password. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            className="rounded border p-3"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <label htmlFor="confirm-password">Confirm password</label>
          <input
            id="confirm-password"
            className="rounded border p-3"
            type="password"
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button disabled={busy} className="rounded bg-orange-600 p-3 font-semibold text-white">
            {busy ? "Resetting…" : "Reset password"}
          </button>
          <p role="alert" aria-live="polite">
            {message}
          </p>
        </form>
      )}
    </main>
  );
}
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
