"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Store, UserRound } from "lucide-react";

const scopes = [
  {
    href: "/account",
    label: "My account",
    detail: "Identity, security and preferences",
    Icon: UserRound,
  },
  {
    href: "/dashboard/settings",
    label: "Outlet settings",
    detail: "This location and guest experience",
    Icon: Store,
  },
  {
    href: "/dashboard/organization",
    label: "Organization",
    detail: "Business, people, brands and billing",
    Icon: Building2,
  },
] as const;

export function SettingsScopeNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings areas"
      className={`grid gap-2 rounded-2xl border border-stone-200 bg-white/90 p-2 shadow-sm md:grid-cols-3 dark:border-stone-700 dark:bg-stone-900/90 ${className}`}
    >
      {scopes.map(({ href, label, detail, Icon }) => {
        const current =
          pathname === href || (href === "/account" && pathname.startsWith("/account/"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 ${
              current
                ? "border-orange-300 bg-orange-50 text-stone-950 dark:border-orange-700 dark:bg-orange-950/40 dark:text-stone-50"
                : "border-transparent text-stone-700 hover:border-stone-200 hover:bg-stone-50 dark:text-stone-200 dark:hover:border-stone-700 dark:hover:bg-stone-800"
            }`}
          >
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-lg ${
                current
                  ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white"
                  : "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200"
              }`}
            >
              <Icon size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block text-sm">{label}</strong>
              <small className="block text-xs leading-4 opacity-70">{detail}</small>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
