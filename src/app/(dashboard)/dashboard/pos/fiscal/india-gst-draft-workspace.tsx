"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, FileCheck2, ShieldAlert, Printer } from "lucide-react";
import type { Detail } from "@/modules/pos/finance";
import type { FiscalReadiness } from "@/modules/pos/fiscal-readiness";
import type { IndiaGstDraftReview } from "@/modules/pos/india-gst";
import type { IndiaGstLedgerReadiness } from "@/modules/pos/india-gst-issuer";
import { IndiaGstDraftPrintSheet, type DraftPaper } from "./india-gst-draft-print";
import { percentToBasisPoints } from "@/modules/tax/sales-tax";

type DraftLine = {
  hsnSac: string;
  classification: "goods" | "services";
  unitCode: string;
  ratePercent: string;
  cessPercent: string;
  componentMode: "cgst_sgst" | "cgst_utgst" | "igst";
};
type Props = {
  organizationId: string;
  outletId: string;
  outletName: string;
  sale: Detail;
  readiness: FiscalReadiness;
  release: IndiaGstLedgerReadiness;
};
const money = (raw: string | number | null | undefined) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(raw ?? 0) / 100
  );

export function IndiaGstDraftWorkspace({
  organizationId,
  outletId,
  outletName,
  sale,
  readiness,
  release,
}: Props) {
  const bill = sale.bill!;
  const sellerGstin = bill.seller.taxRegistration ?? "";
  const sellerState = sellerGstin.slice(0, 2);
  const [kind, setKind] = useState<"tax_invoice_draft" | "bill_of_supply_draft">(
    "tax_invoice_draft"
  );
  const [supplyType, setSupplyType] = useState<"b2b" | "b2c">("b2c");
  const [buyerName, setBuyerName] = useState(String(bill.customer.name ?? ""));
  const [buyerAddress, setBuyerAddress] = useState(String(bill.customer.address ?? ""));
  const [buyerGstin, setBuyerGstin] = useState("");
  const [buyerState, setBuyerState] = useState(sellerState);
  const [placeOfSupply, setPlaceOfSupply] = useState(sellerState);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [irpDecision, setIrpDecision] = useState<"undetermined" | "required" | "not_required">(
    "undetermined"
  );
  const [items, setItems] = useState<DraftLine[]>(() =>
    bill.lines.map((line) => ({
      hsnSac: /^\d{4,8}$/.test(String(line.classification ?? ""))
        ? String(line.classification)
        : "",
      classification: "services",
      unitCode: "NOS",
      ratePercent: (Number(line.rateBps ?? 0) / 100).toFixed(2),
      cessPercent: "0.00",
      componentMode: "cgst_sgst",
    }))
  );
  const [review, setReview] = useState<IndiaGstDraftReview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState<DraftPaper>("a4");
  const edit = (fn: () => void) => {
    fn();
    setReview(null);
    setError("");
  };
  const updateItem = (index: number, patch: Partial<DraftLine>) =>
    edit(() =>
      setItems((all) => all.map((item, i) => (i === index ? { ...item, ...patch } : item)))
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const lines = items.map((item) => ({
      hsnSac: item.hsnSac.trim(),
      classification: item.classification,
      unitCode: item.unitCode.trim(),
      rateBps: percentToBasisPoints(item.ratePercent),
      cessBps: percentToBasisPoints(item.cessPercent),
      componentMode: item.componentMode,
    }));
    if (lines.some((line) => line.rateBps === null || line.cessBps === null)) {
      setError("Enter exact percentages with no more than two decimal places.");
      return;
    }
    setBusy(true);
    setError("");
    setReview(null);
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/outlets/${encodeURIComponent(outletId)}/pos/finance/india-gst-review`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            saleId: sale.saleId,
            kind,
            supplyType,
            placeOfSupplyStateCode: placeOfSupply.trim(),
            reverseCharge,
            irpDecision,
            buyer: {
              name: buyerName.trim(),
              address: buyerAddress.trim(),
              gstin: supplyType === "b2c" ? "" : buyerGstin.trim().toUpperCase(),
              stateCode: buyerState.trim(),
            },
            lines,
          }),
        }
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || "Unable to review the frozen POS bill.");
      setReview(body as IndiaGstDraftReview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="bg-background text-foreground min-h-screen px-4 py-8 sm:px-8"
      data-testid="india-gst-review"
    >
      <div className="mx-auto max-w-6xl space-y-7">
        <Link
          href="/dashboard/pos/ledger"
          className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:underline"
        >
          <ArrowLeft size={17} aria-hidden="true" /> Back to The Ledger
        </Link>
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-orange-600 uppercase">
            <FileCheck2 size={18} aria-hidden="true" /> India GST / Statutory preparation
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Review the invoice evidence.
          </h1>
          <p className="text-muted-foreground max-w-3xl text-sm">
            {outletName} · Sale {sale.saleId}. Check the buyer declaration, HSN/SAC, place of supply
            and component amounts against the immutable POS bill. This information is not stored or
            issued.
          </p>
        </header>
        <div
          role="status"
          className="flex gap-3 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-5 text-sm"
        >
          <ShieldAlert className="mt-0.5 shrink-0" size={21} aria-hidden="true" />
          <div>
            <strong>NOT A TAX INVOICE OR BILL OF SUPPLY.</strong> No statutory serial number, IRN,
            signed QR or legal invoice is generated here. Government registration, applicability,
            signatures and independent legal approval are still required. Ordinary POS printing and
            staff-recorded payments are unchanged.
          </div>
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.76fr)]">
          <form
            onSubmit={submit}
            className="border-border bg-card space-y-6 rounded-2xl border p-5 sm:p-7"
          >
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Supplier & frozen bill</h2>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Supplier</dt>
                  <dd className="font-medium">{String(bill.seller.legalName ?? outletName)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Declared GSTIN</dt>
                  <dd className="font-medium">{sellerGstin || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Frozen payable</dt>
                  <dd className="font-medium">{money(bill.totalMinor)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Frozen tax</dt>
                  <dd className="font-medium">{money(bill.taxMinor)}</dd>
                </div>
              </dl>
            </section>
            <section className="border-border space-y-4 border-t pt-5">
              <h2 className="text-lg font-semibold">Supply & buyer declaration</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium">
                  Document preparation
                  <select
                    value={kind}
                    onChange={(e) => edit(() => setKind(e.target.value as typeof kind))}
                    className="border-border bg-background block w-full rounded-lg border p-2.5"
                  >
                    <option value="tax_invoice_draft">Tax invoice draft</option>
                    <option value="bill_of_supply_draft">Bill of supply draft</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Supply type
                  <select
                    value={supplyType}
                    onChange={(e) => edit(() => setSupplyType(e.target.value as typeof supplyType))}
                    className="border-border bg-background block w-full rounded-lg border p-2.5"
                  >
                    <option value="b2c">B2C / consumer</option>
                    <option value="b2b">B2B / registered buyer</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Buyer name
                  <input
                    required
                    minLength={2}
                    maxLength={160}
                    value={buyerName}
                    onChange={(e) => edit(() => setBuyerName(e.target.value))}
                    className="border-border bg-background block w-full rounded-lg border p-2.5"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Buyer state code
                  <input
                    required
                    inputMode="numeric"
                    pattern="[0-9]{2}"
                    maxLength={2}
                    value={buyerState}
                    onChange={(e) => edit(() => setBuyerState(e.target.value))}
                    className="border-border bg-background block w-full rounded-lg border p-2.5"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium sm:col-span-2">
                  Buyer address
                  <textarea
                    required
                    minLength={2}
                    maxLength={500}
                    rows={2}
                    value={buyerAddress}
                    onChange={(e) => edit(() => setBuyerAddress(e.target.value))}
                    className="border-border bg-background block w-full rounded-lg border p-2.5"
                  />
                </label>
                {supplyType === "b2b" && (
                  <label className="space-y-1 text-sm font-medium sm:col-span-2">
                    Buyer GSTIN
                    <input
                      required
                      maxLength={15}
                      value={buyerGstin}
                      onChange={(e) => edit(() => setBuyerGstin(e.target.value))}
                      className="border-border bg-background block w-full rounded-lg border p-2.5"
                    />
                  </label>
                )}
                <label className="space-y-1 text-sm font-medium">
                  Place-of-supply state code
                  <input
                    required
                    inputMode="numeric"
                    maxLength={2}
                    pattern="[0-9]{2}"
                    value={placeOfSupply}
                    onChange={(e) => edit(() => setPlaceOfSupply(e.target.value))}
                    className="border-border bg-background block w-full rounded-lg border p-2.5"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  IRP applicability (unverified)
                  <select
                    value={irpDecision}
                    onChange={(e) =>
                      edit(() => setIrpDecision(e.target.value as typeof irpDecision))
                    }
                    className="border-border bg-background block w-full rounded-lg border p-2.5"
                  >
                    <option value="undetermined">Undetermined</option>
                    <option value="required">Declared required</option>
                    <option value="not_required">Declared not required</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={reverseCharge}
                  onChange={(e) => edit(() => setReverseCharge(e.target.checked))}
                  className="accent-orange-600"
                />
                Merchant declares reverse-charge treatment (requires independent review)
              </label>
            </section>
            <section className="border-border space-y-4 border-t pt-5">
              <h2 className="text-lg font-semibold">HSN/SAC & tax components</h2>
              <p className="text-muted-foreground text-xs">
                Declare each frozen line in its original order. Rates are not verified against an
                official tariff.
              </p>
              {items.map((item, index) => (
                <fieldset key={index} className="border-border space-y-3 rounded-xl border p-4">
                  <legend className="px-1 text-sm font-semibold">
                    {String(bill.lines[index]?.name ?? "Item")} ·{" "}
                    {money(String(bill.lines[index]?.baseMinor ?? "0"))} taxable
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs font-medium">
                      HSN / SAC
                      <input
                        value={item.hsnSac}
                        required
                        pattern="[0-9]{4,8}"
                        onChange={(e) => updateItem(index, { hsnSac: e.target.value })}
                        className="border-border bg-background block w-full rounded-lg border p-2.5 text-sm"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      Supply classification
                      <select
                        value={item.classification}
                        onChange={(e) =>
                          updateItem(index, {
                            classification: e.target.value as DraftLine["classification"],
                          })
                        }
                        className="border-border bg-background block w-full rounded-lg border p-2.5 text-sm"
                      >
                        <option value="services">Services / SAC</option>
                        <option value="goods">Goods / HSN</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      GST rate (%)
                      <input
                        inputMode="decimal"
                        value={item.ratePercent}
                        onChange={(e) => updateItem(index, { ratePercent: e.target.value })}
                        className="border-border bg-background block w-full rounded-lg border p-2.5 text-sm"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      Cess rate (%)
                      <input
                        inputMode="decimal"
                        value={item.cessPercent}
                        onChange={(e) => updateItem(index, { cessPercent: e.target.value })}
                        className="border-border bg-background block w-full rounded-lg border p-2.5 text-sm"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      GST component basis
                      <select
                        value={item.componentMode}
                        onChange={(e) =>
                          updateItem(index, {
                            componentMode: e.target.value as DraftLine["componentMode"],
                          })
                        }
                        className="border-border bg-background block w-full rounded-lg border p-2.5 text-sm"
                      >
                        <option value="cgst_sgst">CGST + SGST</option>
                        <option value="cgst_utgst">CGST + UTGST</option>
                        <option value="igst">IGST</option>
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      Unit code
                      <input
                        value={item.unitCode}
                        maxLength={12}
                        onChange={(e) => updateItem(index, { unitCode: e.target.value })}
                        className="border-border bg-background block w-full rounded-lg border p-2.5 text-sm"
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
            </section>
            <button
              disabled={busy}
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
            >
              <FileCheck2 size={17} aria-hidden="true" />{" "}
              {busy ? "Checking…" : "Review against frozen bill"}
            </button>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
          </form>
          <aside className="border-border bg-card space-y-5 self-start rounded-2xl border p-5 sm:p-7">
            <h2 className="text-lg font-semibold">Pre-issuance checks</h2>
            <div className="border-border space-y-2 rounded-xl border p-3 text-xs" aria-label="Operator-only statutory activation gates">
              <p className="font-semibold">Statutory issuer is disabled</p>
              <p>Operator release: {release.registeredOperatorRelease ? "record exists, not enough for issuance" : "not configured"}</p>
              <p>Legal sign-off: {release.legalSignoff ? "recorded" : "required"}</p>
              <p>Finance sign-off: {release.financeSignoff ? "recorded" : "required"}</p>
              <p>IRP adapter: {release.adapterVerified ? "operator recorded" : "unverified"}</p>
              <p>Signing: {release.signatureVerified ? "operator recorded" : "unverified"}</p>
              <p>Printer acceptance: {release.printerAccepted ? "recorded" : "pending"}</p>
              <p>Current issued GST records: {release.invoiceCount}</p>
              <p className="font-semibold">Available for statutory issuance: No</p>
            </div>
            <p className="text-muted-foreground text-sm">
              {readiness.failedCount} existing fiscal-readiness checks outstanding.
            </p>
            {review ? (
              <div className="space-y-4" role="status">
                <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm font-semibold">
                  {review.notice}
                </p>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt>Taxable base</dt>
                    <dd>{money(review.taxableBaseMinor)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Draft GST + cess</dt>
                    <dd>{money(review.taxMinor)}</dd>
                  </div>
                  <div className="flex justify-between gap-2 font-semibold">
                    <dt>Draft total</dt>
                    <dd>{money(review.totalMinor)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Frozen bill total</dt>
                    <dd>{money(review.frozenBillTotalMinor)}</dd>
                  </div>
                </dl>
                <div className="border-border space-y-2 rounded-lg border p-3 text-xs">
                  <strong>Printable review worksheet (not an invoice)</strong>
                  <label className="flex items-center justify-between gap-2">
                    Paper width
                    <select value={paper} onChange={(event) => setPaper(event.target.value as DraftPaper)}
                      className="border-border bg-background rounded-lg border p-2">
                      <option value="a4">A4</option>
                      <option value="80">80 mm thermal</option>
                      <option value="58">58 mm thermal</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-lg border border-border p-2 font-semibold">
                    <Printer size={15} aria-hidden="true" /> Print draft-only worksheet
                  </button>
                  <p>Select matching media in the browser print dialog; printed text always states NOT A TAX INVOICE.</p>
                </div>
                <strong className="text-sm">{review.issues} unresolved checks</strong>
                <ul className="space-y-3">
                  {review.checks.map((check) => (
                    <li key={check.id} className="border-border border-t pt-2 text-xs">
                      <strong>
                        {check.satisfied ? "✓ Present" : "• Blocked"} —{" "}
                        {check.id.replaceAll("_", " ")}
                      </strong>
                      <p className="text-muted-foreground mt-1">{check.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-muted-foreground space-y-2 text-sm">
                <p>
                  Complete the declarations and run the server review. The resulting figures are
                  comparisons, not approved statutory amounts.
                </p>
                <p>Do not submit any draft to tax authorities or customers as a real invoice.</p>
              </div>
            )}
          </aside>
        </div>
        {review && (
          <IndiaGstDraftPrintSheet
            review={review}
            supplierName={String(bill.seller.legalName ?? outletName)}
            supplierGstin={sellerGstin}
            buyerName={buyerName}
            buyerGstin={supplyType === "b2b" ? buyerGstin.trim().toUpperCase() : ""}
            placeOfSupply={placeOfSupply}
            paper={paper}
          />
        )}
      </div>
    </main>
  );
}
