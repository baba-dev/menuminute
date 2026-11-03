"use client";

import type { IndiaGstDraftReview } from "@/modules/pos/india-gst";

export type DraftPaper = "a4" | "80" | "58";
type Props = {
  review: IndiaGstDraftReview;
  supplierName: string;
  supplierGstin: string;
  buyerName: string;
  buyerGstin: string;
  placeOfSupply: string;
  paper: DraftPaper;
};
const money = (minor: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })
    .format(Number(minor) / 100);

/** Review worksheet only: NEVER print an invoice number, IRN or imitation QR. */
export function IndiaGstDraftPrintSheet({
  review, supplierName, supplierGstin, buyerName, buyerGstin, placeOfSupply, paper,
}: Props) {
  return (
    <section
      data-paper={paper}
      className="gst-draft-print"
      aria-label="Non-fiscal GST calculation worksheet — not a tax invoice"
    >
      <div className="gst-draft-print-warning">NOT A TAX INVOICE</div>
      <header>
        <h2>India GST — Draft Review Worksheet</h2>
        <p>Non-statutory working copy. Not valid for GST returns, input tax credit, or customer invoicing.</p>
      </header>
      <dl>
        <div><dt>Merchant</dt><dd>{supplierName}</dd></div>
        <div><dt>Declared GSTIN</dt><dd>{supplierGstin || "UNVERIFIED"}</dd></div>
        <div><dt>Buyer</dt><dd>{buyerName}</dd></div>
        {buyerGstin && <div><dt>Buyer declared GSTIN</dt><dd>{buyerGstin}</dd></div>}
        <div><dt>Place of supply</dt><dd>State code {placeOfSupply}</dd></div>
        <div><dt>POS sale reference</dt><dd>{review.saleId}</dd></div>
      </dl>
      <table>
        <thead><tr><th scope="col">Supply / HSN-SAC</th><th scope="col">Base</th><th scope="col">Tax</th><th scope="col">Total</th></tr></thead>
        <tbody>
          {review.lines.map((line,i) => (
            <tr key={i}>
              <td>
                <strong>{line.description}</strong>
                <small>{line.quantity} × {line.hsnSac} · {line.classification}</small>
                <small>
                  CGST {money(line.cgstMinor)} / SGST {money(line.sgstMinor)} /
                  UTGST {money(line.utgstMinor)} / IGST {money(line.igstMinor)} /
                  Cess {money(line.cessMinor)}
                </small>
              </td>
              <td>{money(line.taxableBaseMinor)}</td>
              <td>{money(line.taxMinor)}</td>
              <td>{money(line.totalMinor)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th>Draft total</th><td>{money(review.taxableBaseMinor)}</td>
            <td>{money(review.taxMinor)}</td><td>{money(review.totalMinor)}</td></tr>
        </tfoot>
      </table>
      <p className="gst-draft-print-warning">
        UNISSUED • NO LEGAL SERIAL • NO IRN • NO SIGNED QR • NO TAX CREDIT
      </p>
      <p>
        Frozen POS bill amount: {money(review.frozenBillTotalMinor)}.
        Outstanding review checks: {review.issues}. No official document exists.
      </p>
      <p>Registered supplier details, HSN/SAC, tax treatments, signatures and IRP applicability require independent approval.</p>
    </section>
  );
}
