import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/errors";
import { billingState } from "@/modules/billing/service";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { canManageOutletProfile, editableOutletProfile } from "@/modules/restaurants/profile";
import { OutletAtelier } from "./outlet-atelier";
import "./settings.css";
export const metadata: Metadata = {
  title: "The Outlet Atelier | Restaurant Settings",
  description:
    "Private outlet-specific profile, branding, operational identity and access settings.",
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
  const canManage = await canManageOutletProfile(actor, outlet.id);
  let billing: { freeMenu: boolean; ordering: boolean; kitchen: boolean } | null = null;
  try {
    const result = await billingState(actor, outlet.organizationId);
    billing = { freeMenu: result.freeMenu, ordering: result.ordering, kitchen: result.kitchen };
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
  }
  return (
    <OutletAtelier
      key={outlet.id}
      organizationId={outlet.organizationId}
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
      billing={billing}
    />
  );
}
