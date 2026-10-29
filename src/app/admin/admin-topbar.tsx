"use client";

import { usePathname } from "next/navigation";
import { AdminAppearanceControl } from "./admin-appearance-control";
import { Server, ShieldCheck, ChevronRight } from "lucide-react";

interface AdminTopbarProps {
  actorName: string;
  actorEmail: string;
  isProd: boolean;
}

const sectionTitles: Record<string, string> = {
  "/admin": "Platform Overview & KPIs",
  "/admin/system": "System & Queues",
  "/admin/logs": "Logs & Diagnostics",
  "/admin/users": "Users & Accounts Directory",
  "/admin/organizations": "Organizations & Tenancy",
  "/admin/payments": "Payments & Entitlement Grants",
  "/admin/kitchen": "Kitchen Control Desk",
  "/admin/security": "Security & Privileged Audits",
};

export function AdminTopbar({ actorName, actorEmail, isProd }: AdminTopbarProps) {
  const pathname = usePathname();

  const currentTitle =
    sectionTitles[pathname] ??
    Object.entries(sectionTitles).find(
      ([prefix]) => prefix !== "/admin" && pathname.startsWith(prefix)
    )?.[1] ??
    "Control Plane";

  const initials = actorName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "SA";

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-stone-200/80 bg-white/95 px-4 backdrop-blur-sm sm:px-6 dark:border-stone-800 dark:bg-stone-900/95">
      {/* Breadcrumb Section */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold text-stone-500 dark:text-stone-400">Admin</span>
        <ChevronRight className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500" aria-hidden="true" />
        <span className="font-bold text-stone-900 dark:text-stone-100" aria-current="page">
          {currentTitle}
        </span>
      </nav>

      {/* Top Actions: Environment, Theme Toggle, Operator Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Environment Badge */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium dark:border-stone-800 dark:bg-stone-950">
          <Server className="h-3 w-3 text-stone-500 dark:text-stone-400" />
          <span className="text-stone-600 dark:text-stone-400">Env:</span>
          <span
            className={`font-bold uppercase tracking-wider ${
              isProd
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {isProd ? "prod" : "dev"}
          </span>
        </div>

        {/* Global Light / Dark Toggle Switch */}
        <AdminAppearanceControl />

        {/* Superadmin Operator Chip */}
        <div
          className="flex items-center gap-2 rounded-xl border border-stone-200/90 bg-stone-50/80 py-1 pr-2.5 pl-1.5 dark:border-stone-800 dark:bg-stone-800/60"
          title={`Authenticated as ${actorName} (${actorEmail})`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 font-mono text-[11px] font-bold text-white shadow-xs">
            {initials}
          </div>
          <div className="hidden md:block text-left">
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span className="max-w-[120px] truncate text-xs font-semibold text-stone-800 dark:text-stone-200">
                {actorName}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
