import { it, expect } from "vitest";
import { fixture } from "./helpers";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoriesByRestaurant,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getMenuItemById,
  getFullMenu,
} from "../src/modules/menus/service";
it("preserves async category and item CRUD with scoped authorization", async () => {
  const { actor, outlet } = await fixture();
  const c = await createCategory(actor, outlet.id, { name: "Desserts" });
  expect((await updateCategory(actor, c.id, outlet.id, { name: "Artisan" })).name).toBe("Artisan");
  const item = await createMenuItem(actor, outlet.id, {
    categoryId: c.id,
    name: "Cake",
    priceRupees: 2.5,
  });
  expect(item.pricePaise).toBe(250);
  expect((await updateMenuItem(actor, item.id, outlet.id, { priceRupees: 3 })).pricePaise).toBe(
    300
  );
  await deleteMenuItem(actor, item.id, outlet.id);
  expect((await getMenuItemById(actor, item.id, outlet.id))?.isAvailable).toBe(false);
  expect((await getFullMenu(actor, outlet.id))[0]?.items).toHaveLength(1);
  await deleteCategory(actor, c.id, outlet.id);
  expect((await getCategoriesByRestaurant(actor, outlet.id))[0]?.isActive).toBe(false);
});
it.each([
  ["JPY", 25, 25],
  ["INR", 2.5, 250],
  ["OMR", 2.125, 2125],
])("stores %s minor units correctly", async (currency, value, minor) => {
  const { actor, outlet } = await fixture(currency as string);
  const category = await createCategory(actor, outlet.id, { name: "Prices" });
  expect(
    (
      await createMenuItem(actor, outlet.id, {
        categoryId: category.id,
        name: "Dish",
        priceRupees: value as number,
      })
    ).pricePaise
  ).toBe(minor);
});

it("rejects fractional minor units instead of silently rounding", async () => {
  const { actor, outlet } = await fixture("INR");
  const c = await createCategory(actor, outlet.id, { name: "Checked prices" });
  await expect(
    createMenuItem(actor, outlet.id, {
      categoryId: c.id,
      name: "Invalid price",
      priceRupees: 1.005,
    })
  ).rejects.toMatchObject({ statusCode: 422 });
});
