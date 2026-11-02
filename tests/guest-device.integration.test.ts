import { describe, expect, it } from "vitest";

import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { commandMenu } from "../src/modules/menu-product/service";
import { submitGuestOrder } from "../src/modules/orders/service";
import {
  forgetDevice,
  hashDeviceToken,
  lookupSavedContact,
  newDeviceToken,
  rememberDevice,
} from "../src/modules/guest-device/service";
import { getPool } from "../src/db";
import { env } from "../src/lib/config/env";

// The parsed env is a plain object; the flag defaults off, so enable it for this suite only.
(env as { PUBLIC_DINER_DEVICE_ENABLED: boolean }).PUBLIC_DINER_DEVICE_ENABLED = true;

async function publishedOutlet() {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Device menu",
        currency: f.outlet.currency,
        categories: [
          { id: "food", name: "Food", items: [{ id: "plate", name: "Plate", priceMinor: 10000 }] },
        ],
      },
    },
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 1,
    action: "publish",
    data: {},
  });
  return f;
}

describe("diner device profile (migration 0101)", () => {
  it("remembers, looks up, scopes to one organization and forgets", async () => {
    const a = await publishedOutlet();
    const b = await publishedOutlet();
    const cookie = newDeviceToken();
    await rememberDevice(
      { token: a.outlet.publicId, name: "Asha", phone: "+919876543210" },
      cookie
    );
    expect(await lookupSavedContact(a.outlet.publicId, cookie)).toEqual({
      name: "Asha",
      phone: "+919876543210",
    });
    // Another restaurant never sees this device, and a malformed or unknown cookie is just "none".
    expect(await lookupSavedContact(b.outlet.publicId, cookie)).toBeNull();
    expect(await lookupSavedContact(a.outlet.publicId, "not-a-token")).toBeNull();
    expect(await lookupSavedContact(a.outlet.publicId, newDeviceToken())).toBeNull();
    await expect(
      rememberDevice({ token: b.outlet.publicId, name: "Hijack", phone: "" }, cookie)
    ).rejects.toThrow();

    expect(await forgetDevice(cookie)).toBe(true);
    expect(await lookupSavedContact(a.outlet.publicId, cookie)).toBeNull();
    await admin(async (_db, pool) => {
      const row = (
        await pool.query(
          "select display_name,phone,revoked_at from guest_devices where token_hash=$1",
          [hashDeviceToken(cookie)]
        )
      ).rows[0];
      expect(row.display_name).toBe("");
      expect(row.phone).toBe("");
      expect(row.revoked_at).not.toBeNull();
    });
    // A revoked device cannot be silently revived by a stale cookie.
    await expect(
      rememberDevice({ token: a.outlet.publicId, name: "Back", phone: "" }, cookie)
    ).rejects.toThrow();
  });

  it("validates input, hides the table from application roles and refuses the demo tenant", async () => {
    const f = await publishedOutlet();
    await expect(
      rememberDevice({ token: f.outlet.publicId, name: "", phone: "" }, newDeviceToken())
    ).rejects.toThrow();
    await expect(
      rememberDevice({ token: f.outlet.publicId, name: "A", phone: "12ab" }, newDeviceToken())
    ).rejects.toThrow();
    await expect(getPool().query("select * from guest_devices")).rejects.toThrow();
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set is_demo_data=true where id=$1", [f.outlet.id]);
    });
    await expect(
      rememberDevice({ token: f.outlet.publicId, name: "Demo", phone: "" }, newDeviceToken())
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("prunes expired devices", async () => {
    const f = await publishedOutlet();
    const cookie = newDeviceToken();
    await rememberDevice({ token: f.outlet.publicId, name: "Old", phone: "" }, cookie);
    await admin(async (_db, pool) => {
      await pool.query(
        "update guest_devices set expires_at=now()-interval '1 day' where token_hash=$1",
        [hashDeviceToken(cookie)]
      );
      const removed = (await pool.query("select app_private.guest_device_prune() as n")).rows[0].n;
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(
        (
          await pool.query("select 1 from guest_devices where token_hash=$1", [
            hashDeviceToken(cookie),
          ])
        ).rowCount
      ).toBe(0);
    });
  });

  it("fills a blank order contact from the saved device on the server", async () => {
    const f = await publishedOutlet();
    await admin(async (_db, pool) =>
      applyEntitlement(pool, {
        key: crypto.randomUUID(),
        organizationId: f.outlet.organizationId,
        operator: "device-test",
        reason: "Device integration",
        action: "grant",
        capability: "ordering.new",
        billingCurrency: "USD",
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 3600000).toISOString(),
      })
    );
    const cookie = newDeviceToken();
    await rememberDevice(
      { token: f.outlet.publicId, name: "Asha", phone: "+919876543210" },
      cookie
    );
    const order = (extra: object) => ({
      clientSubmissionKey: crypto.randomUUID(),
      quotedTotalMinor: 10000,
      fulfillmentMode: "dine_in",
      items: [{ dishId: "plate", quantity: 1 }],
      ...extra,
    });
    const placed = await submitGuestOrder(f.outlet.publicId, order({ useSavedContact: true }), {
      deviceCookie: cookie,
    });
    const anonymous = await submitGuestOrder(f.outlet.publicId, order({ useSavedContact: true }), {
      deviceCookie: newDeviceToken(),
    });
    await admin(async (_db, pool) => {
      const rows = await pool.query(
        "select id,customer_name,customer_phone from orders where id = any($1)",
        [[placed.orderId, anonymous.orderId]]
      );
      const byId = Object.fromEntries(rows.rows.map((r) => [r.id, r]));
      expect(byId[placed.orderId].customer_name).toBe("Asha");
      expect(byId[placed.orderId].customer_phone).toBe("+919876543210");
      expect(byId[anonymous.orderId].customer_name).toBeNull();
      expect(byId[anonymous.orderId].customer_phone).toBeNull();
    });
  });
});
