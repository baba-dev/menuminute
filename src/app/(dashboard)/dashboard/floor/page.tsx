import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/errors";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { getFloorOverview } from "@/modules/hospitality/floor-service";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
import { FloorBoard } from "@/components/dashboard/floor/floor-board";
import { getPlanUsageView } from "@/modules/plans/usage";

export const metadata: Metadata = {
  title: "Dining Floor — MenuMinute",
  description: "Tables, chairs, sections and who is seated right now.",
  robots: { index: false, follow: false },
};

async function allowed(actor: Actor, outletId: string, permission: "menu.write" | "orders.accept") {
  return withOutlet(actor, outletId, permission, async () => true).catch((error: unknown) => {
    if (error instanceof ForbiddenError) return false;
    throw error;
  });
}

/** Tables with real chairs, sections and one-tap occupancy. The old drag canvas is gone. */
export default async function FloorPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");

  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) {
    return (
      <div className="mm-dashboard product mm-dashboard-empty">
        <h1>Select an outlet</h1>
        <p>Set up an outlet to see its dining floor.</p>
        <Link href="/onboarding" className="mm-dashboard-button mm-dashboard-button--primary">
          Set up an outlet
        </Link>
      </div>
    );
  }

  const actor = { userId: session.user.id };
  const [overview, canManage, canSeat, planUsage] = await Promise.all([
    getFloorOverview(actor, outlet.id),
    allowed(actor, outlet.id, "menu.write"),
    allowed(actor, outlet.id, "orders.accept"),
    getPlanUsageView(actor, outlet.id),
  ]);

  return (
    <FloorBoard
      key={outlet.id}
      outlet={{
        id: outlet.id,
        name: outlet.name,
        timezone: outlet.timezone ?? "UTC",
        isDemo: Boolean(outlet.isDemoData),
      }}
      initialOverview={overview}
      canManage={canManage}
      canSeat={canSeat}
      planUsage={planUsage}
    />
  );
}
