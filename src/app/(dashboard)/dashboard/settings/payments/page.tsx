import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { canManageOutletProfile } from "@/modules/restaurants/profile";
import { getOutletReceiptPayment } from "@/modules/receipt-payment/service";
import { ReceiptPaymentSettingsForm } from "@/components/settings/receipt-payment-settings-form";

export const metadata: Metadata = {
  title: "Get paid by UPI | MenuMinute",
  description: "Print a pre-filled UPI payment QR on unpaid thermal bills.",
  robots: { index: false, follow: false },
};
export default async function ReceiptPaymentPage() {
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
    getOutletReceiptPayment(actor, outlet.organizationId, outlet.id),
    canManageOutletProfile(actor, outlet.id),
  ]);
  return (
    <ReceiptPaymentSettingsForm
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
