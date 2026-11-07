import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Smartphone } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { PwaDevicePanel } from "@/components/pwa/pwa-device-panel";
import "./device.css";

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
    <div className="mm-device-settings">
      <header className="mm-device-hero">
        <Link href="/dashboard/settings" className="mm-device-back">
          <ArrowLeft size={17} aria-hidden="true" />
          Restaurant settings
        </Link>
        <div className="mm-device-headline">
          <div>
            <span className="mm-device-eyebrow">YOUR WORKSPACE / DEVICE</span>
            <h1>Your app, your device.</h1>
            <p>
              Manage installation, notifications and local storage for this device. These settings
              will not change the experience for your guests.
            </p>
          </div>
          <Smartphone size={58} strokeWidth={1.3} aria-hidden="true" />
        </div>
      </header>
      <div className="mm-device-body">
        <PwaDevicePanel key={outlet.id} outletName={outlet.name} />
      </div>
    </div>
  );
}
