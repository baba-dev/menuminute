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
  }) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return issueEntitlementGrant(currentActor, data);
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
