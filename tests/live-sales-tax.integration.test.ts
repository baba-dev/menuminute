import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { commandMenu } from "../src/modules/menu-product/service";
import { applyEntitlement } from "../src/modules/billing/operator";
import { submitGuestOrder } from "../src/modules/orders/service";
import { posConfigure, posContext, posSubmit, posReceipt } from "../src/modules/pos/service";
import { financeCommand, financeRead } from "../src/modules/pos/finance";
import { getOutletSalesTax, saveOutletSalesTax } from "../src/modules/tax/service";
import { publicCheckoutTaxPolicy } from "../src/modules/tax/checkout";
import { getPool } from "../src/db";

async function ready() {
  const f = await fixture("INR");
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Tax frozen order fixture",
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
      organizationId: f.outlet.organizationId,
      operator: "merchant-tax-integration",
      reason: "Local integration validation of guest ordering",
      action: "grant",
      capability: "ordering.new",
      billingCurrency: "INR",
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
  });
  const ctx = await posContext(f.actor, f.outlet.organizationId, f.outlet.id);
  await posConfigure(f.actor, f.outlet.organizationId, f.outlet.id, {
    expectedRevision: ctx.revision,
    enabled: true,
    legalName: "Fixture Registered Seller",
    registeredAddress: "Registered tax test seller address, Rajasthan",
    country: "IN",
    taxRegime: "requires_review",
    taxRegistration: "08ABCDE1234F1Z5",
  });
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into pos_tax_profiles(outlet_id,organization_id,mode,inclusive,tax_label) " +
        "values($1,$2,'classified',false,'Sales tax') on conflict(outlet_id) do update " +
        "set mode='classified',inclusive=false,tax_label='Sales tax'",
      [f.outlet.id, f.outlet.organizationId]
    );
    await pool.query(
      "insert into pos_tax_classes(outlet_id,dish_id,rate_bps,classification) " +
        "values($1,'plate',500,'996331') on conflict(outlet_id,dish_id) do update " +
        "set rate_bps=500,classification='996331'",
      [f.outlet.id]
    );
  });
  return { ...f, menuId };
}
const policy = (rateBps = 500) => ({
  status: "configured" as const,
  label: "Merchant sales tax",
  rateBps,
  inclusive: false,
});
const order = (total: number, revision?: number, key = crypto.randomUUID()) => ({
  clientSubmissionKey: key,
  quotedTotalMinor: total,
  ...(revision === undefined ? {} : { quotedTaxRevision: revision }),
  fulfillmentMode: "dine_in" as const,
  items: [{ dishId: "plate", quantity: 1 }],
});

