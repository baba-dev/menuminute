"use client";

import { useState } from "react";
import Link from "next/link";
import { QrCode, Save } from "lucide-react";
import { PayBlockPreview } from "@/components/pos/pay-block-preview";
import { normalizePayeeName, parseUpiId, samplePayBlock } from "@/lib/pos/upi";
import type { ReceiptPaymentProfile } from "@/modules/receipt-payment/service";

type Props = {
  organizationId: string;
  outletId: string;
  outletName: string;
  currency: string;
  initial: ReceiptPaymentProfile;
  canManage: boolean;
};

const inputClass = "border-border bg-background w-full rounded-lg border px-3 py-2 font-normal";

/** "Get paid by UPI": the merchant's own UPI ID, printed as a pre-filled QR on unpaid INR bills.
 * MenuMinute never contacts a payment provider; staff still record the payment in the till.
 */
export function ReceiptPaymentSettingsForm({
  organizationId,
  outletId,
  outletName,
  currency,
  initial,
  canManage,
}: Props) {
  const [saved, setSaved] = useState(initial);
  const [upiId, setUpiId] = useState(initial.upiId ?? "");
  const [payeeName, setPayeeName] = useState(
    initial.payeeName ?? normalizePayeeName(outletName) ?? ""
  );
  const [enabled, setEnabled] = useState(initial.configured ? initial.enabled : true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const parsedUpi = parseUpiId(upiId);
  const parsedName = normalizePayeeName(payeeName);
  const upiInvalid = upiId.trim().length > 0 && !parsedUpi;
  const nameInvalid = payeeName.trim().length > 0 && !parsedName;
  const valid = Boolean(parsedUpi && parsedName);
  const dirty =
    parsedUpi !== saved.upiId || parsedName !== saved.payeeName || enabled !== saved.enabled;
  const preview = parsedUpi && parsedName ? samplePayBlock(parsedUpi, parsedName) : null;

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || busy || !valid || !dirty) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/outlets/${encodeURIComponent(outletId)}/receipt-payment`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedRevision: saved.revision,
            upiId: parsedUpi,
            payeeName: parsedName,
            enabled,
          }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "Someone else updated these settings. Reload and review their changes."
            : data?.message || "Unable to save your UPI settings."
        );
      setSaved(data as ReceiptPaymentProfile);
      setNotice("Saved. New unpaid bills will print the Scan & Pay QR.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your UPI settings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="bg-background text-foreground min-h-screen px-4 py-8 sm:px-8"
      data-testid="receipt-payment-settings"
    >
      <div className="mx-auto max-w-5xl space-y-8">
        <Link
          href="/dashboard/settings"
          className="text-sm font-semibold text-orange-600 hover:underline"
        >
          ← Back to outlet settings
        </Link>
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-orange-600 uppercase">
            <QrCode aria-hidden="true" size={17} /> Receipts
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Get paid by UPI.</h1>
          <p className="text-muted-foreground max-w-3xl">
            {outletName}. Add your UPI ID and unpaid thermal bills print a Scan &amp; Pay QR. This
            QR opens your customer’s UPI app with the amount filled in. Staff still record the
            payment in the till; MenuMinute does not process or confirm payments.
          </p>
        </header>
        {currency !== "INR" && (
          <div
            className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
            role="status"
          >
            UPI works in Indian rupees, so the QR prints only on INR bills. This outlet bills in{" "}
            {currency}.
          </div>
        )}
        <form
          onSubmit={save}
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]"
        >
          <section className="border-border bg-card space-y-5 rounded-2xl border p-5 shadow-sm sm:p-7">
            <div>
              <h2 className="text-lg font-semibold">Your UPI details</h2>
              <p className="text-muted-foreground text-sm">
                Only authorized outlet managers can change these settings.
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="upi-id" className="block text-sm font-semibold">
                UPI ID
              </label>
              <input
                id="upi-id"
                value={upiId}
                onChange={(event) => setUpiId(event.target.value)}
                placeholder="yourname@bank"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={!canManage || busy}
                aria-invalid={upiInvalid}
                aria-describedby={upiInvalid ? "upi-id-error" : undefined}
                className={inputClass}
              />
              {upiInvalid && (
                <p id="upi-id-error" className="text-xs text-red-600">
                  Enter a valid UPI ID such as name@bank.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="payee-name" className="block text-sm font-semibold">
                Payee name
              </label>
              <input
                id="payee-name"
                value={payeeName}
                onChange={(event) => setPayeeName(event.target.value)}
                maxLength={60}
                disabled={!canManage || busy}
                aria-invalid={nameInvalid}
                aria-describedby="payee-name-hint"
                className={inputClass}
              />
              <p
                id="payee-name-hint"
                className={nameInvalid ? "text-xs text-red-600" : "text-muted-foreground text-xs"}
              >
                Shown on the bill. Use 2 to 40 letters, numbers or . &amp; &apos; -
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!canManage || busy}
                onChange={(event) => setEnabled(event.target.checked)}
                className="mt-1 accent-orange-600"
              />
              <span>Print the Scan &amp; Pay QR on unpaid bills</span>
            </label>
            <button
              type="submit"
              disabled={!canManage || busy || !valid || !dirty}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} aria-hidden="true" /> {busy ? "Saving…" : "Save UPI settings"}
            </button>
            {!canManage && (
              <p className="text-muted-foreground text-sm">
                Ask an outlet administrator to update this setting.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="text-sm text-emerald-700">
                {notice}
              </p>
            )}
          </section>
          <aside className="border-border bg-card space-y-3 rounded-2xl border p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold">Printed preview</h2>
            <p className="text-muted-foreground text-sm">
              A sample 80 mm bill for Rs 840.00. Your real bills use their own totals.
            </p>
            {preview ? (
              <PayBlockPreview block={preview} paper="80" />
            ) : (
              <p className="text-muted-foreground border-border rounded-xl border border-dashed p-6 text-center text-sm">
                Your printed block appears here once the UPI ID is complete.
              </p>
            )}
          </aside>
        </form>
      </div>
    </main>
  );
}
