import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { listOrganizations } from "@/modules/organizations/service";
import { billingState } from "@/modules/billing/service";
import { getPlanSnapshot } from "@/modules/plans/usage";
import {
  buildBillingPageView,
  coercePlaySubscriptions,
  coerceSubscriptions,
  type BillingStateInput,
} from "@/modules/plans/billing-page";
import { BillingConsole } from "./billing-console";
import { isPlayClient } from "@/lib/app-distribution";
import "./billing.css";

export const metadata: Metadata = {
  title: "Billing & plan",
  description: "Your plan, limits, billing cycle and upgrades.",
  robots: { index: false, follow: false },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const query = await searchParams;
  const playClient = await isPlayClient();
  const session = await auth();
  if (!session) redirect("/login");
  const actor = { userId: session.user.id };
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);
  if (!outlet)
    return (
      <div className="bp">
        <div className="bp-empty">
          <h1>Billing &amp; plan</h1>
          <p>Create your first outlet to see your plan.</p>
          <Link href="/onboarding" className="bp-btn bp-btn--primary">
            Set up your first outlet
          </Link>
        </div>
      </div>
    );

  const [snapshot, organizations] = await Promise.all([
    getPlanSnapshot(actor, outlet.id),
    listOrganizations(actor),
  ]);
  if (!snapshot)
    return (
      <div className="bp">
        <div className="bp-empty" role="alert">
          <h1>Billing &amp; plan</h1>
          <p>We could not load your plan just now. Please refresh in a moment.</p>
        </div>
      </div>
    );

  // Payment controls are owner-only; everyone else sees a read-only plan overview.
  let billing: BillingStateInput | null = null;
  let billingUnavailable = false;
  if (snapshot.canManageBilling) {
    try {
      const state = await billingState(actor, snapshot.organizationId);
      billing = {
        isCommunityEdition: state.isCommunityEdition,
        billingEnabled: state.billingEnabled,
        kitchenCommerceEnabled: state.kitchenCommerceEnabled,
        playBillingEnabled: state.playBillingEnabled,
        playKitchenEnabled: state.playKitchenEnabled,
        playSkus: state.playSkus,
        subscriptions: coerceSubscriptions(state.subscriptions),
        playSubscriptions: coercePlaySubscriptions(state.playSubscriptions),
        grants: state.grants.map((g) => ({
          capability: g.capability,
          startsAt: g.startsAt,
          endsAt: g.endsAt,
          revokedAt: g.revokedAt,
        })),
      };
    } catch {
      billingUnavailable = true;
    }
  }

  const organizationName =
    organizations.find((o) => o.id === snapshot.organizationId)?.name ?? outlet.name;
  const view = buildBillingPageView({
    organizationName,
    plan: snapshot.plan,
    usage: snapshot.usage,
    intake: snapshot.intake,
    canManage: snapshot.canManageBilling,
    billing,
    billingUnavailable,
    lifecycle: snapshot.lifecycle,
    focus: typeof query.plan === "string" ? query.plan : null,
    playClient,
  });
  return (
    <BillingConsole view={view} organizationId={snapshot.organizationId} playClient={playClient} />
  );
}
