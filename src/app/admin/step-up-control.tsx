"use client";

import { useState } from "react";
import { AdminDialog } from "./admin-dialog";

/** The existing one-use server proof is consumed by the NEXT privileged command.
 * Credentials are never stored or sent through Server Action props.
 */
export function AdminStepUpControl() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !password || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/security/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ password, code }),
      });
      if (!response.ok) {
        setMessage(
          response.status === 429
            ? "Too many attempts. Please try again later."
            : response.status === 503
              ? "Confirmation temporarily unavailable."
              : "Incorrect password or authenticator code."
        );
        return;
      }
      setPassword("");
      setCode("");
      setOpen(false);
      setMessage("");
    } catch {
      setMessage("Unable to reach the server. No action was approved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
        className="font-semibold underline underline-offset-2 hover:opacity-80"
      >
        Confirm a privileged action
      </button>
      {open && (
        <AdminDialog
          title="Confirm a privileged action"
          onClose={() => {
            setOpen(false);
            setPassword("");
            setCode("");
            setMessage("");
          }}
          busy={busy}
          className="w-[min(94vw,28rem)]"
        >
          <form onSubmit={confirm} className="space-y-4 p-6">
            <h2 className="font-display text-xl font-semibold text-stone-900 dark:text-stone-100">
              Confirm it's you
            </h2>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Enter your account password and current authenticator code. This approval is valid for
              one privileged operation only.
            </p>
            <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
              Account password
              <input
                className="admin-input mt-1"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-stone-800 dark:text-stone-200">
              Authenticator code
              <input
                className="admin-input mt-1"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            {message && (
              <p role="alert" className="text-sm text-red-600">
                {message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                className="admin-btn"
                onClick={() => {
                  setOpen(false);
                  setPassword("");
                  setCode("");
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !password || !/^\d{6}$/.test(code)}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Confirming…" : "Confirm"}
              </button>
            </div>
          </form>
        </AdminDialog>
      )}
    </>
  );
}
