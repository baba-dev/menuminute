import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { getCategoriesByRestaurant, getMenuItemsByCategory } from "@/modules/menus/service";
import { MenuManager } from "./menu-manager";

export const metadata = {
  title: "Menu Management — MenuMinute",
  description: "Create and manage your restaurant menu items and categories.",
};

export default async function MenuPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const actor = { userId: session.user.id };
  const restaurant = await getDefaultOrActiveRestaurant(actor.userId);

  if (!restaurant) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h2 className="text-base font-bold text-stone-900">No Restaurant Configured</h2>
        <p className="mt-1 text-xs text-stone-500">
          Please initialize or select a restaurant first.
        </p>
      </div>
    );
  }

  const categories = await getCategoriesByRestaurant(actor, restaurant.id);
  const items = (
    await Promise.all(categories.map((cat) => getMenuItemsByCategory(actor, cat.id, restaurant.id)))
  ).flat();

  return (
    <MenuManager
      initialCategories={categories}
      initialItems={items}
      currency={restaurant.currency}
    />
  );
}
