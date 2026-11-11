import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { posWorkspace } from "@/modules/pos/service";
import {
  dashboardMenuRows,
  dashboardPublicProjection,
  dashboardQrRows,
} from "@/modules/menu-product/dashboard-data";
import { dashboardSummary, preferredMenuQr } from "@/modules/menu-product/dashboard-summary";
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
        <p>Your current outlet assignment does not permit Point of Sale access.</p>
        <Link href="/dashboard">Return to dashboard</Link>
      </main>
    );
  // POS may deliberately have no checkout catalogue while disabled or in the public demo.
  // Read the same committed public projection as Overview rather than reporting false zeroes.
  // This is display-only: no new POS permissions or checkout actions are granted.
  const publishedSummary =
    !workspace.context.enabled || workspace.menus.length === 0
      ? await (async () => {
          try {
            const [rows, codes] = await Promise.all([
              dashboardMenuRows(session.user.id, outlet.id),
              dashboardQrRows(session.user.id, outlet.id),
            ]);
            const qr = preferredMenuQr(codes);
            const projection = qr ? await dashboardPublicProjection(qr.destinationToken) : null;
            const summary = dashboardSummary(rows, codes, projection);
            return { menus: summary.publishedMenuCount, dishes: summary.publishedDishCount };
          } catch {
            // Staff with POS access may not have menu.read; never expose cross-role data.
            return null;
          }
        })()
      : null;
  return (
    <>
      <TheTill
        key={outlet.id}
        organizationId={outlet.organizationId}
        outletId={outlet.id}
        initial={workspace}
        publishedSummary={publishedSummary}
      />
      {workspace.context.enabled && pwaOperationalEnabledForOutlet(outlet.id) ? (
        <OperationalPwa workspace="POS" />
      ) : null}
    </>
  );
}
