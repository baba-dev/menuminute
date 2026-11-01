import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listOrganizations } from "@/modules/organizations/service";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { canManageOutletProfile, editableOutletProfile } from "@/modules/restaurants/profile";
import { OutletAtelier } from "./outlet-atelier";
import "./settings.css";
export const metadata: Metadata = {
  title: "Outlet settings | MenuMinute",
  description: "Operational and guest-facing settings for the active outlet.",
  robots: { index: false, follow: false },
};
export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet)
    return (
      <main className="product mm-settings mm-settings-empty">
        <span className="os-eyebrow">OUTLET ATELIER</span>
        <h1>Set up your first outlet.</h1>
        <p>Complete onboarding to personalize your restaurant workspace.</p>
        <Link href="/onboarding" className="os-action os-action-primary">
          Create an outlet →
        </Link>
      </main>
    );
  const actor = { userId: session.user.id, sessionId: session.session.id };
  const [canManage, organizations] = await Promise.all([
    canManageOutletProfile(actor, outlet.id),
    listOrganizations(actor),
  ]);
  const organizationVersion =
    organizations.find((organization) => organization.id === outlet.organizationId)?.version ?? 0;
  return (
    <OutletAtelier
      key={outlet.id}
      organizationId={outlet.organizationId}
      organizationVersion={organizationVersion}
      outletId={outlet.id}
      outlet={{
        name: outlet.name,
        slug: outlet.slug,
        publicId: outlet.publicId,
        country: outlet.country || "IN",
        currency: outlet.currency,
        timezone: outlet.timezone,
        outletType: outlet.outletType,
        fulfillmentModes: outlet.fulfillmentModes,
        isActive: outlet.isActive,
        isDemoData: outlet.isDemoData,
        profileVersion: outlet.profileVersion,
      }}
      initial={editableOutletProfile(outlet)}
      canManage={canManage}
    />
  );
}
