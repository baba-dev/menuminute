import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForbiddenError } from "@/lib/errors";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { listGuests } from "@/modules/crm/service";
import { GuestsWorkspace } from "./guests-workspace";
import "./guests.css";

export const metadata: Metadata = {
  title: "Guests | MenuMinute",
  description: "Your private guest directory and visit history.",
  robots: { index: false, follow: false },
};
export default async function GuestsPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) redirect("/onboarding");
  const actor = { userId: session.user.id, sessionId: session.session.id };
  let initial: Awaited<ReturnType<typeof listGuests>> | null = null;
  try {
    initial = await listGuests(actor, outlet.organizationId, outlet.id, "", 0);
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
  }
  if (!initial) {
    return (
      <main className="guests-shell">
        <span className="guests-eyebrow">GUEST RELATIONSHIPS</span>
        <h1>Guests</h1>
        <div className="guests-empty">
          <h2>Guest directory unavailable</h2>
          <p>
            Guest CRM requires an eligible plan and permission to view orders for this outlet.
            If your restaurant already has access, ask an owner to review your outlet role.
          </p>
          <div className="guests-access-actions">
            <Link href="/dashboard/organization">Review team access</Link>
            <Link href="/billing">View plan &amp; benefits</Link>
          </div>
        </div>
      </main>
    );
  }
  return (
    <GuestsWorkspace
      key={outlet.id}
      organizationId={outlet.organizationId}
      outletId={outlet.id}
      outletName={outlet.name}
      initial={initial}
    />
  );
}
