"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ThemeControl } from "@/components/menu-product/theme-control";

const labels: Record<string, string> = {
  "/dashboard": "Restaurant overview",
  "/dashboard/menu": "Menu Studio",
  "/dashboard/orders": "Service Counter",
  "/dashboard/kitchen": "Kitchen",
  "/dashboard/qr-codes": "QR Studio",
  "/dashboard/settings": "Settings",
  "/dashboard/pos": "Point of Sale",
  "/dashboard/organization": "Organization",
};
export function WorkspaceTopbar({
  userName,
  publicHref,
  previewError = false,
}: {
  userName: string;
  publicHref: string | null;
  previewError?: boolean;
}) {
  const pathname = usePathname();
  const label =
    labels[pathname] ??
    Object.entries(labels).find(
      ([path]) => path !== "/dashboard" && pathname.startsWith(path + "/")
    )?.[1] ??
    "Workspace";
  const initials = userName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="mm-dashboard-topbar mm-shared-topbar">
      <nav aria-label="Breadcrumb" className="mm-dashboard-breadcrumb">
        <span>Workspace</span>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{label}</span>
      </nav>
      <div className="mm-dashboard-top-actions">
        {publicHref ? (
          <Link
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mm-dashboard-preview"
          >
            Public menu <ExternalLink size={14} aria-hidden="true" />
          </Link>
        ) : (
          <span
            className="mm-dashboard-preview mm-dashboard-preview--unavailable"
            title={
              previewError
                ? "Public menu status cannot be checked right now"
                : "Publish your menu to enable the public menu"
            }
          >
            {previewError ? "Public menu temporarily unavailable" : "Public menu unavailable"}
          </span>
        )}
        <ThemeControl />
        <Link
          href="/account"
          className="mm-dashboard-user"
          aria-label={"Account settings for " + userName}
        >
          {initials || "MM"}
        </Link>
      </div>
    </div>
  );
}
