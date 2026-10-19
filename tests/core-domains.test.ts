import { it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import {
  manageOrganization,
  listOrganizations,
  organizationDetail,
} from "../src/modules/organizations/service";
import { withActor, withOutlet, type Actor } from "../src/modules/tenancy/service";
import { createCategory, createMenuItem } from "../src/modules/menus/service";
import { getPublicMenu, getRestaurantById } from "../src/modules/restaurants/service";
async function command(actor: Actor, org: string, action: string, data: Record<string, unknown>) {
  const version = (await listOrganizations(actor)).find((o) => o.id === org)!.version;
  return manageOrganization(actor, org, {
    key: crypto.randomUUID(),
    expectedVersion: version,
    command: { action, data },
  });
}
async function account() {
  const id = crypto.randomUUID();
  const email = `${id}@test.invalid`;
  await admin(async (_, p) => {
    await p.query(
      "insert into users(id,name,email,email_verified) values($1,'Domain member',$2,true)",
      [id, email]
    );
  });
  return { userId: id, email };
}
it("serializes commands, persists one audit/event for retries, rejects key reuse and stale writers", async () => {
  const { actor, outlet } = await fixture();
  const org = outlet.organizationId;
  const input = {
    key: crypto.randomUUID(),
    expectedVersion: 1,
    command: { action: "organization.rename", data: { name: "Renamed organization" } },
  };
  const [a, b] = await Promise.all([
    manageOrganization(actor, org, input),
    manageOrganization(actor, org, input),
  ]);
  expect(a).toEqual(b);
  expect(a.version).toBe(2);
  await expect(
    manageOrganization(actor, org, {
      ...input,
      command: { ...input.command, data: { name: "Different name" } },
    })
  ).rejects.toMatchObject({ statusCode: 409 });
  const competing = await Promise.allSettled(
    ["One writer", "Second writer"].map((name) =>
      manageOrganization(actor, org, {
        key: crypto.randomUUID(),
        expectedVersion: 2,
        command: { action: "organization.rename", data: { name } },
      })
    )
  );
  expect(competing.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const detail = await organizationDetail(actor, org);
  expect(detail.audit).toHaveLength(3);
  expect(detail.jobs).toHaveLength(3);
  expect(detail.organization.version).toBe(3);
});
it("checks current roles on every retry, prevents escalation and cross-tenant outlet/brand assignment", async () => {
  const { actor, outlet } = await fixture();
  const other = await fixture();
  const org = outlet.organizationId;
  const member = await account();
  const saved = await command(actor, org, "member.save", {
    email: member.email,
    role: "member",
    isActive: true,
  });
  await command(actor, org, "outlet.roles", {
    outletId: outlet.id,
    memberId: saved.memberId,
    roles: ["manager"],
  });
  await withOutlet(member, outlet.id, "outlet.manage", async () => true);
  await expect(
    command(member, org, "organization.rename", { name: "Escalated owner" })
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(
    command(member, org, "outlet.roles", {
      outletId: other.outlet.id,
      memberId: saved.memberId,
      roles: ["manager"],
    })
  ).rejects.toMatchObject({ statusCode: 403 });
  const input = {
    key: crypto.randomUUID(),
    expectedVersion: (await listOrganizations(actor))[0]!.version,
    command: { action: "outlet.update", data: { outletId: outlet.id, name: "Manager update" } },
  };
  await manageOrganization(member, org, input);
  await command(actor, org, "outlet.roles", {
    outletId: outlet.id,
    memberId: saved.memberId,
    roles: [],
  });
  await expect(manageOrganization(member, org, input)).rejects.toMatchObject({ statusCode: 403 });
  await expect(withOutlet(member, outlet.id, "menu.read", async () => true)).rejects.toMatchObject({
    statusCode: 403,
  });
  const brand = await command(actor, org, "brand.create", { name: "Shared brand" });
  await expect(
    command(actor, org, "brand.link", {
      brandId: brand.brandId,
      outletId: other.outlet.id,
      linked: true,
    })
  ).rejects.toMatchObject({ statusCode: 422 });
  await command(actor, org, "member.save", { email: member.email, role: "admin", isActive: true });
  await expect(
    command(member, org, "organization.active", { isActive: false })
  ).rejects.toMatchObject({ statusCode: 403 });
});
it("preserves permanent QR on outlet edits, enforces explicit currency repricing and scoped brands", async () => {
  const { actor, outlet } = await fixture("OMR");
  const org = outlet.organizationId;
  const second = await command(actor, org, "outlet.create", {
    name: "Second outlet",
    country: "OM",
    currency: "OMR",
    timezone: "Asia/Muscat",
    outletType: "cafe",
    fulfillmentModes: ["pickup"],
  });
  expect((await getRestaurantById(actor, String(second.outletId)))?.fulfillmentModes).toEqual([
    "pickup",
  ]);
  await expect(
    command(actor, org, "outlet.create", {
      name: "Invalid kitchen modes",
      country: "IN",
      currency: "INR",
      timezone: "Asia/Kolkata",
      outletType: "cloud_kitchen",
      fulfillmentModes: ["dine_in"],
    })
  ).rejects.toMatchObject({ statusCode: 422 });
  const brand = await command(actor, org, "brand.create", { name: "Multi-outlet brand" });
  for (const outletId of [outlet.id, String(second.outletId)])
    await command(actor, org, "brand.link", { brandId: brand.brandId, outletId, linked: true });
  await command(actor, org, "outlet.update", {
    outletId: outlet.id,
    name: "Different format",
    outletType: "mixed",
    fulfillmentModes: ["dine_in", "pickup"],
  });
  const edited = await getRestaurantById(actor, outlet.id);
  expect(edited?.publicId).toBe(outlet.publicId);
  const category = await createCategory(actor, outlet.id, { name: "Prices" });
  await createMenuItem(actor, outlet.id, {
    categoryId: category.id,
    name: "Priced dish",
    priceRupees: 0.123,
  });
  await expect(
    command(actor, org, "outlet.update", { outletId: outlet.id, currency: "INR" })
  ).rejects.toMatchObject({ statusCode: 422 });
  expect((await getRestaurantById(actor, outlet.id))?.currency).toBe("OMR");
  expect(
    (await organizationDetail(actor, org)).links.filter((l) => l.brandId === brand.brandId)
  ).toHaveLength(2);
  await expect(
    withActor(actor, (tx) =>
      tx.execute(sql`update restaurants set name='Bypassed' where id=${outlet.id}`)
    )
  ).rejects.toThrow();
});
it("suspends public/private access, lets only owner reactivate, transfers exactly one owner", async () => {
  const { actor, outlet } = await fixture();
  const org = outlet.organizationId;
  const member = await account();
  const m = await command(actor, org, "member.save", {
    email: member.email,
    role: "admin",
    isActive: true,
  });
  await admin(async (_, p) => {
    await p.query("update restaurants set is_published=true where id=$1", [outlet.id]);
  });
  expect(await getPublicMenu(outlet.publicId)).not.toBeNull();
  await command(actor, org, "organization.active", { isActive: false });
  expect(await getPublicMenu(outlet.publicId)).toBeNull();
  await expect(getRestaurantById(actor, outlet.id)).rejects.toMatchObject({ statusCode: 403 });
  expect((await listOrganizations(actor))[0]?.isActive).toBe(false);
  expect((await organizationDetail(actor, org)).organization.isActive).toBe(false);
  await expect(
    manageOrganization(member, org, {
      key: crypto.randomUUID(),
      expectedVersion: 3,
      command: { action: "organization.active", data: { isActive: true } },
    })
  ).rejects.toMatchObject({ statusCode: 403 });
  await command(actor, org, "organization.active", { isActive: true });
  expect(await getPublicMenu(outlet.publicId)).not.toBeNull();
  await command(actor, org, "owner.transfer", { memberId: m.memberId });
  expect((await listOrganizations(member))[0]?.role).toBe("owner");
  await expect(
    command(actor, org, "organization.active", { isActive: false })
  ).rejects.toMatchObject({ statusCode: 403 });
  await admin(async (_, p) =>
    expect(
      (
        await p.query(
          "select id from organization_members where organization_id=$1 and role='owner' and is_active",
          [org]
        )
      ).rowCount
    ).toBe(1)
  );
});
it("serializes the first price transaction against currency edits", async () => {
  const { actor, outlet } = await fixture("INR");
  const org = outlet.organizationId;
  const category = await createCategory(actor, outlet.id, { name: "Currency race" });
  let entered!: () => void;
  let release!: () => void;
  const checked = new Promise<void>((r) => (entered = r));
  const gate = new Promise<void>((r) => (release = r));
  const priced = withOutlet(actor, outlet.id, "menu.write", async (tx) => {
    await tx.execute(
      sql`insert into menu_items(id,restaurant_id,category_id,name,price_paise) values(${crypto.randomUUID()},${outlet.id},${category.id},'First price',123)`
    );
    entered();
    await gate;
  });
  await checked;
  let edited = false;
  const edit = command(actor, org, "outlet.update", {
    outletId: outlet.id,
    currency: "JPY",
  }).finally(() => {
    edited = true;
  });
  // Attach rejection immediately while the price transaction retains its shared lock.
  const outcome = edit.then(
    () => null,
    (e) => e
  );
  await new Promise((r) => setTimeout(r, 50));
  expect(edited).toBe(false);
  release();
  await priced;
  expect(await outcome).toMatchObject({ statusCode: 422 });
  expect((await getRestaurantById(actor, outlet.id))?.currency).toBe("INR");
});
