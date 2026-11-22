import { afterEach, describe, expect, it, vi } from "vitest";
import { nanoid } from "nanoid";
import { admin, fixture } from "./helpers";
import { createRestaurant } from "../src/modules/restaurants/service";
import { listOrganizations, manageOrganization } from "../src/modules/organizations/service";
import { provisionOnboarding, saveOnboarding } from "../src/modules/onboarding/service";
import { users } from "../src/db/schema";

const MESSAGE = "Tiffin outlets are not available yet";
const base = {
  name: "Home Chef Kitchen",
  country: "IN",
  currency: "INR",
  timezone: "Asia/Kolkata",
};

afterEach(() => vi.unstubAllEnvs());

async function owner() {
  const userId = nanoid();
  await admin(async (db) => {
    await db.insert(users).values({
      id: userId,
      email: `${userId}@test.invalid`,
      name: "Tiffin Owner",
      emailVerified: true,
    });
  });
  return { userId };
}

async function outletsOf(userId: string) {
  return admin(async (_db, pool) => {
    const r = await pool.query<{ n: number }>(
      `select count(*)::int as n from restaurants r
         join organization_members m on m.organization_id=r.organization_id where m.user_id=$1`,
      [userId]
    );
    return r.rows[0]!.n;
  });
}

describe("tiffin outlet type gate", () => {
  it("rejects createRestaurant tiffin when the flag is off and creates nothing", async () => {
    vi.stubEnv("TIFFIN_ENABLED", "false");
    const actor = await owner();
    await expect(
      createRestaurant(actor.userId, { ...base, outletType: "tiffin" })
    ).rejects.toMatchObject({ message: MESSAGE, statusCode: 422 });
    expect(await outletsOf(actor.userId)).toBe(0);
  });

  it("creates a pickup-only tiffin outlet when the flag is on", async () => {
    vi.stubEnv("TIFFIN_ENABLED", "true");
    const actor = await owner();
    const outlet = await createRestaurant(actor.userId, { ...base, outletType: "tiffin" });
    expect(outlet.outletType).toBe("tiffin");
    expect(outlet.fulfillmentModes).toEqual(["pickup"]);
  });

  it("rejects explicit non-pickup modes for tiffin even when enabled", async () => {
    vi.stubEnv("TIFFIN_ENABLED", "true");
    const actor = await owner();
    await expect(
      createRestaurant(actor.userId, {
        ...base,
        outletType: "tiffin",
        fulfillmentModes: ["dine_in"],
      })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(await outletsOf(actor.userId)).toBe(0);
  });

  it("leaves restaurant outlets unchanged in both flag states", async () => {
    for (const flag of ["false", "true"]) {
      vi.stubEnv("TIFFIN_ENABLED", flag);
      const actor = await owner();
      const outlet = await createRestaurant(actor.userId, { ...base, outletType: "restaurant" });
      expect(outlet.outletType).toBe("restaurant");
      expect(outlet.fulfillmentModes).toEqual(["dine_in"]);
    }
  });

  it("rejects tiffin in an onboarding draft when off, and at provisioning if the flag was turned off", async () => {
    const actor = await owner();
    vi.stubEnv("TIFFIN_ENABLED", "false");
    await expect(saveOnboarding(actor, { ...base, outletType: "tiffin" })).rejects.toMatchObject({
      message: MESSAGE,
    });
    vi.stubEnv("TIFFIN_ENABLED", "true");
    await saveOnboarding(actor, { ...base, outletType: "tiffin" });
    vi.stubEnv("TIFFIN_ENABLED", "false");
    await expect(provisionOnboarding(actor)).rejects.toMatchObject({ message: MESSAGE });
    expect(await outletsOf(actor.userId)).toBe(0);
    // The draft must not be stuck in provisioning after the rejection.
    const status = await admin(async (_d, pool) => {
      const r = await pool.query("select status from onboarding_progress where user_id=$1", [
        actor.userId,
      ]);
      return r.rows[0].status;
    });
    expect(status).toBe("draft");
  });

  it("gates organization outlet.create and outlet.update", async () => {
    const f = await fixture();
    const org = f.outlet.organizationId;
    const run = async (command: unknown) => {
      const version = (await listOrganizations(f.actor))[0]!.version;
      return manageOrganization(f.actor, org, {
        key: crypto.randomUUID(),
        expectedVersion: version,
        command,
      });
    };
    const countOutlets = () =>
      admin(async (_d, pool) =>
        Number(
          (
            await pool.query(
              "select count(*)::int as n from restaurants where organization_id=$1",
              [org]
            )
          ).rows[0].n
        )
      );
    vi.stubEnv("TIFFIN_ENABLED", "false");
    await expect(
      run({
        action: "outlet.create",
        data: { ...base, outletType: "tiffin", fulfillmentModes: ["pickup"] },
      })
    ).rejects.toMatchObject({ message: MESSAGE });
    expect(await countOutlets()).toBe(1);
    await expect(
      run({ action: "outlet.update", data: { outletId: f.outlet.id, outletType: "tiffin" } })
    ).rejects.toMatchObject({ message: MESSAGE });
    const unchanged = await admin(async (_d, pool) => {
      const r = await pool.query("select outlet_type from restaurants where id=$1", [f.outlet.id]);
      return r.rows[0].outlet_type;
    });
    expect(unchanged).toBe("restaurant");

    vi.stubEnv("TIFFIN_ENABLED", "true");
    const created = await run({
      action: "outlet.create",
      data: { ...base, outletType: "tiffin", fulfillmentModes: ["pickup"] },
    });
    expect(created.outletId).toBeTruthy();
    await expect(
      run({
        action: "outlet.create",
        data: { ...base, outletType: "tiffin", fulfillmentModes: ["dine_in"] },
      })
    ).rejects.toMatchObject({ statusCode: 422 });
    await run({ action: "outlet.update", data: { outletId: f.outlet.id, outletType: "tiffin" } });
    const updated = await admin(async (_d, pool) => {
      const r = await pool.query(
        "select outlet_type, fulfillment_modes from restaurants where id=$1",
        [f.outlet.id]
      );
      return r.rows[0];
    });
    expect(updated).toMatchObject({ outlet_type: "tiffin", fulfillment_modes: ["pickup"] });
  });

  it("keeps an existing tiffin outlet editable when the flag is off, but blocks converting to tiffin", async () => {
    vi.stubEnv("TIFFIN_ENABLED", "true");
    const f = await fixture();
    const org = f.outlet.organizationId;
    const run = async (command: unknown) => {
      const version = (await listOrganizations(f.actor))[0]!.version;
      return manageOrganization(f.actor, org, {
        key: crypto.randomUUID(),
        expectedVersion: version,
        command,
      });
    };
    const created = await run({
      action: "outlet.create",
      data: { ...base, outletType: "tiffin", fulfillmentModes: ["pickup"] },
    });
    const tiffinId = String(created.outletId);
    vi.stubEnv("TIFFIN_ENABLED", "false");
    await run({
      action: "outlet.update",
      data: { outletId: tiffinId, outletType: "tiffin", name: "Renamed Tiffin" },
    });
    const row = async (id: string) =>
      admin(async (_d, pool) => {
        const r = await pool.query("select name, outlet_type from restaurants where id=$1", [id]);
        return r.rows[0];
      });
    expect(await row(tiffinId)).toMatchObject({ name: "Renamed Tiffin", outlet_type: "tiffin" });
    await expect(
      run({ action: "outlet.update", data: { outletId: f.outlet.id, outletType: "tiffin" } })
    ).rejects.toMatchObject({ message: MESSAGE });
    expect((await row(f.outlet.id)).outlet_type).toBe("restaurant");
    await expect(
      run({
        action: "outlet.create",
        data: { ...base, outletType: "tiffin", fulfillmentModes: ["pickup"] },
      })
    ).rejects.toMatchObject({ message: MESSAGE });
    const n = await admin(async (_d, pool) =>
      Number(
        (
          await pool.query("select count(*)::int as n from restaurants where organization_id=$1", [
            org,
          ])
        ).rows[0].n
      )
    );
    expect(n).toBe(2);
  });
});
