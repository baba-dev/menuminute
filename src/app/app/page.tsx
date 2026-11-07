import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRestaurantsByUserId } from "@/modules/restaurants/service";

// The installed app launches into the merchant journey, not the public marketing site.
// Always read the authenticated session on the server, including after sign-out/revocation.
// This route intentionally stays network-only in the service worker.
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Open MenuMinute",
  robots: { index: false, follow: false },
};

export default async function MerchantAppEntry() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Fapp");

  const outlets = await getRestaurantsByUserId(session.user.id);
  redirect(outlets.length ? "/dashboard" : "/start");
}
