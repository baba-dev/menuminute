import { ContextSwitcher } from "./context-switcher";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { getRestaurantsByUserId } from "@/modules/restaurants/service";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, authServer } from "@/lib/auth";
import { needsMfaEnrollment } from "@/lib/privileged-access";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  QrCode,
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Settings,
  ChefHat,
  LogOut,
  Store,
  ShieldAlert,
} from "lucide-react";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  if (await needsMfaEnrollment(session.user.id, Boolean(session.user.twoFactorEnabled)))
    redirect("/account/security");
  const actor = { userId: session.user.id };
  const restaurant = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);
  const operator = await getDb().query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { isSuperAdmin: true },
  });
  const isSuperAdmin = Boolean(operator?.isSuperAdmin);

  return (
    <div className="flex min-h-screen flex-col bg-stone-100 md:flex-row">
      {/* Sidebar for Desktop */}
      <aside className="flex w-full shrink-0 flex-col border-r border-stone-200 bg-white md:w-64">
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-stone-200 p-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white">
              <QrCode className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-stone-900">
                MenuMinute
              </span>
              <span className="block text-[10px] font-medium text-stone-400">
                Restaurant Portal
              </span>
            </div>
          </Link>
          <ThemeControl />
        </div>

        {/* Current Restaurant Card */}
        {restaurant && (
          <div className="mx-3 my-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                <Store className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-stone-900">{restaurant.name}</p>
                <p className="truncate text-[10px] text-stone-500">
                  {restaurant.currency} • Menu management
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-stone-200 pt-2">
              <Link
                href="/dashboard/menu"
                className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 transition-colors hover:text-orange-700"
              >
                <span>Open Menu Studio</span>
              </Link>

              <span className="rounded-full border border-stone-300 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                Selected outlet
              </span>
            </div>
          </div>
        )}

        <ContextSwitcher
          outlets={await getRestaurantsByUserId(actor.userId)}
          selected={restaurant?.id}
        />
        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <LayoutDashboard className="h-4 w-4 text-stone-500" />
            <span>Overview</span>
          </Link>

          <Link
            href="/dashboard/menu"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <UtensilsCrossed className="h-4 w-4 text-stone-500" />
            <span>Menu Management</span>
          </Link>

          <Link
            href="/dashboard/qr-codes"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <QrCode className="h-4 w-4 text-stone-500" />
            <span>QR Codes</span>
          </Link>

          <Link
            href="/dashboard/orders"
            className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="h-4 w-4 text-stone-500" />
              <span>Orders</span>
            </div>
            <span className="rounded border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
              Planned
            </span>
          </Link>

          <Link
            href="/kitchen"
            className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <div className="flex items-center gap-2.5">
              <ChefHat className="h-4 w-4 text-stone-500" />
              <span>Kitchen Display</span>
            </div>
            <span className="rounded border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">
              Planned
            </span>
          </Link>

          <Link
            href="/dashboard/organization"
            className="block rounded-lg px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
          >
            Organization & access
          </Link>
          <Link
            href="/account"
            className="block rounded-lg px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
          >
            Account & security
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <Settings className="h-4 w-4 text-stone-500" />
            <span>Settings</span>
          </Link>

          {isSuperAdmin && (
            <div className="pt-2">
              <Link
                href="/admin"
                className="flex items-center gap-2.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700 shadow-sm transition hover:bg-orange-100"
              >
                <ShieldAlert className="h-4 w-4 text-orange-600" />
                <span>Platform Admin</span>
              </Link>
            </div>
          )}
        </nav>

        {/* User Footer / Logout */}
        <div className="border-t border-stone-200 bg-stone-50 p-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-stone-800">
                {session?.user?.name || "Restaurant Staff"}
              </p>
              <p className="truncate text-[10px] text-stone-500">
                {session?.user?.email || "staff@restaurant.com"}
              </p>
            </div>

            <form
              action={async () => {
                "use server";
                await authServer.api.signOut({ headers: await headers() });
                redirect("/login");
              }}
            >
              <button
                type="submit"
                title="Sign out"
                className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
