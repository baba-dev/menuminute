/** Dashboard counts reflect the guest-visible published projection, never mutable drafts. */
export type MenuRow = { archived: boolean; revision: number; publishedRevision: number | null };
export type MenuQr = {
  isActive: boolean;
  purpose: string;
  tableId: string | null;
  destinationToken: string;
};
export type ReleasedProjection = {
  menus: { document: { categories: { archived?: boolean; items: { archived?: boolean }[] }[] } }[];
};

export function preferredMenuQr(codes: readonly MenuQr[]) {
  const active = codes.filter((code) => code.isActive && code.purpose === "menu");
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
