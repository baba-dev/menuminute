import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { ReviewsWorkspace } from "./reviews-workspace";

// noindex is inherited from the private workspace layout; do not repeat it here.
export const metadata: Metadata = {
  title: "Guest reviews | MenuMinute",
  description: "Approve diner comments and manage dish ratings.",
};

export default async function ReviewsPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) redirect("/onboarding");
  return (
    <ReviewsWorkspace
      key={outlet.id}
      organizationId={outlet.organizationId}
      outletId={outlet.id}
      outletName={outlet.name}
    />
  );
}
