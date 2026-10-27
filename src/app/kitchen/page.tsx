import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { kitchenCanManage, kitchenSnapshot } from "@/modules/kitchen/service";
import { listMenus } from "@/modules/menu-product/service";
import { menuDocumentSchema } from "@/modules/menu-product/contracts";
import { KitchenBoard } from "./kitchen-board";
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
  const dishList: Array<{ id: string; name: string }> = [];
  if (canManage) {
    const menus = await listMenus(actor, outlet.id);
    const seen = new Map<string, string>();
    const ambiguous = new Set<string>();
    for (const menu of menus.filter((m) => m.publishedRevision !== null && !m.archived)) {
      const parsed = menuDocumentSchema.safeParse(menu.document);
      if (!parsed.success) continue;
      for (const cat of parsed.data.categories)
        for (const item of cat.items) {
          if (item.archived) continue;
          if (seen.has(item.id) && seen.get(item.id) !== item.name) ambiguous.add(item.id);
          else seen.set(item.id, item.name);
        }
    }
    for (const [id, name] of seen) if (!ambiguous.has(id)) dishList.push({ id, name });
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
