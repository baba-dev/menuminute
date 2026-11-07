/** These are display-only counts. A disabled POS must not make a published menu look empty. */
export type PosPublishedSummary = { menus: number; dishes: number };

type PosMenuItems = {
  categories: readonly { items: readonly { id: string }[] }[];
};

export function resolvePosDisplayTotals(
  enabled: boolean,
  checkoutMenus: readonly PosMenuItems[],
  publishedSummary?: PosPublishedSummary | null
): { menus: number | null; dishes: number | null } {
  if (publishedSummary) return publishedSummary;
  if (!enabled) return { menus: null, dishes: null };
  const dishes = new Set(
    checkoutMenus.flatMap((menu) =>
      menu.categories.flatMap((category) => category.items.map((item) => item.id))
    )
  );
  return { menus: checkoutMenus.length, dishes: dishes.size };
}
