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
  try {
    const initial = await listGuests(actor, outlet.organizationId, outlet.id, "", 0);
    return (
      <GuestsWorkspace
        key={outlet.id}
        organizationId={outlet.organizationId}
        outletId={outlet.id}
        outletName={outlet.name}
        initial={initial}
      />
    );
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
    return (
      <main className="guests-shell">
        <span className="guests-eyebrow">GUEST RELATIONSHIPS</span>
        <h1>Guests</h1>
        <div className="guests-empty">
          <h2>Guest CRM is included with paid plans</h2>
          <p>
            Ordering, Kitchen Pro and Dedicated subscribers can recognize returning guests and
            review their visit history. Your current account or outlet role cannot open this
            workspace.
          </p>
          <Link href="/pricing">View plans</Link>
        </div>
      </main>
    );
  }
}
