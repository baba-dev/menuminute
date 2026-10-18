import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { LiveOrdersBoard } from "./live-orders-board";

export const metadata = {
  title: "Live Orders — MenuMinute",
  description: "Real-time customer table and takeaway order management.",
};

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const actor = { userId: session.user.id };
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);

  if (!outlet) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-stone-800 dark:bg-stone-900">
        <h1 className="text-lg font-bold text-stone-900 dark:text-white">Select an outlet</h1>
        <p className="mt-1 text-xs text-stone-500">
          Please select or set up a restaurant outlet to view incoming orders.
        </p>
      </div>
    );
  }

  return (
    <LiveOrdersBoard
      key={outlet.id}
      organizationId={outlet.organizationId}
      outletId={outlet.id}
      currency={outlet.currency}
    />
  );
}
