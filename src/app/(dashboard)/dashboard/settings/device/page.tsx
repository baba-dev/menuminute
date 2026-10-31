import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { PwaDevicePanel } from "@/components/pwa/pwa-device-panel";

export const metadata: Metadata = {
  title: "Device & App | MenuMinute",
  description: "Manage your own installed device, optional notifications and offline storage.",
  robots: { index: false, follow: false },
};

export default async function DeviceSettingsPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) redirect("/onboarding");
  return (
    <main className="product" style={{ padding: "1.25rem", maxWidth: 1100 }}>
      <Link href="/dashboard/settings" style={{ display: "inline-block", marginBottom: ".85rem" }}>
        ← Restaurant settings
      </Link>
      <PwaDevicePanel key={outlet.id} outletName={outlet.name} />
    </main>
  );
}
