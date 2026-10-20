import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { withOutlet } from "@/modules/tenancy/service";
import { CaptureWizard } from "./capture-wizard";
export default async function MenuCapturePage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const actor = { userId: session.user.id };
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);
  if (!outlet)
    return (
      <div className="panel">
        <h1>Select an outlet</h1>
        <Link href="/onboarding">Set up your first outlet</Link>
      </div>
    );
  await withOutlet(actor, outlet.id, "menu.write", async () => true);
  return (
    <CaptureWizard
      key={outlet.id}
      outletId={outlet.id}
      outletName={outlet.name}
      currency={outlet.currency}
    />
  );
}
