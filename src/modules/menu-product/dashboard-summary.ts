/** Dashboard counts reflect the guest-visible published projection, never mutable drafts. */
export type MenuRow = { archived: boolean; revision: number; publishedRevision: number | null };
export type MenuQr = {
  isActive: boolean;
  purpose: string;
  tableId: string | null;
  destinationToken: string;
  id?: string;
  createdAt?: Date | string;
};
export type ReleasedProjection = {
  menus: { document: { categories: { archived?: boolean; items: { archived?: boolean }[] }[] } }[];
};

export function preferredMenuQr(codes: readonly MenuQr[]) {
  const active = codes
    .filter((code) => code.isActive && code.purpose === "menu")
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime || (a.id ?? a.destinationToken).localeCompare(b.id ?? b.destinationToken);
    });
  return active.find((code) => code.tableId === null) ?? active[0] ?? null;
}

export function dashboardSummary(
  rows: readonly MenuRow[],
  codes: readonly MenuQr[],
  publicProjection: ReleasedProjection | null
) {
  const activeQrs = codes.filter((code) => code.purpose === "menu" && code.isActive);
  const published = activeQrs.length ? (publicProjection?.menus ?? []) : [];
  const visibleCategories = published.flatMap((menu) =>
    menu.document.categories.filter((category) => !category.archived)
  );
  return {
    draftCount: rows.filter(
      (row) =>
        !row.archived && (row.publishedRevision === null || row.revision > row.publishedRevision)
    ).length,
    publishedMenuCount: published.length,
    publishedCategoryCount: visibleCategories.length,
    publishedDishCount: visibleCategories.reduce(
      (total, category) => total + category.items.filter((item) => !item.archived).length,
      0
    ),
    activeQrCount: activeQrs.length,
    hasPublicMenu: published.length > 0,
  };
}

/** A setup indicator is earned only by a verifiable, outlet-scoped state. */
export function dashboardSetup(state: {
  hasOutlet: boolean;
  hasSavedMenu: boolean;
  hasPublicMenu: boolean;
  hasActiveQr: boolean;
}) {
  const checks = [
    { label: "Outlet configured", complete: state.hasOutlet },
    { label: "Menu created", complete: state.hasSavedMenu },
    { label: "Menu published", complete: state.hasPublicMenu },
    { label: "Active QR code", complete: state.hasActiveQr },
  ];
  const completed = checks.filter((check) => check.complete).length;
  return {
    checks,
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
  };
}
