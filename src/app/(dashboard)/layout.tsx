import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut, ShieldAlert } from "lucide-react";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ContextSwitcher } from "./context-switcher";
import { WorkspaceNavigation } from "./workspace-navigation";
import { WorkspaceTopbar } from "./workspace-topbar";
import { getRestaurantQrCodes } from "@/modules/restaurants/service";
import { preferredMenuQr } from "@/modules/menu-product/dashboard-summary";
import { publicProduct } from "@/modules/menu-product/service";
import { auth, authServer } from "@/lib/auth";
import { SessionContinuity } from "@/components/auth/session-continuity";
import { needsMfaEnrollment } from "@/lib/privileged-access";
import {
  getDefaultOrActiveRestaurant,
  getRestaurantsByUserId,
} from "@/modules/restaurants/service";
import "./workspace.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  if (await needsMfaEnrollment(session.user.id, Boolean(session.user.twoFactorEnabled)))
    redirect("/account/security");

  const [restaurant, outlets] = await Promise.all([
    getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId),
    getRestaurantsByUserId(session.user.id),
  ]);
  const adminRole = await getDb().query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { isSuperAdmin: true },
  });
  const isSuperAdmin = Boolean(adminRole?.isSuperAdmin);
  const codes = restaurant ? await getRestaurantQrCodes({ userId: session.user.id }, restaurant.id) : [];
  const qr = preferredMenuQr(codes);
  const projection = qr ? await publicProduct(qr.destinationToken) : null;
  const publicHref = projection?.menus.length && qr ? "/m/" + encodeURIComponent(qr.destinationToken) : null;
  const name = session.user.name || "Restaurant admin";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join("")
    .toUpperCase();

  return (
    <div className="mm-workspace-shell">
      <SessionContinuity />
      <aside className="mm-workspace-sidebar">
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
        <div className="mm-workspace-outlet">
          <span className="mm-workspace-caption">Current outlet</span>
          <h2 className="mm-workspace-outlet-name">{restaurant?.name || "Set up an outlet"}</h2>
          <p className="mm-workspace-outlet-meta">
            {restaurant
              ? "Selected outlet · " + restaurant.currency
              : "Create an outlet to get started"}
          </p>
          <ContextSwitcher outlets={outlets} selected={restaurant?.id} />
        </div>
        <WorkspaceNavigation />
        {isSuperAdmin && (
          <Link href="/admin" className="mm-workspace-nav-link">
            <ShieldAlert size={19} aria-hidden="true" />
            <span>Platform admin</span>
          </Link>
        )}
        <div className="mm-workspace-profile">
          <Link href="/account" className="mm-workspace-profile-link">
            <span className="mm-workspace-avatar" aria-hidden="true">
              {initials || "MM"}
            </span>
            <span className="mm-workspace-profile-copy">
              <strong>{name}</strong>
              <small>Account &amp; security</small>
            </span>
          </Link>
          <form
            action={async () => {
              "use server";
              await authServer.api.signOut({ headers: await headers() });
              redirect("/login");
            }}
          >
            <button
              type="submit"
              className="mm-workspace-logout"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </form>
        </div>
      </aside>
      <main id="workspace-main" className="mm-workspace-main">
        <WorkspaceTopbar userName={name} publicHref={publicHref} />
        {children}
      </main>
    </div>
  );
}
