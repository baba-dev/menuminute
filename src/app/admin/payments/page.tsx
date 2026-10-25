import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  listSubscriptionPlans,
  listSubscriptions,
  listEntitlementGrants,
  getFinancialAnalytics,
  updateSubscriptionPlan,
  issueEntitlementGrant,
  revokeEntitlementGrant,
} from "@/modules/admin/payments.service";
import { PaymentsConsole } from "./payments-console";
import { grantFailureMessage, type GrantActionResult } from "@/modules/admin/grant-feedback";

export default async function AdminPaymentsPage() {
  const actor = await verifySuperAdmin();

  const [plans, subscriptionsRes, grantsRes, financials] = await Promise.all([
    listSubscriptionPlans(),
    listSubscriptions(actor, { limit: 50 }),
    listEntitlementGrants(actor, { limit: 50 }),
    getFinancialAnalytics(actor),
  ]);

  async function handleUpdatePlan(planId: string, data: any) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return updateSubscriptionPlan(currentActor, planId, data);
  }

  async function handleIssueGrant(data: {
    organizationId: string;
    capability: "ordering.new" | "kitchen.new";
    billingCurrency: "USD" | "INR";
    startsAt: string;
    endsAt: string;
    reason: string;
  }): Promise<GrantActionResult> {
    "use server";
    // Authentication and Next.js redirects stay outside the recovery boundary.
    const currentActor = await verifySuperAdmin();
    try {
      await issueEntitlementGrant(currentActor, data);
      return { ok: true };
    } catch (error) {
      // Return only explicitly mapped, non-sensitive errors to production clients.
      return { ok: false, message: grantFailureMessage(error) };
    }
  }

  async function handleRevokeGrant(grantId: string, reason: string) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return revokeEntitlementGrant(currentActor, grantId, reason);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Payments, Billing & Entitlements
        </h1>
        <p className="text-xs text-stone-400">
          Operator entitlement grants engine, SaaS plans catalog, and multi-currency revenue
          analytics.
        </p>
      </div>

      <PaymentsConsole
        plans={plans}
        subscriptions={subscriptionsRes.subscriptions}
        grants={grantsRes.grants}
        financials={financials}
        onUpdatePlan={handleUpdatePlan}
        onIssueGrant={handleIssueGrant}
        onRevokeGrant={handleRevokeGrant}
      />
    </div>
  );
}
