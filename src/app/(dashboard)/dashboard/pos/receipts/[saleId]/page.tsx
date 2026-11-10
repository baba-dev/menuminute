import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPlayClient } from "@/lib/app-distribution";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { posReceipt } from "@/modules/pos/service";
import { ReceiptPrintActions } from "./receipt-print-actions";
import { buildThermalReceipt, formatReceiptMoney as money } from "@/modules/pos/thermal-view";
import "./receipt.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private Receipt | MenuMinute",
  robots: { index: false, follow: false },
};

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ auto?: string; paper?: string }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) redirect("/dashboard");
  const { saleId } = await params;
  const paramsQuery = await searchParams;
  const receipt = await posReceipt(
    { userId: session.user.id, sessionId: session.session.id },
    outlet.organizationId,
    outlet.id,
    saleId
  );
  // Legally issued documents must be reprinted from their immutable fiscal snapshot.
  if (receipt.issuedDocumentId)
    redirect("/dashboard/pos/ledger/documents/" + encodeURIComponent(receipt.issuedDocumentId));
  const paper = paramsQuery.paper === "58" ? "58" : "80";
  const paid = receipt.paymentStatus === "complete";
  const refunded = receipt.paymentStatus === "refunded";
  const staffPaid = paid && receipt.paymentEvidence === "staff_recorded";
  const thermal = buildThermalReceipt(receipt, outlet);
  return (
    <main className={"receipt-shell receipt-width-" + paper}>
      <header className="receipt-toolbar">
        <Link href="/dashboard/pos">← Point of Sale</Link>
        <div>
          <strong>Receipt Atelier</strong>
          <p>Local browser printing · non-fiscal order record</p>
        </div>
        <ReceiptPrintActions
          auto={paramsQuery.auto === "1"}
          paper={paper}
          receipt={thermal}
          saleId={saleId}
          nativePrint={await isPlayClient()}
        />
      </header>
      <article className="receipt-paper" aria-label="Merchant order bill">
        <header className="receipt-brand">
          <h1>{receipt.sellerName ?? outlet.name}</h1>
          {receipt.sellerAddress && <p>{receipt.sellerAddress}</p>}
          <p>{outlet.name}</p>
        </header>
        <div className="receipt-rule" aria-hidden="true" />
        <div className="receipt-center">
          <h2>
            {refunded
              ? "STAFF PAYMENT REFUNDED — CORRECTION"
              : staffPaid
                ? "STAFF-RECORDED PAYMENT RECEIPT"
                : paid
                  ? "BILL — PAYMENT COMPLETE"
                  : "BILL — PAYMENT PENDING"}
          </h2>
          <strong>Order #{receipt.orderNumber}</strong>
        </div>
        <dl className="receipt-details">
          <div>
            <dt>Date</dt>
            <dd>
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: outlet.timezone,
              }).format(new Date(receipt.createdAt))}
            </dd>
          </div>
          <div>
            <dt>Service</dt>
            <dd>{receipt.fulfillmentMode === "dine_in" ? "Dine-in" : "Pickup"}</dd>
          </div>
          {receipt.customerName && (
            <div>
              <dt>Customer</dt>
              <dd>{receipt.customerName}</dd>
            </div>
          )}
          {receipt.customerPhone && (
            <div>
              <dt>Mobile</dt>
              <dd>{receipt.customerPhone}</dd>
            </div>
          )}
          {receipt.fulfillmentMode === "dine_in" && (
            <div>
              <dt>Table</dt>
              <dd>
                {receipt.tableNumber
                  ? receipt.tableLabel &&
                    receipt.tableLabel !== "Table " + receipt.tableNumber &&
                    receipt.tableLabel !== receipt.tableNumber
                    ? receipt.tableNumber + " · " + receipt.tableLabel
                    : receipt.tableNumber
                  : receipt.tableLabel || "Not assigned"}
              </dd>
            </div>
          )}
          <div>
            <dt>Payment</dt>
            <dd className="receipt-payment-status">
              {refunded ? "REFUNDED" : paid ? "COMPLETE" : "PENDING"}
            </dd>
          </div>
          {receipt.paymentMethod && (
            <div>
              <dt>Recorded method</dt>
              <dd>{receipt.paymentMethod.replace("_external", " (staff recorded)")}</dd>
            </div>
          )}
        </dl>
        <div className="receipt-rule" aria-hidden="true" />
        <div className="receipt-lines">
          {receipt.items.map((item, i) => (
            <div className="receipt-line" key={i}>
              <div>
                <strong>{item.name}</strong>
                {item.variant && <small>{item.variant}</small>}
                <small>
                  {item.quantity} × {money(item.unitMinor, receipt.currency)}
                </small>
              </div>
              <span>{money(item.lineMinor, receipt.currency)}</span>
            </div>
          ))}
        </div>
        <div className="receipt-rule" aria-hidden="true" />
        <div className="receipt-total">
          <span>
            {receipt.taxApplied && receipt.taxInclusive
              ? "Tax-inclusive menu prices"
              : "Item subtotal"}
          </span>
          <strong>{money(receipt.subtotalMinor, receipt.currency)}</strong>
        </div>
        {receipt.taxApplied && (
          <>
            <div className="receipt-total">
              <span>Taxable base</span>
              <strong>
                {money(receipt.taxableBaseMinor ?? receipt.subtotalMinor, receipt.currency)}
              </strong>
            </div>
            <div className="receipt-total">
              <span>
                {receipt.taxLabel ?? "Merchant tax"}{" "}
                {receipt.taxInclusive ? "(included)" : "(added)"}
              </span>
              <strong>{money(receipt.taxMinor ?? "0", receipt.currency)}</strong>
            </div>
          </>
        )}
        <div className="receipt-total">
          <span>{refunded ? "Original paid amount (refunded)" : "Total payable"}</span>
          <strong>{money(receipt.totalMinor ?? receipt.subtotalMinor, receipt.currency)}</strong>
        </div>
        <div className="receipt-rule" aria-hidden="true" />
        <div className="receipt-center receipt-footer">
          <strong>
            {refunded
              ? "ORIGINAL STAFF PAYMENT REFUNDED — NON-FISCAL CORRECTION"
              : staffPaid
                ? "PAYMENT COMPLETE — STAFF RECORDED"
                : paid
                  ? "PAYMENT COMPLETE — SEE LEDGER"
                  : "PAYMENT PENDING"}
          </strong>
          <p>
            {receipt.taxApplied
              ? "Merchant-declared tax is frozen at the order's original policy revision. This operational receipt is not a statutory tax invoice, fiscal receipt or provider-verified payment confirmation."
              : "No merchant tax was applied at order creation. This operational bill is not a tax invoice, fiscal receipt or provider-verified payment confirmation."}
          </p>
          <p>Thank you for visiting!</p>
          <p className="receipt-signature">Powered by MenuMinute</p>
        </div>
      </article>
    </main>
  );
}
