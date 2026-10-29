"use client";

import { useState, type FormEvent } from "react";
import { ShieldCheck, ChefHat, ExternalLink } from "lucide-react";

type Props = {
  initialEnabled: boolean;
  runningSha: string;
  onApprove: (input: {
    releaseSha: string;
    evidenceUrl: string;
    reason: string;
    key: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
};

export function KitchenCommercialLaunch({ initialEnabled, runningSha, onApprove }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || enabled || !runningSha) return;
    setBusy(true);
    setMessage("");
    try {
      const step = await fetch("/api/security/step-up", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, code: totp }),
      });
      if (!step.ok) throw new Error("Password or authenticator not accepted. Try again.");
      const result = await onApprove({
        releaseSha: runningSha,
        evidenceUrl,
        reason: reason.trim(),
        key: crypto.randomUUID(),
      });
      if (!result.ok) throw new Error(result.message);
      setEnabled(true);
      setMessage("Automatic paid Kitchen activation approved for this deployment.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Commercial release approval unavailable."
      );
    } finally {
      setBusy(false);
      setPassword("");
      setTotp("");
    }
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-white p-5 dark:border-orange-900/40 dark:bg-stone-900">
      <div className="flex items-center gap-3">
        <ChefHat size={22} className="text-orange-700 dark:text-orange-300" aria-hidden="true" />
        <h2 className="text-lg font-bold text-stone-900 dark:text-white">
          Automatic paid Kitchen Pro
        </h2>
        <span
          className={`rounded-full px-2 py-1 text-xs ${
            enabled ? "bg-emerald-950 text-emerald-300" : "bg-amber-950 text-amber-200"
          }`}
        >
          {enabled ? "Platform release approved" : "Global release approval required"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-stone-700 dark:text-stone-300">
        This is a one-time platform release gate, not a per-restaurant approval. After approval,
        verified paid Kitchen Pro subscriptions grant access automatically; each ready outlet routes
        newly accepted orders to its stations. Unconfigured or non-Kitchen outlets remain on the
        merchant orders board.
      </p>
      <p className="mt-2 font-mono text-xs text-stone-500 dark:text-stone-400">
        Deployed release: {runningSha || "Unavailable"}
      </p>
      {!enabled && (
        <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-3">
          <label className="block text-sm font-semibold text-stone-900 dark:text-white">
            Production QA and rollout evidence
            <input
              type="url"
              required
              maxLength={500}
              value={evidenceUrl}
              placeholder="https://github.com/baba-dev/menuminute/issues/76"
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-950 dark:text-white"
            />
          </label>
          <label className="block text-sm font-semibold text-stone-900 dark:text-white">
            Operator release authorization
            <textarea
              required
              rows={2}
              minLength={20}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe independent test results, restore verification and planned monitoring."
              className="mt-2 w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-950 dark:text-white"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-stone-700 dark:text-stone-300">
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-stone-900 dark:border-stone-700 dark:bg-stone-950 dark:text-white"
              />
            </label>
            <label className="text-xs text-stone-700 dark:text-stone-300">
              Authenticator code
              <input
                required
                pattern="[0-9]{6}"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-stone-900 dark:border-stone-700 dark:bg-stone-950 dark:text-white"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy || !runningSha || !/^\d{6}$/.test(totp)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            <ShieldCheck size={18} />{" "}
            {busy ? "Verifying release…" : "Approve automatic paid Kitchen Pro"}
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-amber-700 dark:text-amber-300">
          {message}
        </p>
      )}
      <a
        className="mt-3 inline-flex items-center gap-2 text-xs text-orange-700 underline dark:text-orange-300"
        href="https://github.com/baba-dev/menuminute/issues/76"
        target="_blank"
        rel="noopener noreferrer"
      >
        Kitchen production QA tracker <ExternalLink size={12} />
      </a>
    </section>
  );
}
