"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Layers,
  FileText,
  Users,
  Building2,
  CreditCard,
  ChefHat,
  Lock,
  ArrowLeft,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Overview & KPIs", icon: Activity },
  { href: "/admin/system", label: "System & Queues", icon: Layers },
  { href: "/admin/logs", label: "Logs & Diagnostics", icon: FileText },
  { href: "/admin/users", label: "Users & Accounts", icon: Users },
  { href: "/admin/organizations", label: "Organizations & Outlets", icon: Building2 },
  { href: "/admin/payments", label: "Payments & Grants", icon: CreditCard },
  { href: "/admin/kitchen", label: "Kitchen Control Desk", icon: ChefHat },
  { href: "/admin/security", label: "Security & Audits", icon: Lock },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin Navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(item.href + "/"));

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`admin-nav-link ${isActive ? "is-active" : ""}`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 transition-colors ${
                isActive
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-stone-400 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300"
              }`}
            />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}

      <div className="mt-2 border-t border-stone-200/80 pt-4 dark:border-stone-800">
        <Link
          href="/dashboard"
          className="admin-nav-link text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">Restaurant Portal</span>
        </Link>
      </div>
    </nav>
  );
}
