/** Keep deep workspace routes discoverable without guessing from the final URL segment. */
export type WorkspaceCrumb = { label: string; href?: string };

const pages: Record<string, string> = {
  "/dashboard": "Restaurant overview",
  "/dashboard/get-started": "Getting started",
  "/dashboard/orders": "Service Counter",
  "/dashboard/pos": "Point of Sale",
  "/dashboard/floor": "Dining floor",
  "/dashboard/menu": "Menu Studio",
  "/dashboard/qr-codes": "QR Studio",
  "/dashboard/guests": "Guests",
  "/dashboard/reviews": "Guest reviews",
  "/dashboard/reports": "Reports & Insights",
  "/dashboard/organization": "Organization",
  "/dashboard/settings": "Settings",
  "/account": "My account",
  "/billing": "Billing & plan",
};

const nested: readonly { path: string; parent: string; label: string; prefix?: boolean }[] = [
  { path: "/dashboard/pos/ledger/documents/", parent: "/dashboard/pos/ledger", label: "Document", prefix: true },
  { path: "/dashboard/pos/receipts/", parent: "/dashboard/pos", label: "Receipt", prefix: true },
  { path: "/dashboard/menu/import/", parent: "/dashboard/menu/import", label: "Review import", prefix: true },
  { path: "/dashboard/pos/ledger", parent: "/dashboard/pos", label: "The Ledger" },
  { path: "/dashboard/pos/closing", parent: "/dashboard/pos", label: "Closing Desk" },
  { path: "/dashboard/pos/fiscal", parent: "/dashboard/pos", label: "GST draft review" },
  { path: "/dashboard/reports/z-report", parent: "/dashboard/reports", label: "Z report" },
  { path: "/dashboard/settings/device", parent: "/dashboard/settings", label: "Device & app" },
  { path: "/dashboard/settings/tax", parent: "/dashboard/settings", label: "Sales tax" },
  { path: "/dashboard/menu/import", parent: "/dashboard/menu", label: "Import menu" },
  { path: "/account/security", parent: "/account", label: "Security" },
];

export function workspaceBreadcrumb(pathname: string): WorkspaceCrumb[] {
  const path = pathname.replace(/\/+$/, "") || "/";
  const entry = nested.find((item) =>
    item.prefix ? path.startsWith(item.path) : path === item.path
  );
  if (!entry) return [{ label: pages[path] ?? "Workspace" }];
  const parent = workspaceBreadcrumb(entry.parent);
  return [
    ...parent.map((crumb, index) => ({
      ...crumb,
      href: index === parent.length - 1 ? entry.parent : crumb.href,
    })),
    { label: entry.label },
  ];
}
