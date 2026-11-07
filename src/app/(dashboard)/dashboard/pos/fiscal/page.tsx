import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileWarning } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { financeRead, type Detail } from "@/modules/pos/finance";
import type { FiscalReadiness } from "@/modules/pos/fiscal-readiness";
import type { IndiaGstLedgerReadiness } from "@/modules/pos/india-gst-issuer";
import "./india-gst-draft-print.css";
import "./fiscal-ux.css";
import { IndiaGstDraftWorkspace } from "./india-gst-draft-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "India GST Pre-Issuance Review | MenuMinute",
  description: "Merchant GST draft checks; no statutory invoice is issued.",
  robots: { index: false, follow: false },
};

function FiscalEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mm-fiscal-empty">
      <section className="mm-fiscal-empty-card">
        <FileWarning size={38} strokeWidth={1.5} aria-hidden="true" />
        <h1>{title}</h1>
        <p>{detail}</p>
        <Link className="mm-fiscal-back" href="/dashboard/pos/ledger">
          Open The Ledger
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

export default async function IndiaGstPage({
  searchParams,
}: {
  searchParams: Promise<{ sale?: string }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) redirect("/dashboard");
  const saleId = (await searchParams).sale;
  if (!saleId || !/^[A-Za-z0-9_-]{1,128}$/.test(saleId))
    return (
      <FiscalEmpty
        title="India GST draft review"
        detail="Choose a frozen POS sale from The Ledger to review its statutory invoice requirements."
      />
    );

  const actor = { userId: session.user.id, sessionId: session.session.id };
  const [sale, readiness, release] = await Promise.all([
    financeRead(actor, outlet.organizationId, outlet.id, {
      view: "sale",
      id: saleId,
    }) as Promise<Detail>,
    financeRead(actor, outlet.organizationId, outlet.id, { view: "fiscal_readiness", id: saleId }),
    financeRead(actor, outlet.organizationId, outlet.id, { view: "india_gst_ledger_readiness" }),
  ]);
  if (!sale || !sale.bill)
    return (
      <FiscalEmpty
        title="A frozen bill is required"
        detail="Unfrozen sale amounts cannot be used to prepare a statutory invoice draft."
      />
    );
  return (
    <IndiaGstDraftWorkspace
      organizationId={outlet.organizationId}
      outletId={outlet.id}
      outletName={outlet.name}
      sale={sale}
      readiness={readiness as FiscalReadiness}
      release={release as IndiaGstLedgerReadiness}
    />
  );
}
