import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  listSubscriptionPlans,
  listSubscriptions,
  listEntitlementGrants,
  getFinancialAnalytics,
  updateSubscriptionPlan,
  issueEntitlementGrant,
  revokeEntitlementGrant,
  searchGrantTargets,
  extendEntitlementGrant,
} from "@/modules/admin/payments.service";
import { PaymentsConsole } from "./payments-console";
import type { GrantListResult, TargetSearchResult } from "./grant-studio";
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
    try {
      await revokeEntitlementGrant(currentActor, grantId, reason);
      return { ok: true } as const;
    } catch (error) {
      return { ok: false, message: grantFailureMessage(error) } as const;
    }
  }

  async function handleSearchTargets(query: string): Promise<TargetSearchResult> {
    "use server";
    const currentActor = await verifySuperAdmin();
    try {
      const targets = await searchGrantTargets(
        currentActor,
        typeof query === "string" ? query : ""
      );
      return { ok: true, targets };
    } catch {
      return { ok: false, message: "Organization search is currently unavailable." };
    }
  }

  async function handleListGrants(page: number, organizationId?: string): Promise<GrantListResult> {
    "use server";
    const currentActor = await verifySuperAdmin();
    try {
      const result = await listEntitlementGrants(currentActor, {
        page: Number.isInteger(page) ? Math.max(1, Math.min(10000, page)) : 1,
        limit: 50,
        organizationId: organizationId && organizationId.length < 255 ? organizationId : undefined,
      });
      return { ok: true, grants: result.grants, total: result.total, page: result.page };
    } catch {
      return { ok: false, message: "Grant history could not be retrieved." };
    }
  }

  async function handleRenewGrant(data: {
    grantId: string;
    expectedEndsAt: string;
    newEndsAt: string;
    reason: string;
  }): Promise<GrantActionResult> {
    "use server";
    const currentActor = await verifySuperAdmin();
    try {
      await extendEntitlementGrant(currentActor, data);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: grantFailureMessage(error) };
    }
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
        grantsTotal={grantsRes.total}
        financials={financials}
        onUpdatePlan={handleUpdatePlan}
        onIssueGrant={handleIssueGrant}
        onRevokeGrant={handleRevokeGrant}
        onRenewGrant={handleRenewGrant}
        onSearchTargets={handleSearchTargets}
        onListGrants={handleListGrants}
      />
    </div>
  );
}
