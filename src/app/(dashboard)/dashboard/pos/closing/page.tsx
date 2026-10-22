import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { posWorkspace } from "@/modules/pos/service";
import {
  financeRead,
  type FinanceContext,
  type LedgerRow,
  type ShiftRow,
} from "@/modules/pos/finance";
import { FinancialHub } from "../financial-hub";
import "../pos.css";
import "../finance.css";
export const metadata: Metadata = {
  title: "The Closing Desk | MenuMinute POS",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const actor = { userId: session.user.id, sessionId: session.session.id };
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);
  if (!outlet)
    return (
      <main className="till-page">
        <h1>Choose an outlet</h1>
        <Link href="/onboarding">Set up an outlet</Link>
      </main>
    );
  const [workspace, finance, ledger, shifts] = await Promise.all([
    posWorkspace(actor, outlet.organizationId, outlet.id),
    financeRead(actor, outlet.organizationId, outlet.id, {
      view: "context",
    }) as Promise<FinanceContext>,
    financeRead(actor, outlet.organizationId, outlet.id, { view: "ledger" }) as Promise<
      LedgerRow[]
    >,
    financeRead(actor, outlet.organizationId, outlet.id, { view: "shifts" }) as Promise<ShiftRow[]>,
  ]);
  return (
    <FinancialHub
      mode="closing"
      outletId={outlet.id}
      organizationId={outlet.organizationId}
      workspace={workspace}
      initialFinance={finance}
      initialLedger={ledger}
      initialShifts={shifts}
    />
  );
}
