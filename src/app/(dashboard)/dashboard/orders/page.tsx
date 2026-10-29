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
    async tx => {
      const result = await tx.execute<{active:boolean}>(sql`
        SELECT COALESCE(k.enabled,false)
          AND app_private.can_outlet(${outlet.id},'outlet.manage')
          AND EXISTS(SELECT 1 FROM entitlement_grants g
            WHERE g.organization_id=${outlet.organizationId}
              AND g.capability='kitchen.new' AND g.revoked_at IS NULL
              AND g.starts_at<=clock_timestamp() AND g.ends_at>clock_timestamp())
          AND NOT EXISTS(SELECT 1 FROM kitchen_pilot_outlets p
            WHERE p.outlet_id=${outlet.id} AND p.state='draining')
          AS active
        FROM kitchen_outlet_settings k WHERE k.outlet_id=${outlet.id}
      `);
      return result.rows[0]?.active === true;
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
