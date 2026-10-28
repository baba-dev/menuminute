/** The guest-facing published dish, not private draft edits, is the baseline for stock toggles. */
export type AvailabilityMenuDetail = {
  revision: number;
  canWrite?: boolean;
  publishedDocument?: {
    categories?: Array<{
      items?: Array<{ id: string; soldOut?: boolean }>;
    }>;
  } | null;
  overrides?: Array<{
    outletId: string;
    dishId: string;
    priceMinor: number | null;
    soldOut: boolean | null;
  }>;
};

export function resolveCurrentStock(
  detail: AvailabilityMenuDetail,
  dish: { id: string },
  outletId: string
) {
  const base = detail.publishedDocument?.categories
    ?.flatMap((category) => category.items ?? [])
    .find((item) => item.id === dish.id);
  if (!base) throw new Error("This dish is no longer in the published menu. Refresh and retry.");
  const override = detail.overrides?.find(
    (row) => row.outletId === outletId && row.dishId === dish.id
  );
  return {
    soldOut: override?.soldOut ?? Boolean(base.soldOut),
    priceMinor: override?.priceMinor ?? null,
  };
}
