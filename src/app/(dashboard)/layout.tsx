import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { CircleHelp, ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ContextSwitcher } from "./context-switcher";
import { WorkspaceNavigation } from "./workspace-navigation";
import { WorkspaceTopbar } from "./workspace-topbar";
import { RouteFocus, WORKSPACE_MAIN_ID, WorkspaceSkipLink } from "./workspace-a11y";
import { WorkspaceShellProvider } from "./workspace-shell";
import { WorkspaceBottomBar } from "./workspace-bottom-bar";
import { CommandPalette } from "./command-palette";
import { NotificationDrawer } from "./notification-drawer";
import { shellCapabilities } from "@/modules/dashboard/shell-data";
import type { DashboardNavigation } from "@/modules/menu-product/dashboard-data";
import { ForbiddenError } from "@/lib/errors";
import {
  dashboardNavigation,
  dashboardPublicProjection,
  dashboardQrRows,
} from "@/modules/menu-product/dashboard-data";
import { preferredMenuQr } from "@/modules/menu-product/dashboard-summary";
import { auth } from "@/lib/auth";
import { DemoBanner } from "@/components/demo/demo-banner";
import { isDemoActor } from "@/modules/demo/guard";
import { SessionContinuity } from "@/components/auth/session-continuity";
import { VerifyEmailBanner } from "@/components/auth/verify-email-banner";
import {
  getDefaultOrActiveRestaurant,
  getRestaurantsByUserId,
} from "@/modules/restaurants/service";
import "./workspace.css";
import "./workspace-delight.css";
import "./workspace-ux.css";
import { env } from "@/lib/config/env";
import { EmberPopups } from "@/components/intelligence/ember-popups";
import { EmberLauncher } from "@/components/intelligence/ember-launcher";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");

  // The superadmin flag is independent of active-outlet discovery: avoid a
  // separate blocking database waterfall on every dashboard navigation.
  const [restaurant, outlets, adminRole] = await Promise.all([
    getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId),
    getRestaurantsByUserId(session.user.id),
    getDb().query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { isSuperAdmin: true },
    }),
  ]);
  const isSuperAdmin = Boolean(adminRole?.isSuperAdmin);
  let capabilities: DashboardNavigation | undefined;
  let menuWrite = false;
  let outletManage = false;
  let publicHref: string | null = null;
  let previewError = false;
  if (restaurant) {
    // Preview and optional paid navigation must not make menu, POS, orders or
    // settings inaccessible during unrelated dependency failures.
    const [navigationResult, extraResult, previewResult] = await Promise.allSettled([
      dashboardNavigation(
        { userId: session.user.id, sessionId: session.session.id },
        restaurant.organizationId,
        restaurant.id
      ),
      shellCapabilities({ userId: session.user.id, sessionId: session.session.id }, restaurant.id),
      (async () => {
        // QR lookup and public projection can run while capabilities are loading.
        // Preserve live public-projection semantics and independent failure handling.
        const qr = preferredMenuQr(await dashboardQrRows(session.user.id, restaurant.id));
        if (!qr) return null;
        const projection = await dashboardPublicProjection(qr.destinationToken);
        return projection?.menus.length ? "/m/" + encodeURIComponent(qr.destinationToken) : null;
      })(),
    ]);
    // Extra flags only decide which shortcuts to offer; the server re-checks every action.
    if (extraResult.status === "fulfilled") {
      menuWrite = extraResult.value.menuWrite;
      outletManage = extraResult.value.outletManage;
    }
    if (navigationResult.status === "fulfilled") {
      capabilities = navigationResult.value;
    } else {
      reportOptionalShellFailure("navigation", navigationResult.reason);
    }
    if (previewResult.status === "fulfilled") {
      publicHref = previewResult.value;
    } else {
      previewError = true;
      reportOptionalShellFailure("preview", previewResult.reason);
    }
  }
  const name = session.user.name || "Restaurant admin";
  const shellScope = restaurant
    ? {
        organizationId: restaurant.organizationId,
        outletId: restaurant.id,
        outletName: restaurant.name,
        currency: restaurant.currency ?? "INR",
        timezone: restaurant.timezone ?? "UTC",
      }
    : null;

  return (
    <WorkspaceShellProvider
      scope={shellScope}
      capabilities={capabilities}
      menuWrite={menuWrite}
      outletManage={outletManage}
      assistantEnabled={Boolean(restaurant && env.AI_ASSISTANT_READ_ONLY_ENABLED)}
    >
      <div className="mm-workspace-shell">
        <WorkspaceSkipLink />
        <RouteFocus />
        <SessionContinuity />
        <aside className="mm-workspace-sidebar" aria-label="Workspace sidebar">
          <div className="mm-workspace-brand">
            <Link href="/" aria-label="MenuMinute homepage" className="mm-workspace-brand-link">
              <Image
                src="/brand/logos/logo-horizontal-light.svg"
                alt="MenuMinute by BabaBuilds"
                width={175}
                height={43}
                className="mm-workspace-brand-light"
                priority
              />
              <Image
                src="/brand/logos/logo-horizontal-dark.svg"
                alt="MenuMinute by BabaBuilds"
                width={175}
                height={43}
                className="mm-workspace-brand-dark"
              />
            </Link>
          </div>
          {outlets.length > 1 && (
            <div className="mm-workspace-outlet">
              <span className="mm-workspace-caption">Current outlet</span>
              <ContextSwitcher outlets={outlets} selected={restaurant?.id} />
            </div>
          )}
          <WorkspaceNavigation capabilities={capabilities} isSuperAdmin={isSuperAdmin} />
          <div className="mm-workspace-sidebar-footer">
            <Link
              href="/help/owner"
              target="_blank"
              rel="noopener noreferrer"
              className="mm-workspace-nav-link mm-workspace-help-link"
              title="Open Restaurant Help & Guides in a new tab"
            >
              <CircleHelp size={19} strokeWidth={1.9} aria-hidden="true" />
              <span>Help &amp; guides</span>
              <ExternalLink size={14} className="mm-workspace-help-external" aria-hidden="true" />
            </Link>
          </div>
        </aside>
        <main id={WORKSPACE_MAIN_ID} className="mm-workspace-main" tabIndex={-1}>
          {!session.user.emailVerified && (
            <VerifyEmailBanner email={session.user.email} returnTo="/dashboard" />
          )}
          {isDemoActor(session.user.id) && <DemoBanner />}
          <WorkspaceTopbar
            userName={name}
            publicHref={publicHref}
            previewError={previewError}
            assistantAction={
              restaurant && env.AI_ASSISTANT_READ_ONLY_ENABLED ? (
                <EmberLauncher
                  key={restaurant.id}
                  organizationId={restaurant.organizationId}
                  outletId={restaurant.id}
                  outletName={restaurant.name}
                />
              ) : null
            }
          />
          {children}
        </main>
        <WorkspaceBottomBar isSuperAdmin={isSuperAdmin} publicHref={publicHref} />
        <CommandPalette />
        <NotificationDrawer />
        <EmberPopups />
      </div>
    </WorkspaceShellProvider>
  );
}

function reportOptionalShellFailure(service: "navigation" | "preview", error: unknown) {
  if (error instanceof ForbiddenError) return;
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  console.error("[dashboard] Optional workspace lookup unavailable", {
    service,
    kind: error instanceof Error ? error.name : "unknown",
    sqlstate: typeof code === "string" && /^[A-Z0-9]{5}$/.test(code) ? code : undefined,
  });
}
