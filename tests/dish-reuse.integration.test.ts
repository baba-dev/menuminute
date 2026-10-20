import { it, expect } from "vitest";
import { fixture } from "./helpers";
import { commandMenu, listReusableDishes } from "../src/modules/menu-product/service";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";
import { listOrganizations, manageOrganization } from "../src/modules/organizations/service";
const doc = (name: string, dish: string) =>
  menuDocumentSchema.parse({
    name,
    currency: "INR",
    categories: [
      {
        id: "main",
        name: "Main Course",
        items: [{ id: "d1", name: dish, priceMinor: 7777, description: "Private recipe" }],
      },
    ],
  });
async function create(
  actor: { userId: string },
  outletId: string,
  document: ReturnType<typeof doc>
) {
  const menuId = crypto.randomUUID();
  await commandMenu(actor, outletId, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: { document },
  });
  return menuId;
}
it("reuses only readable menus in the current organization, never private prices or another organization", async () => {
  const a = await fixture(),
    foreign = await fixture();
  const target = await create(a.actor, a.outlet.id, doc("Target", "Own Special"));
  await create(foreign.actor, foreign.outlet.id, doc("Foreign Secret", "Forbidden Curry"));
  const org = a.outlet.organizationId;
  const version = (await listOrganizations(a.actor))[0]!.version;
  const second = await manageOrganization(a.actor, org, {
    key: crypto.randomUUID(),
    expectedVersion: version,
    command: {
      action: "outlet.create",
      data: {
        name: "Second Kitchen",
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "takeout",
        fulfillmentModes: ["pickup"],
      },
    },
  });
  await create(a.actor, String(second.outletId), doc("Sibling Menu", "Shared Paneer"));
  const data = await listReusableDishes(a.actor, a.outlet.id, target);
  expect(data.some((x) => x.name === "Shared Paneer" && x.sourceMenu === "Sibling Menu")).toBe(
    true
  );
  expect(data.some((x) => x.name === "Forbidden Curry" || x.name === "Own Special")).toBe(false);
  expect(JSON.stringify(data)).not.toMatch(/7777|Private recipe|mediaId/);
  await expect(listReusableDishes(foreign.actor, a.outlet.id, target)).rejects.toMatchObject({
    statusCode: 403,
  });
  await expect(listReusableDishes(a.actor, a.outlet.id, "unknown-menu")).rejects.toMatchObject({
    statusCode: 404,
  });
});
