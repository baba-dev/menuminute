"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ReceiptText, Save } from "lucide-react";
import { previewMerchantSalesTax, percentToBasisPoints, type SalesTaxPolicy } from "@/modules/tax/sales-tax";
import type { SalesTaxSettings as Settings } from "@/modules/tax/service";
import { currencyExponent } from "@/lib/money";

type Props = {
  organizationId: string;
  outletId: string;
  outletName: string;
  currency: string;
  initial: Settings;
  canManage: boolean;
};

const formatMinor = (minor: string, currency: string) => {
  const exponent = currencyExponent(currency) ?? 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(Number(minor) / 10 ** exponent);
};

export function SalesTaxSettingsForm({
  organizationId,
  outletId,
  outletName,
  currency,
  initial,
  canManage,
}: Props) {
  const [saved, setSaved] = useState(initial);
  const [status, setStatus] = useState<SalesTaxPolicy["status"]>(initial.status);
  const [label, setLabel] = useState(initial.label);
  const [percent, setPercent] = useState((initial.rateBps / 100).toFixed(2));
  const [inclusive, setInclusive] = useState(initial.inclusive);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const rateBps = status === "configured" ? percentToBasisPoints(percent) : 0;
  const policy: SalesTaxPolicy = {
    status,
    label: label.trim(),
    rateBps: status === "configured" ? (rateBps ?? 0) : 0,
    inclusive,
  };
  let sample: ReturnType<typeof previewMerchantSalesTax> | null = null;
  try {
    const exponent = currencyExponent(currency);
    if (exponent !== null && rateBps !== null && label.trim().length >= 2)
      sample = previewMerchantSalesTax(currency, [String(200 * 10 ** exponent)], policy);
  } catch {
    // An invalid draft must never affect a saved policy or a real bill.
  }
  const dirty =
    status !== saved.status ||
    label.trim() !== saved.label ||
    (status === "configured" ? rateBps : 0) !== saved.rateBps ||
    inclusive !== saved.inclusive;

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || busy || !confirmed || !dirty) return;
    if (rateBps === null || (status === "configured" && rateBps === 0) || !sample) {
      setError("Enter a valid percentage between 0.01% and 100.00%.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/outlets/${encodeURIComponent(outletId)}/tax`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedRevision: saved.revision, confirmed: true, policy }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "Someone else updated the tax settings. Reload and review their changes."
            : data?.message || "Unable to save tax settings."
        );
      setSaved(data as Settings);
      setNotice("Sales tax preference saved with a new audit revision.");
      setConfirmed(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save sales tax settings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8" data-testid="sales-tax-settings">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link href="/dashboard/settings" className="text-sm font-semibold text-orange-600 hover:underline">
          ← Back to outlet settings
        </Link>
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
            <ReceiptText aria-hidden="true" size={17} /> Outlet finance preferences
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sales tax settings.</h1>
          <p className="max-w-3xl text-muted-foreground">
            {outletName} · {currency}. Declare the tax rate and whether your menu prices already include it.
            This is a merchant-supplied calculation preference, not a legal determination of GST, VAT, or sales tax.
          </p>
        </header>
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="status">
          <strong>Configuration phase:</strong> Saved rates are audited, but are <strong>not yet applied to
          live guest orders, POS charges or receipts</strong>. Checkout and fiscal invoice issuance
          remain unchanged until the shared financial integration is tested and approved.
        </div>
        <form onSubmit={save} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
          <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <div>
              <h2 className="text-lg font-semibold">Your declaration</h2>
              <p className="text-sm text-muted-foreground">Only authorized outlet managers can change these settings.</p>
            </div>
            <fieldset disabled={!canManage || busy} className="space-y-2">
              <legend className="mb-2 text-sm font-semibold">Tax status</legend>
              {([
                ["unconfigured", "Not configured", "No tax policy has been declared."],
                ["no_tax", "No tax charged", "You have confirmed this outlet does not charge sales tax."],
                ["configured", "Charge merchant-configured tax", "Enter a rate and how menu prices are displayed."],
              ] as const).map(([value, title, description]) => (
                <label key={value} className="flex cursor-pointer gap-3 rounded-xl border border-border p-3">
                  <input
                    type="radio"
                    name="taxStatus"
                    value={value}
                    checked={status === value}
                    onChange={() => setStatus(value)}
                    className="mt-1 accent-orange-600"
                  />
                  <span><strong className="block text-sm">{title}</strong><span className="text-xs text-muted-foreground">{description}</span></span>
                </label>
              ))}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                <span>Tax label</span>
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  minLength={2}
                  maxLength={40}
                  disabled={!canManage || busy}
                  required
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-normal"
                />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                <span>Tax rate (%)</span>
                <input
                  value={percent}
                  onChange={(event) => setPercent(event.target.value)}
                  inputMode="decimal"
                  disabled={!canManage || busy || status !== "configured"}
                  aria-invalid={rateBps === null || (status === "configured" && rateBps === 0)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-normal"
                />
              </label>
            </div>
            <fieldset disabled={!canManage || busy || status !== "configured"} className="space-y-3">
              <legend className="text-sm font-semibold">Menu prices</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="taxMode" checked={!inclusive} onChange={() => setInclusive(false)} className="accent-orange-600" />
                Exclusive — tax is added to the menu price
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="taxMode" checked={inclusive} onChange={() => setInclusive(true)} className="accent-orange-600" />
                Inclusive — tax is already included in the menu price
              </label>
            </fieldset>
            <label className="flex items-start gap-3 border-t border-border pt-4 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={!canManage || busy}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 accent-orange-600"
              />
              <span>I confirm that I am authorized to supply these settings and remain responsible
                for the applicable tax laws, registrations, exemptions and classifications.</span>
            </label>
            <button
              type="submit"
              disabled={!canManage || busy || !confirmed || !dirty || !sample}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} aria-hidden="true" /> {busy ? "Saving…" : "Save tax preference"}
            </button>
            {!canManage && <p className="text-sm text-muted-foreground">Ask an outlet administrator to update this policy.</p>}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            {notice && <p role="status" className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 size={18} />{notice}</p>}
          </section>
          <aside className="self-start space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold">Example order preview</h2>
            <p className="text-sm text-muted-foreground">Using a hypothetical {formatMinor(String(200 * 10 ** (currencyExponent(currency) ?? 2)), currency)} menu item.</p>
            {sample ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-2"><dt>Menu price</dt><dd>{formatMinor(sample.subtotalMinor, currency)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Taxable amount</dt><dd>{formatMinor(sample.taxableBaseMinor, currency)}</dd></div>
                <div className="flex justify-between gap-2"><dt>{sample.label} ({(sample.rateBps / 100).toFixed(2)}%)</dt><dd>{formatMinor(sample.taxMinor, currency)}</dd></div>
                <div className="flex justify-between gap-2 border-t border-border pt-3 text-lg font-semibold"><dt>Customer total</dt><dd>{formatMinor(sample.totalMinor, currency)}</dd></div>
              </dl>
            ) : <p className="text-sm text-amber-700">Enter a valid label and rate to preview the calculation.</p>}
            <p className="text-xs text-muted-foreground">Preview only. No customer order, invoice or tax payment is created.</p>
            <div className="border-t border-border pt-4 text-xs text-muted-foreground">
              <p>Saved revision: {saved.revision}</p>
              <p>Last updated: {saved.updatedAt ? new Date(saved.updatedAt).toLocaleString() : "Never"}</p>
            </div>
          </aside>
        </form>
      </div>
    </main>
  );
}
