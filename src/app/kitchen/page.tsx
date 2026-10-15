import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChefHat, ArrowLeft, Clock, Volume2, ShieldAlert } from "lucide-react";

export const metadata = {
  title: "Kitchen Display System (Upcoming) — MenuMinute",
  description: "Live order acceptance and preparation workflow for kitchen staff.",
};

export default async function KitchenPage() {
  if (!(await auth())?.user.id) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col bg-stone-900 text-stone-100">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-stone-800 bg-stone-950 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600">
            <ChefHat className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-base font-bold tracking-tight text-white">
              Kitchen Display System
              <span className="rounded-full border border-stone-700 bg-stone-800 px-2 py-0.5 text-[11px] font-semibold text-stone-300">
                Phase D Preview
              </span>
            </h1>
            <p className="text-xs text-stone-400">MenuMinute Kitchen Pro Suite</p>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800/60 px-3 py-1.5 text-xs font-medium text-stone-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
      </header>

      {/* Main upcoming state showcase */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-950/60 p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
            <ChefHat className="h-8 w-8" />
          </div>

          <span className="mb-3 inline-block rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
            Planned Kitchen Pro Feature (₹299/mo)
          </span>

          <h2 className="text-xl font-bold text-white">Kitchen Dashboard Coming in Phase D</h2>

          <p className="mt-2 text-xs leading-relaxed text-stone-400">
            The full Kitchen Display System (KDS) is planned for Phase D after Online Ordering
            (Phase C) is launched. It will provide a dedicated tablet and PC interface for kitchen
            staff.
          </p>

          <div className="mt-6 space-y-3 rounded-xl border border-stone-800 bg-stone-900/80 p-4 text-left">
            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
              <div>
                <p className="text-xs font-medium text-stone-200">Live Ticket Workflow</p>
                <p className="text-[11px] text-stone-400">
                  Pending → Accepted → Preparing → Ready ticket stages with timers.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
              <div>
                <p className="text-xs font-medium text-stone-200">Audible Alerts</p>
                <p className="text-[11px] text-stone-400">
                  Sound chimes on new incoming tickets so staff never miss an order.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
              <div>
                <p className="text-xs font-medium text-stone-200">Role-Scoped Device Access</p>
                <p className="text-[11px] text-stone-400">
                  Locked station mode for kitchen tablets without admin settings access.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-stone-800 pt-4">
            <Link
              href="/dashboard"
              className="text-xs font-medium text-orange-400 hover:text-orange-300"
            >
              ← Return to Restaurant Management
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
