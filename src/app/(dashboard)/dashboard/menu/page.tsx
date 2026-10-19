import Link from "next/link";
import { withActor } from "@/modules/tenancy/service";
import { brands } from "@/db/schema";
import { getRestaurantsByUserId } from "@/modules/restaurants/service";
import { mediaList } from "@/modules/menu-product/service";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { listMenus, menuDetail } from "@/modules/menu-product/service";
import { MenuStudio } from "@/components/menu-product/menu-studio";
export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  const actor = { userId: session.user.id };
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);
  if (!outlet)
    return (
      <div className="product panel">
        <h1>Select an outlet</h1>
        <Link href="/onboarding">Set up your first outlet</Link>
      </div>
    );
  const list = await listMenus(actor, outlet.id);
  return (
    <MenuStudio
      key={outlet.id}
      outlet={outlet}
      initialList={list}
      initialDetail={list[0] ? await menuDetail(actor, list[0].id) : null}
      initialMedia={JSON.parse(JSON.stringify(await mediaList(actor, outlet.id)))}
      outletChoices={await getRestaurantsByUserId(actor.userId)}
      brandChoices={await withActor(actor, (tx) =>
        tx.select({ id: brands.id, name: brands.name }).from(brands)
      )}
    />
  );
}
