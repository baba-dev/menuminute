import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { financeRead, type Detail } from "@/modules/pos/finance";
import type { FiscalReadiness } from "@/modules/pos/fiscal-readiness";
import { IndiaGstDraftWorkspace } from "./india-gst-draft-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "India GST Pre-Issuance Review | MenuMinute",
  description: "Merchant GST draft checks; no statutory invoice is issued.",
  robots: { index: false, follow: false },
};

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
      <main className="mx-auto max-w-4xl space-y-4 p-8">
        <h1 className="text-3xl font-semibold">India GST draft review</h1>
        <p>
          Choose a frozen POS sale from The Ledger to review its statutory invoice requirements.
        </p>
        <Link className="text-orange-600 underline" href="/dashboard/pos/ledger">
          Open The Ledger
        </Link>
      </main>
    );

  const actor = { userId: session.user.id, sessionId: session.session.id };
  const [sale, readiness] = await Promise.all([
    financeRead(actor, outlet.organizationId, outlet.id, {
      view: "sale",
      id: saleId,
    }) as Promise<Detail>,
    financeRead(actor, outlet.organizationId, outlet.id, { view: "fiscal_readiness", id: saleId }),
  ]);
  if (!sale || !sale.bill)
    return (
      <main className="mx-auto max-w-4xl space-y-4 p-8">
        <h1 className="text-3xl font-semibold">A frozen bill is required</h1>
        <p>Unfrozen sale amounts cannot be used to prepare a statutory invoice draft.</p>
        <Link className="text-orange-600 underline" href="/dashboard/pos/ledger">
          Back to The Ledger
        </Link>
      </main>
    );
  return (
    <IndiaGstDraftWorkspace
      organizationId={outlet.organizationId}
      outletId={outlet.id}
      outletName={outlet.name}
      sale={sale}
      readiness={readiness as FiscalReadiness}
    />
  );
}
