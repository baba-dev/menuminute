import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { LiveOrdersBoard } from "./live-orders-board";
import { withOutlet } from "@/modules/tenancy/service";
import { sql } from "drizzle-orm";
import "@/components/orders/service-counter.css";

export const metadata: Metadata = {
  title: "The Service Counter | Orders",
  description: "Private outlet-specific order operations and service history.",
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet)
    return (
      <main className="service-counter sc-no-outlet">
        <span className="sc-eyebrow">THE SERVICE COUNTER</span>
        <h1>Select an outlet</h1>
        <p>Choose or create an outlet before managing incoming orders.</p>
        <Link href="/onboarding" className="sc-hero-primary">
          Set up an outlet →
        </Link>
      </main>
    );
  // Kitchen Pro is the primary intake workspace for ready, entitled outlets.
  // Non-Kitchen outlets and roles without Kitchen privileges remain here.
  const kitchenPrimary = await withOutlet(
    { userId: session.user.id, sessionId: session.session.id },
    outlet.id,
    "orders.read",
    async (tx) => {
      const result = await tx.execute<{ active: boolean }>(
        sql`SELECT app_private.kitchen_primary_workspace(${outlet.id}) AS active`
      );
      return result.rows[0]?.active === true && await (async () => {
        const manager = await tx.execute<{ allowed: boolean }>(sql`SELECT app_private.can_outlet(${outlet.id},\'outlet.manage\') AS allowed`);
        return manager.rows[0]?.allowed === true;
      })();
    }
  ).catch(() => false);
  if (kitchenPrimary) redirect("/kitchen");
  return (
    <LiveOrdersBoard
      key={outlet.id}
      organizationId={outlet.organizationId}
      outletId={outlet.id}
      outletName={outlet.name}
      currency={outlet.currency}
      timezone={outlet.timezone}
    />
  );
}
