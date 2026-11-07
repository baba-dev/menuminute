"use client";
import Link from "next/link";
import { Fragment } from "react";
import { workspaceBreadcrumb } from "./workspace-breadcrumb";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import {
  ConnectionIndicator,
  NewMenu,
  NotificationBell,
  PaletteTrigger,
  TillChip,
} from "./workspace-controls";

const compactLabels: Record<string, string> = {
  "Restaurant overview": "Overview",
  "Service Counter": "Orders",
  "Point of Sale": "POS",
  "Reports & Insights": "Reports",
  "Guest reviews": "Reviews",
  "Billing & plan": "Billing",
  "My account": "Account",
  "Dining floor": "Floor",
};

export function WorkspaceTopbar({
  userName,
  publicHref,
  previewError = false,
  assistantAction,
}: {
  userName: string;
  publicHref: string | null;
  previewError?: boolean;
  assistantAction?: React.ReactNode;
}) {
  const pathname = usePathname();
  const crumbs = workspaceBreadcrumb(pathname);
  const label = crumbs[crumbs.length - 1]?.label ?? "Workspace";
  const compactLabel = compactLabels[label] ?? label;
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
        {crumbs.map((crumb, index) => (
          <Fragment key={index}>
            <span
              aria-hidden="true"
              className={crumb.href ? "mm-crumb-parent-separator" : undefined}
            >
              /
            </span>
            {crumb.href ? (
              <Link href={crumb.href} className="mm-crumb-parent">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current={index === crumbs.length - 1 ? "page" : undefined}>
                <span className="mm-dashboard-page-full">{label}</span>
                <span className="mm-dashboard-page-short">{compactLabel}</span>
              </span>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="mm-dashboard-top-actions">
        <PaletteTrigger />
        <NewMenu />
        <TillChip />
        <ConnectionIndicator />
        <NotificationBell />
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
        {assistantAction}
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
