import { sql } from "drizzle-orm";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
import {
  dashboardMenuRows,
  dashboardQrRows,
  dashboardPublicProjection,
  dashboardNavigation,
} from "@/modules/menu-product/dashboard-data";
import { preferredMenuQr, dashboardSummary } from "@/modules/menu-product/dashboard-summary";
import { posContext } from "@/modules/pos/service";

export type ReadinessCheck = {
  id: string;
  label: string;
  description: string;
  href: string;
  complete: boolean;
};
type Outlet = {
  id: string;
  organizationId: string;
  name: string;
  currency: string;
  country: string | null;
  timezone: string;
  onboardingGoal: string;
  fulfillmentModes: string[];
  serviceHours: unknown;
};

/**
 * Each check derives exclusively from persisted outlet state or the published
 * guest projection. Visiting a page, generating a draft menu shell, or selecting
 * a paid-feature goal never grants readiness credit.
 */
export async function outletSetupReadiness(actor: Actor, outlet: Outlet) {
  const [menus, codes, content] = await Promise.all([
    dashboardMenuRows(actor.userId, outlet.id),
    dashboardQrRows(actor.userId, outlet.id),
    withOutlet(actor, outlet.id, "menu.read", (tx) =>
      tx.execute<{ has_content: boolean; has_release: boolean }>(sql`select
        exists (
          select 1 from menus m
          where m.archived=false
            and (m.outlet_id=${outlet.id} or exists (
              select 1 from menu_assignments ma where ma.menu_id=m.id and ma.outlet_id=${outlet.id}
            ))
            and exists (
              select 1 from jsonb_array_elements(m.document->'categories') as category(value)
              cross join lateral jsonb_array_elements(category.value->'items') as dish(value)
              where coalesce(category.value->>'archived', 'false') <> 'true'
                and coalesce(dish.value->>'archived', 'false') <> 'true'
            )
        ) as has_content,
        exists (
          select 1 from menus m
          join menu_releases release on release.menu_id=m.id
            and release.revision=m.published_revision
          where m.archived=false
            and (m.outlet_id=${outlet.id} or exists (
              select 1 from menu_assignments ma where ma.menu_id=m.id and ma.outlet_id=${outlet.id}
            ))
            and exists (
              select 1 from jsonb_array_elements(release.document->'categories') as category(value)
              cross join lateral jsonb_array_elements(category.value->'items') as dish(value)
              where coalesce(category.value->>'archived', 'false') <> 'true'
                and coalesce(dish.value->>'archived', 'false') <> 'true'
            )
        ) as has_release`)
    ),
  ]);
  const primary = preferredMenuQr(codes);
  const projection = primary ? await dashboardPublicProjection(primary.destinationToken) : null;
  const summary = dashboardSummary(menus, codes, projection);
  const hasContent = content.rows[0]?.has_content === true;
  const hasPublishedRelease = content.rows[0]?.has_release === true;
  const serviceWindows =
    outlet.serviceHours &&
    typeof outlet.serviceHours === "object" &&
    "weekly" in outlet.serviceHours &&
    Array.isArray(outlet.serviceHours.weekly)
      ? outlet.serviceHours.weekly
      : [];
  const live = summary.hasPublicMenu && summary.publishedDishCount > 0;
  const checks: ReadinessCheck[] = [
    {
      id: "outlet",
      label: "Restaurant configured",
      description: "Saved restaurant identity, currency, location and timezone.",
      href: "/dashboard/settings",
      complete: Boolean(outlet.name && outlet.country && outlet.currency && outlet.timezone),
    },
    {
      id: "dishes",
      label: "Add real dishes",
      description: "A default empty menu does not count. Add a dish or import your existing menu.",
      href: "/dashboard/menu",
      complete: hasContent,
    },
    {
      id: "publish",
      label: "Publish a guest-facing menu",
      description: "Requires a committed release with a visible dish; private drafts never count.",
      href: "/dashboard/menu",
      complete: hasPublishedRelease,
    },
    {
      id: "qr",
      label: "Activate a guest-ready QR",
      description: "An active menu QR must resolve to a published, nonempty guest menu.",
      href: "/dashboard/qr-codes",
      complete: live && primary !== null,
    },
  ];
  if (outlet.onboardingGoal !== "qr_menu") {
    const nav = await dashboardNavigation(actor, outlet.organizationId, outlet.id).catch(
      () => null
    );
    checks.push({
      id: "ordering",
      label: "Prepare online ordering",
      description:
        "Ordering entitlement, selected service mode, and configured service hours must all be present.",
      href: "/dashboard/settings",
      complete:
        live &&
        nav?.ordering === true &&
        outlet.fulfillmentModes.length > 0 &&
        serviceWindows.length > 0,
    });
    if (outlet.onboardingGoal === "full_operations") {
      checks.push({
        id: "kitchen",
        label: "Make Kitchen Pro operational",
        description:
          "Requires live Kitchen Pro entitlement and an operational kitchen, not merely a setup choice.",
        href: "/dashboard/orders",
        complete: nav?.kitchen === true && nav.kitchenOperational === true,
      });
      const pos = await posContext(actor, outlet.organizationId, outlet.id).catch(() => null);
      checks.push({
        id: "pos",
        label: "Complete POS readiness",
        description:
          "POS must be enabled with a verified seller profile and a configured tax classification.",
        href: "/dashboard/pos",
        complete:
          pos?.enabled === true &&
          Boolean(pos.seller?.legalName && pos.seller?.registeredAddress) &&
          pos.seller?.taxRegime === "not_registered",
      });
    }
  }
  const completed = checks.filter((check) => check.complete).length;
  return {
    checks,
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
  };
}
