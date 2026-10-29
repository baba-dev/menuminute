import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { kitchenCanManage, kitchenSnapshot } from "@/modules/kitchen/service";
import { listMenus, menuDetail } from "@/modules/menu-product/service";
import { KitchenBoard } from "./kitchen-board";
import { KitchenIntake } from "./kitchen-intake";
import { withOutlet } from "@/modules/tenancy/service";
import { sql } from "drizzle-orm";
import { KitchenAvailabilityPanel } from "./kitchen-availability-panel";
import { kitchenAvailableDishes } from "@/modules/hospitality/service";
import { ForbiddenError } from "@/lib/errors";
import { env } from "@/lib/config/env";
import { assertAssistantScope } from "@/modules/intelligence/store";
import { EmberLauncher } from "@/components/intelligence/ember-launcher";
import type { Metadata } from "next";
import "./kitchen.css";
export const metadata: Metadata = {
  title: "The Chef’s Pass | Kitchen Pro",
  description: "Private, outlet-scoped preparation stations and expeditor workspace.",
  robots: { index: false, follow: false },
};
export default async function KitchenPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Fkitchen");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet)
    return (
      <KitchenUnavailable
        title="Select an outlet"
        detail="Finish outlet setup before opening preparation stations."
      />
    );
  const actor = { userId: session.user.id, sessionId: session.session.id };
  let initial;
  try {
    initial = await kitchenSnapshot(actor, outlet.organizationId, outlet.id);
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
    return (
      <KitchenUnavailable
        title="Kitchen access unavailable"
        detail="Ask an outlet administrator to assign you to a station. Sign in again if access was recently updated."
      />
    );
  }
  const canManage = await kitchenCanManage(actor, outlet.id);
  const kitchenOperational =
    canManage &&
    (await withOutlet(actor, outlet.id, "orders.read", async (tx) => {
      const result = await tx.execute<{ active: boolean }>(
        sql`SELECT app_private.kitchen_primary_workspace(${outlet.id}) AS active`
      );
      return result.rows[0]?.active === true;
    }));
  const dishList: Array<{ id: string; name: string }> = [];
  if (canManage) {
    const menus = (await listMenus(actor, outlet.id)).filter(
      (menu) => menu.publishedRevision !== null && !menu.archived
    );
    // Read immutable published releases, not mutable drafts: pilot readiness and
    // routing must agree on precisely which dishes guests can order.
    const releases = await Promise.all(menus.map((menu) => menuDetail(actor, menu.id)));
    const seen = new Map<string, string>();
    for (const menu of releases) {
      if (!menu.publishedDocument) continue;
      for (const cat of menu.publishedDocument.categories)
        for (const item of cat.items) {
          if (cat.archived || item.archived) continue;
          // The kitchen route authority is the stable dish ID. A conflicting
          // display name in another assigned menu must not hide a routeable dish.
          if (!seen.has(item.id)) seen.set(item.id, item.name);
        }
    }
    for (const [id, name] of seen) dishList.push({ id, name });
    dishList.sort((a, b) => a.name.localeCompare(b.name));
  }
  const availability = await kitchenAvailableDishes(actor, outlet.organizationId, outlet.id).catch(
    () => []
  );
  let showEmber = false;
  if (env.AI_ASSISTANT_READ_ONLY_ENABLED) {
    try {
      await assertAssistantScope({
        actor,
        organizationId: outlet.organizationId,
        outletId: outlet.id,
      });
      showEmber = true;
    } catch (error) {
      if (!(error instanceof ForbiddenError)) throw error;
    }
  }
  return (
    <>
      <KitchenAvailabilityPanel
        dishes={availability}
        organizationId={outlet.organizationId}
        outletId={outlet.id}
      />
      {kitchenOperational && (
        <KitchenIntake organizationId={outlet.organizationId} outletId={outlet.id} />
      )}
      <KitchenBoard
        organizationId={outlet.organizationId}
        outletId={outlet.id}
        outletName={outlet.name}
        initial={initial}
        canManage={canManage}
        menuDishes={dishList}
      />
      {showEmber && (
        <EmberLauncher
          organizationId={outlet.organizationId}
          outletId={outlet.id}
          outletName={outlet.name}
        />
      )}
    </>
  );
}

function KitchenUnavailable({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="product mm-kitchen kk-locked">
      <section className="kk-hero">
        <div className="kk-hero-content">
          <span className="kk-eyebrow">KITCHEN PRO / PRIVATE WORKSPACE</span>
          <h1>{title}</h1>
          <p className="kk-hero-note">{detail}</p>
          <div className="kk-hero-actions">
            <Link href="/dashboard" className="kk-hero-primary">
              Return to dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
