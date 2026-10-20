import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { kitchenCanManage, kitchenSnapshot } from "@/modules/kitchen/service";
import { listMenus } from "@/modules/menu-product/service";
import { menuDocumentSchema } from "@/modules/menu-product/contracts";
import { KitchenBoard } from "./kitchen-board";
export const metadata = {
  title: "Kitchen Pro — MenuMinute",
  description: "Outlet-scoped preparation stations and live kitchen work",
};
export default async function KitchenPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Fkitchen");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet)
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-bold">Select an outlet</h1>
        <p>Finish outlet setup before opening Kitchen Pro.</p>
        <Link href="/dashboard">Return to dashboard</Link>
      </main>
    );
  const actor = { userId: session.user.id, sessionId: session.session.id };
  let initial;
  try {
    initial = await kitchenSnapshot(actor, outlet.organizationId, outlet.id);
  } catch {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="text-2xl font-bold">Kitchen access unavailable</h1>
        <p className="mt-2">
          Ask an outlet administrator to assign you to a station. If you were just added, sign in
          again.
        </p>
        <Link className="mt-4 inline-block underline" href="/dashboard">
          Return to dashboard
        </Link>
      </main>
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
  return (
    <KitchenBoard
      organizationId={outlet.organizationId}
      outletId={outlet.id}
      outletName={outlet.name}
      initial={initial}
      canManage={canManage}
      menuDishes={dishList}
    />
  );
}
