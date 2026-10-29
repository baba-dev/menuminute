import { verifySuperAdmin } from "@/lib/admin-guard";
import { authServer } from "@/lib/auth";
import { SessionContinuity } from "@/components/auth/session-continuity";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, LogOut, ShieldAlert } from "lucide-react";
import { AdminNav } from "./admin-nav";
import { AdminTopbar } from "./admin-topbar";
import "./admin.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await verifySuperAdmin();
  const isProd = process.env.NODE_ENV === "production";

  return (
    <div className="admin-shell">
      <SessionContinuity />

      {/* Admin Sidebar */}
      <aside className="admin-sidebar">
        {/* Brand & Mode Header */}
        <div className="admin-brand-header">
          <Link
            href="/admin"
            className="flex items-center gap-3 transition-opacity hover:opacity-90"
            aria-label="MenuMinute Admin Control Plane"
          >
            <div className="relative">
              <Image
                src="/brand/logos/logo-horizontal-light.svg"
                alt="MenuMinute by BabaBuilds"
                width={145}
                height={35}
                className="block h-7 w-auto dark:hidden"
                priority
              />
              <Image
                src="/brand/logos/logo-horizontal-dark.svg"
                alt="MenuMinute by BabaBuilds"
                width={145}
                height={35}
                className="hidden h-7 w-auto dark:block"
                priority
              />
            </div>
            <span className="rounded-md border border-orange-200 bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-orange-700 uppercase dark:border-orange-800/80 dark:bg-orange-950/80 dark:text-orange-400">
              Admin
            </span>
          </Link>
        </div>

        {/* Dynamic Navigation with Active Link Tracking */}
        <AdminNav />

        {/* Operator Profile Footer */}
        <div className="border-t border-stone-200 bg-stone-50/70 p-3 dark:border-stone-800 dark:bg-stone-950/70">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="truncate text-xs font-semibold text-stone-800 dark:text-stone-200">
                  {actor.name}
                </p>
              </div>
              <p className="truncate font-mono text-[10px] text-stone-500 dark:text-stone-400">
                {actor.email}
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
                title="Sign out of Admin Control Plane"
                className="rounded-lg p-1.5 text-stone-500 transition hover:bg-stone-200 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Administrative Workspace */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Topbar with Breadcrumb, Theme Switcher & Operator Status */}
        <AdminTopbar actorName={actor.name} actorEmail={actor.email} isProd={isProd} />

        {/* Privileged Action Warning Banner (Hospitality Craft) */}
        <div
          className="flex items-center gap-2 border-b border-amber-200/90 bg-amber-50/90 px-4 py-2 text-xs text-amber-900 transition-colors sm:px-6 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="min-w-0 flex-1">
            Privileged actions require step-up authentication.{" "}
            <Link
              href="/account/security"
              className="font-semibold text-amber-950 underline underline-offset-2 hover:opacity-80 dark:text-amber-300"
            >
              Confirm a privileged action
            </Link>{" "}
            before submitting state modifications.
          </p>
        </div>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
