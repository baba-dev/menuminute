import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { commandMenu } from "../src/modules/menu-product/service";
import { applyEntitlement } from "../src/modules/billing/operator";
import { posConfigure, posContext, posSubmit } from "../src/modules/pos/service";
import {
  getReceiptPaymentForPrint,
  saveOutletReceiptPayment,
} from "../src/modules/receipt-payment/service";

async function unpaidSale() {
  const f = await fixture("INR");
  const org = f.outlet.organizationId;
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "UPI receipt fixture",
        currency: "INR",
        categories: [
          { id: "main", name: "Main", items: [{ id: "plate", name: "Plate", priceMinor: 10000 }] },
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
  await admin(async (_db, pool) => {
    await applyEntitlement(pool, {
      key: crypto.randomUUID(),
      organizationId: org,
      operator: "receipt-upi-integration",
      reason: "Local integration validation of POS receipts",
      action: "grant",
      capability: "ordering.new",
      billingCurrency: "INR",
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
  });
  const ctx = await posContext(f.actor, org, f.outlet.id);
  await posConfigure(f.actor, org, f.outlet.id, {
    expectedRevision: ctx.revision,
    enabled: true,
    legalName: "Fixture Registered Seller",
    registeredAddress: "Registered test seller address, Rajasthan",
    country: "IN",
    taxRegime: "requires_review",
    taxRegistration: "08ABCDE1234F1Z5",
  });
  await saveOutletReceiptPayment(f.actor, org, f.outlet.id, {
    expectedRevision: 0,
    upiId: "chai@okhdfc",
    payeeName: "Chai Corner",
    enabled: true,
  });
  const sale = await posSubmit(f.actor, org, f.outlet.id, {
    key: crypto.randomUUID(),
    selection: {
      menuId,
      expectedRevision: 2,
      lines: [{ dishId: "plate", variantId: null, groups: [], quantity: 1 }],
    },
    fulfillmentMode: "dine_in",
    tableId: null,
    expectedSubtotalMinor: "10000",
    markAsPaid: false,
    paymentMethod: null,
  });
  return { ...f, org, saleId: sale.saleId };
}

describe("receipt payment profile for printing, tied to the order's state (real PostgreSQL)", () => {
  it("offers the profile for a live unpaid sale", async () => {
    const f = await unpaidSale();
    expect(await getReceiptPaymentForPrint(f.actor, f.org, f.outlet.id, f.saleId)).toMatchObject({
      configured: true,
      upiId: "chai@okhdfc",
      enabled: true,
    });
  });

  it.each(["cancelled", "rejected", "expired"])(
    "withholds it once the order is %s, so a dead bill never asks for payment",
    async (status) => {
      const f = await unpaidSale();
      await admin(async (_db, pool) => {
        await pool.query(
          "update orders set status=$2 where id=(select order_id from pos_sales where id=$1)",
          [f.saleId, status]
        );
      });
      expect(await getReceiptPaymentForPrint(f.actor, f.org, f.outlet.id, f.saleId)).toBeNull();
    }
  );

  it("withholds it for a sale that does not exist", async () => {
    const f = await unpaidSale();
    expect(
      await getReceiptPaymentForPrint(f.actor, f.org, f.outlet.id, crypto.randomUUID())
    ).toBeNull();
  });
});
