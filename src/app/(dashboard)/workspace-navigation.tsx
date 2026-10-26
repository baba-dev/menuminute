"use client";

import Link from "next/link";
import type { DashboardNavigation } from "@/modules/menu-product/dashboard-data";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChefHat,
  LayoutDashboard,
  QrCode,
  Settings,
  ShoppingBag,
  ReceiptText,
  UtensilsCrossed,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Overview", Icon: LayoutDashboard },
  { href: "/dashboard/menu", label: "Menu Studio", Icon: UtensilsCrossed },
  { href: "/dashboard/qr-codes", label: "QR codes", Icon: QrCode },
  { href: "/dashboard/orders", label: "Orders", Icon: ShoppingBag, capability: "ordering" },
  { href: "/dashboard/pos", label: "The Till", Icon: ReceiptText },
  { href: "/kitchen", label: "Kitchen", Icon: ChefHat, capability: "kitchen" },
  {
    href: "/dashboard/organization",
    label: "Organization & access",
    Icon: Building2,
  },
  { href: "/dashboard/settings", label: "Settings", Icon: Settings },
] as const;

export function WorkspaceNavigation({ capabilities }: { capabilities?: DashboardNavigation }) {
  const pathname = usePathname();

  return (
    <nav className="mm-workspace-nav" aria-label="Workspace">
      <span className="mm-workspace-nav-label">Workspace</span>
      <div className="mm-workspace-nav-items">
        {links.map((item) => {
          const { href, label, Icon } = item;
          const capability = "capability" in item ? item.capability : undefined;
          const kitchenSetup = capability === "kitchen" && capabilities?.kitchenSetup === true;
          const kitchenUsable = capability === "kitchen" &&
            (capabilities?.kitchenOperational === true || kitchenSetup);
          const unavailable = capability === "kitchen"
            ? !kitchenUsable
            : capability === "ordering"
              ? !capabilities?.ordering || !capabilities.ordersRead
              : false;
          const visibleLabel = kitchenSetup && !capabilities?.kitchenOperational
            ? "Kitchen Setup" : label;
          const selected =
            href === "/dashboard"
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");
          return unavailable ? (
            <span key={href} className="mm-workspace-nav-link is-unavailable" aria-disabled="true">
              <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
              <span>{visibleLabel}</span>
              <small>
                {!capabilities
                  ? "Availability unknown"
                  : (capability === "kitchen" ? !capabilities.kitchenOperational : !capabilities[capability!])
                    ? "Not enabled"
                    : "Access required"}
              </small>
            </span>
          ) : (
            <Link
              key={href}
              href={href}
              className={"mm-workspace-nav-link" + (selected ? " is-active" : "")}
              aria-current={selected ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.9} aria-hidden="true" />
              <span>{visibleLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
