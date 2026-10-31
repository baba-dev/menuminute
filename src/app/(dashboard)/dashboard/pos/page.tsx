import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { posWorkspace } from "@/modules/pos/service";
import { ForbiddenError } from "@/lib/errors";
import { OperationalPwa } from "@/components/pwa/operational-pwa";
import { pwaOperationalEnabledForOutlet } from "@/lib/pwa/rollout";
import { TheTill } from "./the-till";
import "./pos.css";
import "./pos-editorial.css";

export const metadata: Metadata = {
  title: "Point of Sale | MenuMinute POS",
  description: "Private restaurant point-of-sale and unified order workspace.",
  robots: { index: false, follow: false },
};

export default async function PosPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet)
    return (
      <main className="till-page">
        <h1>Select an outlet</h1>
        <Link href="/onboarding">Set up an outlet</Link>
      </main>
    );
  let workspace: Awaited<ReturnType<typeof posWorkspace>> | null = null;
  try {
    workspace = await posWorkspace(
      { userId: session.user.id, sessionId: session.session.id },
      outlet.organizationId,
      outlet.id
    );
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
  }
  if (!workspace)
    return (
      <main className="till-page">
        <h1>POS access required</h1>
        <p>Your current outlet assignment does not permit the Till.</p>
        <Link href="/dashboard">Return to dashboard</Link>
      </main>
    );
  return (
    <>
      {workspace.context.enabled && pwaOperationalEnabledForOutlet(outlet.id) ? (
        <OperationalPwa workspace="POS" />
      ) : null}
      <TheTill
        key={outlet.id}
        organizationId={outlet.organizationId}
        outletId={outlet.id}
        initial={workspace}
      />
    </>
  );
}
