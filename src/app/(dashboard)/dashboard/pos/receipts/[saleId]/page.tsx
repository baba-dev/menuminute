import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { posReceipt } from "@/modules/pos/service";
import { ReceiptPrintActions } from "./receipt-print-actions";
import "./receipt.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private Receipt | MenuMinute",
  robots: { index: false, follow: false },
};

function money(minor: string, currency: string) {
  const precision =
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
    Number(minor) / 10 ** precision
  );
}
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
  return (
    <main className={"receipt-shell receipt-width-" + paper}>
      <header className="receipt-toolbar">
        <Link href="/dashboard/pos">← The Till</Link>
        <div>
          <strong>Receipt Atelier</strong>
          <p>Local browser printing · non-fiscal order record</p>
        </div>
        <ReceiptPrintActions auto={paramsQuery.auto === "1"} />
      </header>
      <article className="receipt-paper" aria-label="Merchant order bill">
        <header className="receipt-brand">
          <h1>{receipt.sellerName ?? outlet.name}</h1>
          {receipt.sellerAddress && <p>{receipt.sellerAddress}</p>}
          <p>{outlet.name}</p>
        </header>
        <div className="receipt-rule" aria-hidden="true" />
        <div className="receipt-center">
          <h2>{paid ? "STAFF-RECORDED PAYMENT RECEIPT" : "BILL — PAYMENT PENDING"}</h2>
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
          <div>
            <dt>Payment</dt>
            <dd className="receipt-payment-status">{paid ? "COMPLETE" : "PENDING"}</dd>
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
          <span>Pre-tax subtotal</span>
          <strong>{money(receipt.subtotalMinor, receipt.currency)}</strong>
        </div>
        <div className="receipt-rule" aria-hidden="true" />
        <div className="receipt-center receipt-footer">
          <strong>{paid ? "PAYMENT COMPLETE — STAFF RECORDED" : "PAYMENT PENDING"}</strong>
          <p>
            Prices are pre-tax; taxes and fees have not been calculated. This operational bill is
            not a tax invoice, fiscal receipt or provider-verified payment confirmation.
          </p>
          <p>Thank you for visiting!</p>
          <p className="receipt-signature">Powered by MenuMinute</p>
        </div>
      </article>
    </main>
  );
}
