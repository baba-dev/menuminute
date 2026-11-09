import sourceMenu from "@/data/demo/demo-menu.json";
import { menuDocumentSchema, type MenuDocument } from "@/modules/menu-product/contracts";
import { buildDemoOrders, type DemoOrder } from "@/modules/demo/history";

export const PLAY_REVIEW = Object.freeze({
  userId: "play-reviewer-owner-v1",
  userName: "Reviewer Account",
  outletId: "play-reviewer-droid-pie-v1",
  organizationId: "org-play-reviewer-droid-pie-v1",
  memberId: "member-play-reviewer-droid-pie-v1",
  menuId: "menu-play-reviewer-droid-pie-v1",
  publicId: "play-review-droid-pie-v1",
  outletName: "The Droid Pie",
} as const);

/** A separate real merchant tenant; never the shared/resetting public demo. */
export function buildPlayReviewMenu(): MenuDocument {
  const menu = menuDocumentSchema.parse(sourceMenu);
  const order = [
    "cat-italian",
    "cat-cafe-grill",
    "cat-soups-salads",
    "cat-starters",
    "cat-indo-chinese",
    "cat-desserts",
  ];
  const categories = order.flatMap((id) => {
    const found = menu.categories.find((category) => category.id === id);
    return found ? [{ ...found, items: found.items.slice(0, 12) }] : [];
  });
  const featured = categories.flatMap((category) => category.items).filter((dish) =>
    /pizza|lasagna|burger|fries|pasta|risotto/i.test(dish.name)
  );
  return menuDocumentSchema.parse({
    ...menu,
    name: "The Droid Pie",
    categories,
    presentation: {
      cover: "cafe-coffee",
      headline: "Pizza, comfort food and a little Android magic.",
      featuredDishIds: featured.slice(0, 6).map((dish) => dish.id),
    },
  });
}

export const PLAY_REVIEW_TABLES = Array.from({ length: 10 }, (_, i) => ({
  id: `play-review-table-${i + 1}`,
  number: String(i + 1),
  label: i === 8 ? "Window Booth" : i === 9 ? "Family Table" : `Table ${i + 1}`,
  capacity: i < 6 ? 2 : i < 9 ? 4 : 6,
}));

/** Synthetic, deterministic order history; it contains no real guests or payment credentials. */
export function buildPlayReviewOrders(now: Date = new Date()): DemoOrder[] {
  const generated = buildDemoOrders(buildPlayReviewMenu(), PLAY_REVIEW_TABLES.map((t) => t.id), now);
  const history = generated.filter((order) => !order.live);
  const recentByPeriod = history.filter((_, i) => i % 4 === 0).slice(-110);
  const live = generated.filter((order) => order.live);
  return [...recentByPeriod, ...live].map((order) => ({
    ...order,
    id: order.id.replace(/^demo-/, "play-review-"),
    intake: "guest_menu",
  }));
}
