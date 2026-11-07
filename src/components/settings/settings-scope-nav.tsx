"use client";

import Link from "next/link";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { Building2, Store, UserRound } from "lucide-react";

const scopes = [
  { href: "/account", label: "My account", detail: "Identity and security", Icon: UserRound },
  {
    href: "/dashboard/settings",
    label: "Outlet settings",
    detail: "Guest-facing profile",
    Icon: Store,
  },
  {
    href: "/dashboard/organization",
    label: "Organization",
    detail: "People and permissions",
    Icon: Building2,
  },
] as const;

/** One compact settings switcher instead of large cards on three neighboring screens. */
export function SettingsScopeNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings areas" className={`mm-scope-nav ${className}`}>
      {scopes.map(({ href, label, detail, Icon }) => {
        const current = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={clsx("mm-scope-link", current && "is-current")}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
            <span className="sr-only"> — {detail}</span>
          </Link>
        );
      })}
    </nav>
  );
}