describe("Live merchant checkout tax — real PostgreSQL/Redis", () => {
  it("preserves preview-only profiles and requires explicit merchant activation", async () => {
    const f = await ready();
    const saved = await saveOutletSalesTax(f.actor, f.outlet.organizationId, f.outlet.id, {
      expectedRevision: 0,
      confirmed: true,
      policy: policy(),
    });
    expect(saved).toMatchObject({ revision: 1, canChangeOrders: false });
    const guestPolicy = await publicCheckoutTaxPolicy(f.outlet.publicId);
    expect(guestPolicy).toMatchObject({ revision: 1, applied: false, rateBps: 0 });
    const created = await submitGuestOrder(f.outlet.publicId, order(10000));
    expect(created.totalMinor).toBe(10000);
    const snap = await admin(async (_db, pool) =>
      pool.query(
        "select applied,policy_revision,tax_minor from app_private.order_sales_tax_snapshots where order_id=$1",
        [created.orderId]
      )
    );
    expect(snap.rows[0]).toMatchObject({ applied: false, policy_revision: 1, tax_minor: "0" });
    await expect(
      getPool().query("select * from app_private.order_sales_tax_snapshots")
    ).rejects.toThrow();
    await expect(
      saveOutletSalesTax(f.actor, f.outlet.organizationId, f.outlet.id, {
        expectedRevision: 1,
        confirmed: true,
        policy: policy(),
        applyToOrders: true,
      })
    ).rejects.toThrow();
  });

  it("locks the live tax revision, keeps old totals and recovers idempotent guest replay", async () => {
    const f = await ready();
    const activated = await saveOutletSalesTax(f.actor, f.outlet.organizationId, f.outlet.id, {
      expectedRevision: 0,
      confirmed: true,
      policy: policy(),
      applyToOrders: true,
      confirmedLiveTax: true,
    });
    expect(activated).toMatchObject({ revision: 1, canChangeOrders: true });
    const publicPolicy = await publicCheckoutTaxPolicy(f.outlet.publicId);
    expect(publicPolicy).toMatchObject({ revision: 1, rateBps: 500, applied: true });
    await expect(submitGuestOrder(f.outlet.publicId, order(10000, 1))).rejects.toMatchObject({
      statusCode: 409,
    });
    await expect(submitGuestOrder(f.outlet.publicId, order(10500))).rejects.toMatchObject({
      statusCode: 409,
    });
    const key = crypto.randomUUID();
    const created = await submitGuestOrder(f.outlet.publicId, order(10500, 1, key));
    expect(created.totalMinor).toBe(10500);
    const original = await admin(async (_db, pool) =>
      pool.query(
        "select o.subtotal_minor,o.tax_minor,o.total_minor,s.policy_revision,s.applied," +
          "s.line_snapshot from orders o join app_private.order_sales_tax_snapshots s on s.order_id=o.id " +
          "where o.id=$1",
        [created.orderId]
      )
    );
    expect(original.rows[0]).toMatchObject({
      subtotal_minor: 10000,
      tax_minor: 500,
      total_minor: 10500,
      policy_revision: 1,
      applied: true,
    });
    expect(original.rows[0]!.line_snapshot[0]).toMatchObject({
      originalMinor: "10000",
      baseMinor: "10000",
      taxMinor: "500",
      totalMinor: "10500",
    });
    await expect(
      admin(async (_db, pool) =>
        pool.query(
          "update app_private.order_sales_tax_snapshots set tax_minor=0 where order_id=$1",
          [created.orderId]
        )
      )
    ).rejects.toThrow();
    const changed = await saveOutletSalesTax(f.actor, f.outlet.organizationId, f.outlet.id, {
      expectedRevision: 1,
      confirmed: true,
      policy: policy(600),
      applyToOrders: true,
      confirmedLiveTax: true,
    });
    expect(changed.revision).toBe(2);
    const replay = await submitGuestOrder(f.outlet.publicId, order(10500, 1, key));
    expect(replay).toMatchObject({
      orderId: created.orderId,
      isDuplicate: true,
      totalMinor: 10500,
    });
    await expect(submitGuestOrder(f.outlet.publicId, order(10500, 1))).rejects.toMatchObject({
      statusCode: 409,
    });
    // The statutory classification must independently match the merchant's new
    // rate; a preference edit cannot silently override dish-level tax authority.
    await expect(submitGuestOrder(f.outlet.publicId, order(10600, 2))).rejects.toMatchObject({
      statusCode: 409,
    });
    await admin(async (_db, pool) => {
      await pool.query(
        "update pos_tax_classes set rate_bps=600 where outlet_id=$1 and dish_id='plate'",
        [f.outlet.id]
      );
    });
    const newer = await submitGuestOrder(f.outlet.publicId, order(10600, 2));
    expect(newer.totalMinor).toBe(10600);
    const old = await admin(async (_db, pool) =>
      pool.query("select tax_minor,total_minor from orders where id=$1", [created.orderId])
    );
    expect(old.rows[0]).toMatchObject({ tax_minor: 500, total_minor: 10500 });
  });

  it("uses the final tax-inclusive payable for staff attestation, private receipt and refund", async () => {
    const f = await ready();
    await saveOutletSalesTax(f.actor, f.outlet.organizationId, f.outlet.id, {
      expectedRevision: 0,
      confirmed: true,
      policy: policy(),
      applyToOrders: true,
      confirmedLiveTax: true,
    });
    const input = {
      key: crypto.randomUUID(),
      selection: {
        menuId: f.menuId,
        expectedRevision: 2,
        lines: [{ dishId: "plate", variantId: null, groups: [], quantity: 1 }],
      },
      fulfillmentMode: "dine_in" as const,
      tableId: null,
      customerName: "",
      customerPhone: "",
      notes: "",
      expectedSubtotalMinor: "10000",
      expectedTaxRevision: 1,
      expectedTotalMinor: "10500",
      expectedTaxMinor: "500",
      markAsPaid: true,
      paymentMethod: "cash" as const,
    };
    const created = await posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, input);
    expect(created).toMatchObject({
      subtotalMinor: "10000",
      totalMinor: "10500",
      taxMinor: "500",
      taxRevision: 1,
      taxAndFeesCalculated: true,
      paymentStatus: "complete",
    });
    const attest = await admin(async (_db, pool) =>
      pool.query(
        "select amount_minor,currency from pos_staff_payment_attestations where sale_id=$1",
        [created.saleId]
      )
    );
    expect(attest.rows[0]).toMatchObject({ amount_minor: "10500", currency: "INR" });
    const bill = await posReceipt(f.actor, f.outlet.organizationId, f.outlet.id, created.saleId);
    expect(bill).toMatchObject({
      subtotalMinor: "10000",
      taxMinor: "500",
      totalMinor: "10500",
      taxApplied: true,
      paymentStatus: "complete",
    });
    const settlement = await financeRead(f.actor, f.outlet.organizationId, f.outlet.id, {
      view: "settlement",
      id: created.saleId,
    });
    expect(settlement).toMatchObject({
      expectedMinor: "10500",
      staffAttestedMinor: "10500",
      unallocatedOriginalMinor: "0",
      state: "paid",
    });
    const ledger = await financeRead(f.actor, f.outlet.organizationId, f.outlet.id, {
      view: "ledger_page",
    });
    const ledgerRows = ledger as {
      items: Array<{ saleId: string; totalMinor: string; taxMinor: string; paidMinor: string }>;
    };
    expect(ledgerRows.items.find((item) => item.saleId === created.saleId)).toMatchObject({
      totalMinor: "10500",
      taxMinor: "500",
      paidMinor: "10500",
    });
    const reconciliation = await financeRead(f.actor, f.outlet.organizationId, f.outlet.id, {
      view: "reconcile_page",
    });
    const reconPage = reconciliation as { anomalies: Array<{ saleId: string; reason: string }> };
    expect(reconPage.anomalies.filter((a) => a.saleId === created.saleId)).toEqual([]);
    const refunded = await financeCommand(f.actor, f.outlet.organizationId, f.outlet.id, {
      action: "staff_refund",
      key: crypto.randomUUID(),
      data: {
        saleId: created.saleId,
        reason: "Cashier refund of entire sale",
        externalRefundAttested: false,
      },
    });
    expect(refunded).toMatchObject({ amountMinor: "10500" });
    const receiptAfter = await posReceipt(
      f.actor,
      f.outlet.organizationId,
      f.outlet.id,
      created.saleId
    );
    expect(receiptAfter).toMatchObject({
      totalMinor: "10500",
      taxMinor: "500",
      paymentStatus: "refunded",
    });
  });

  it("refuses a stale POS revision and never creates a paid sale for it", async () => {
    const f = await ready();
    await saveOutletSalesTax(f.actor, f.outlet.organizationId, f.outlet.id, {
      expectedRevision: 0,
      confirmed: true,
      policy: policy(),
      applyToOrders: true,
      confirmedLiveTax: true,
    });
    await expect(
      posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, {
        key: crypto.randomUUID(),
        selection: {
          menuId: f.menuId,
          expectedRevision: 2,
          lines: [{ dishId: "plate", variantId: null, groups: [], quantity: 1 }],
        },
        fulfillmentMode: "dine_in",
        tableId: null,
        expectedSubtotalMinor: "10000",
        expectedTaxRevision: 0,
        expectedTotalMinor: "10000",
        expectedTaxMinor: "0",
        markAsPaid: true,
        paymentMethod: "cash",
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
