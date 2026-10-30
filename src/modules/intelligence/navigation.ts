/** Fixed first-party route IDs. Model content and user strings never become hrefs. */
export const navigation = {
  overview: { label: "Restaurant overview", href: "/dashboard" },
  menu: { label: "Menu Studio", href: "/dashboard/menu" },
  orders: { label: "Service Counter", href: "/dashboard/orders" },
  qr: { label: "QR Studio", href: "/dashboard/qr-codes" },
  settings: { label: "Outlet settings", href: "/dashboard/settings" },
  reports: { label: "Reports & Insights", href: "/dashboard/reports" },
  kitchen: { label: "Kitchen Pro", href: "/kitchen" },
  pos: { label: "Point of Sale", href: "/dashboard/pos" },
  import: { label: "Menu Import", href: "/dashboard/menu/import" },
} as const;
export type RouteId = keyof typeof navigation;
export function navigationForPermissions(p: {
  menuRead: boolean;
  ordersRead: boolean;
  menuWrite: boolean;
  reportsRead?: boolean;
  kitchenRead?: boolean;
  posRead?: boolean;
  importRead?: boolean;
}) {
  const allowed: RouteId[] = ["overview"];
  if (p.menuRead) allowed.push("menu", "qr");
  if (p.ordersRead) allowed.push("orders");
  if (p.menuWrite) allowed.push("settings");
  if (p.reportsRead) allowed.push("reports");
  if (p.kitchenRead) allowed.push("kitchen");
  if (p.posRead) allowed.push("pos");
  if (p.importRead) allowed.push("import");
  return allowed.map((id) => ({ id, ...navigation[id] }));
}
export function routesForEvidence(evidence: unknown, allowed: RouteId[]) {
  if (!Array.isArray(evidence)) return [];
  const ids = new Set<RouteId>();
  for (const item of evidence) {
    if (typeof item !== "object" || !item) continue;
    const name = "tool" in item ? item.tool : null;
    if (name === "orders.pulse" || name === "orders.history") ids.add("orders");
    if (name === "menu.summary" || name === "menu.findDish") ids.add("menu");
    if (name === "reports.summary") ids.add("reports");
    if (name === "kitchen.pulse") ids.add("kitchen");
    if (name === "finance.pulse") ids.add("pos");
    if (name === "imports.pulse") ids.add("import");
    if (name === "qr.pulse") ids.add("qr");
  }
  return [...ids].filter((id) => allowed.includes(id)).map((id) => ({ id, ...navigation[id] }));
}
