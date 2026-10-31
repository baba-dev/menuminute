import { describe, expect, it } from "vitest";
import { nanoid } from "nanoid";
import { admin, fixture } from "./helpers";
import { organizationMembers, outletGrants } from "../src/db/schema";
import {
  paletteIndex,
  shellCapabilities,
  shellSnapshot,
} from "../src/modules/dashboard/shell-data";

type Owner = Awaited<ReturnType<typeof fixture>>;

async function grant(owner: Owner, roles: string[]) {
  const user = await fixture();
  const memberId = nanoid();
  await admin(async (db) => {
    await db.insert(organizationMembers).values({
      id: memberId,
      organizationId: owner.outlet.organizationId,
      userId: user.actor.userId,
      role: "member",
    });
    await db.insert(outletGrants).values({
      organizationId: owner.outlet.organizationId,
      memberId,
      outletId: owner.outlet.id,
      roles,
    });
  });
  return user.actor;
}

async function states(actor: Owner["actor"], owner: Owner) {
  const org = owner.outlet.organizationId;
  const outlet = owner.outlet.id;
  const [snapshot, index, capabilities] = await Promise.all([
    shellSnapshot(actor, org, outlet, "INR"),
    paletteIndex(actor, org, outlet),
    shellCapabilities(actor, outlet),
  ]);
  return {
    shell: {
      pulse: snapshot.pulse.state,
      requests: snapshot.requests.state,
      till: snapshot.till.state,
    },
    palette: {
      dishes: index.dishes.state,
      tables: index.tables.state,
      orders: index.orders.state,
    },
    capabilities,
  };
}

describe("workspace shell data respects outlet roles", () => {
  it("gives an owner everything", async () => {
    const owner = await fixture();
    expect(await states(owner.actor, owner)).toEqual({
      shell: { pulse: "ready", requests: "ready", till: "ready" },
      palette: { dishes: "ready", tables: "ready", orders: "ready" },
      capabilities: { menuWrite: true, outletManage: true },
    });
  });

  it("gives a menu editor the dish index but no order, table, request or till data", async () => {
    const owner = await fixture();
    const editor = await grant(owner, ["menu_editor"]);
    expect(await states(editor, owner)).toEqual({
      shell: { pulse: "restricted", requests: "restricted", till: "restricted" },
      palette: { dishes: "ready", tables: "restricted", orders: "restricted" },
      capabilities: { menuWrite: true, outletManage: false },
    });
  });

  it("gives kitchen staff service data and dishes, but no till and no menu-write", async () => {
    const owner = await fixture();
    const kitchen = await grant(owner, ["kitchen"]);
    expect(await states(kitchen, owner)).toEqual({
      shell: { pulse: "ready", requests: "ready", till: "restricted" },
      palette: { dishes: "ready", tables: "ready", orders: "ready" },
      capabilities: { menuWrite: false, outletManage: false },
    });
  });

  it("reports an outsider as restricted everywhere, never as an outage or zero", async () => {
    const owner = await fixture();
    const outsider = await fixture();
    expect(await states(outsider.actor, owner)).toEqual({
      shell: { pulse: "restricted", requests: "restricted", till: "restricted" },
      palette: { dishes: "restricted", tables: "restricted", orders: "restricted" },
      capabilities: { menuWrite: false, outletManage: false },
    });
  });

  it("keeps the palette index free of customer details", async () => {
    const owner = await fixture();
    const index = await paletteIndex(owner.actor, owner.outlet.organizationId, owner.outlet.id);
    const text = JSON.stringify(index);
    for (const field of ["customerName", "customerPhone", "notes", "email"])
      expect(text).not.toContain(field);
  });
});
