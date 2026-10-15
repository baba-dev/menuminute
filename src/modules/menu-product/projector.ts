import { availableNow, type MenuDocument } from "./contracts";
import type { PublicProduct } from "./service";
export function projectMenu(
  document: MenuDocument,
  timezone: string,
  now: Date,
  overrides: PublicProduct["menus"][number]["overrides"]
) {
  const open = availableNow(document.schedule, timezone, now);
  return {
    ...document,
    open,
    categories: document.categories
      .filter((c) => !c.archived)
      .map((c) => ({
        ...c,
        items: c.items
          .filter((i) => !i.archived)
          .map((i) => {
            const o = overrides.find((o) => o.dishId === i.id);
            return {
              ...i,
              priceMinor: o?.priceMinor ?? i.priceMinor,
              soldOut: o?.soldOut ?? i.soldOut,
              open: open && availableNow(i.schedule, timezone, now),
            };
          }),
      })),
  };
}
