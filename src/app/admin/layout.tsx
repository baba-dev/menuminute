import { verifySuperAdmin } from "@/lib/admin-guard";
import { authServer } from "@/lib/auth";
import { SessionContinuity } from "@/components/auth/session-continuity";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ShieldAlert,
  Activity,
  Users,
  Building2,
  CreditCard,
  ChefHat,
  Lock,
  ArrowLeft,
  LogOut,
  ShieldCheck,
  Server,
  Layers,
} from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await verifySuperAdmin();
  const isProd = process.env.NODE_ENV === "production";

  return (
    <div className="flex min-h-screen flex-col bg-stone-950 font-sans text-stone-100 md:flex-row">
      <SessionContinuity />
      {/* Admin Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-r border-stone-800 bg-stone-900 md:w-64">
        {/* Brand & Mode Header */}
        <div className="border-b border-stone-800 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-white shadow-md shadow-orange-950">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-bold tracking-tight text-white">
                MenuMinute Admin
              </span>
              <span className="block text-[10px] font-semibold tracking-wider text-orange-400 uppercase">
                Control Plane
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded border border-stone-700 bg-stone-950/60 px-2.5 py-1.5 text-[11px]">
            <span className="flex items-center gap-1.5 text-stone-400">
              <Server className="h-3.5 w-3.5 text-stone-500" />
              Environment
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                isProd
                  ? "border border-red-800 bg-red-950 text-red-400"
                  : "border border-emerald-800 bg-emerald-950 text-emerald-400"
              }`}
            >
              {process.env.NODE_ENV || "development"}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto p-3 text-xs font-medium">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-stone-300 transition hover:bg-stone-800 hover:text-white"
          >
            <Activity className="h-4 w-4 text-orange-500" />
            <span>Overview & KPIs</span>
          </Link>

          <Link
            href="/admin/system"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-stone-300 transition hover:bg-stone-800 hover:text-white"
          >
            <Layers className="h-4 w-4 text-amber-500" />
            <span>System & Queues</span>
          </Link>

          <Link
            href="/admin/users"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-stone-300 transition hover:bg-stone-800 hover:text-white"
          >
            <Users className="h-4 w-4 text-blue-400" />
            <span>Users & Accounts</span>
          </Link>

          <Link
            href="/admin/organizations"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-stone-300 transition hover:bg-stone-800 hover:text-white"
          >
            <Building2 className="h-4 w-4 text-purple-400" />
            <span>Organizations & Outlets</span>
          </Link>

          <Link
            href="/admin/payments"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-stone-300 transition hover:bg-stone-800 hover:text-white"
          >
            <CreditCard className="h-4 w-4 text-emerald-400" />
            <span>Payments & Grants</span>
          </Link>

          <Link
            href="/admin/kitchen"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-stone-300 transition hover:bg-stone-800 hover:text-white"
          >
            <ChefHat className="h-4 w-4 text-amber-400" />
            <span>Kitchen Control Desk</span>
          </Link>

          <Link
            href="/admin/security"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-stone-300 transition hover:bg-stone-800 hover:text-white"
          >
            <Lock className="h-4 w-4 text-red-400" />
            <span>Security & Audits</span>
          </Link>

          <div className="pt-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-950/40 px-3 py-2 text-stone-400 transition hover:bg-stone-800 hover:text-stone-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Restaurant Portal</span>
            </Link>
          </div>
        </nav>

        {/* Operator Profile Footer */}
        <div className="border-t border-stone-800 bg-stone-950/80 p-3.5">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <p className="truncate text-xs font-semibold text-stone-200">{actor.name}</p>
              </div>
              <p className="truncate text-[10px] text-stone-400">{actor.email}</p>
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
                title="Sign out of Admin"
                className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-800 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Administrative Workspace */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div
          className="border-b border-orange-900/60 bg-stone-900 px-4 py-2 text-xs text-stone-300"
          role="status"
        >
          Administrative changes require a single-use password and authenticator confirmation.{" "}
          <Link
            href="/account/security"
            className="font-semibold text-orange-300 underline underline-offset-2"
          >
            Confirm a privileged action
          </Link>{" "}
          before each change.
        </div>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
