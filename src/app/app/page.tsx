import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRestaurantsByUserId } from "@/modules/restaurants/service";

// The installed app launches into the merchant journey, not the public marketing site:
// signed out -> login (returns here) -> Menu Studio. Merchants without an outlet start onboarding.
// Always read the authenticated session on the server, including after sign-out/revocation.
// This route intentionally stays network-only in the service worker.
export const dynamic = "force-dynamic";
/** Overview. Single source for where the installed app and Play TWA land after sign-in. */
const APP_HOME_PATH = "/dashboard";
export const metadata = {
  title: "Open MenuMinute",
  robots: { index: false, follow: false },
};

export default async function MerchantAppEntry() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Fapp");

  const outlets = await getRestaurantsByUserId(session.user.id);
  redirect(outlets.length ? APP_HOME_PATH : "/start");
}
