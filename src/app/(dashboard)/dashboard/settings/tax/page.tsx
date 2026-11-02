import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { canManageOutletProfile } from "@/modules/restaurants/profile";
import { getOutletSalesTax } from "@/modules/tax/service";
import { SalesTaxSettingsForm } from "@/components/settings/sales-tax-settings-form";

export const metadata: Metadata = {
  title: "Sales tax settings | MenuMinute",
  description: "Merchant-declared sales tax preferences for an outlet.",
  robots: { index: false, follow: false },
};
export default async function OutletSalesTaxPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet)
    return (
      <main className="p-8">
        <h1>Set up an outlet first.</h1>
        <Link href="/onboarding">Create an outlet</Link>
      </main>
    );
  const actor = { userId: session.user.id, sessionId: session.session.id };
  const [initial, canManage] = await Promise.all([
    getOutletSalesTax(actor, outlet.organizationId, outlet.id),
    canManageOutletProfile(actor, outlet.id),
  ]);
  return (
    <SalesTaxSettingsForm
      key={outlet.id}
      outletId={outlet.id}
      organizationId={outlet.organizationId}
      outletName={outlet.name}
      currency={outlet.currency}
      initial={initial}
      canManage={canManage && !outlet.isDemoData}
    />
  );
}
