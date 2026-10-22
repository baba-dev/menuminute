import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { commandMenu } from "../src/modules/menu-product/service";
import { posConfigure, posContext, posSubmit } from "../src/modules/pos/service";
import { financeRead, financeCommand } from "../src/modules/pos/finance";
import { transitionOutletOrder } from "../src/modules/orders/service";
import { getPool } from "../src/db";

async function setup(mode: "non_registered" | "classified" = "non_registered") {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Finance fixture",
        currency: f.outlet.currency,
        categories: [
          {
            id: "lunch",
            name: "Lunch",
            items: [{ id: "plate", name: "Plate", priceMinor: 28000 }],
          },
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
  const context = await posContext(f.actor, f.outlet.organizationId, f.outlet.id);
  await posConfigure(f.actor, f.outlet.organizationId, f.outlet.id, {
    expectedRevision: context.revision,
    enabled: true,
    legalName: "Fixture Merchant",
    registeredAddress: "A real test seller address",
    country: "IN",
    taxRegime: mode === "classified" ? "requires_review" : "not_registered",
    taxRegistration: mode === "classified" ? "DEMO-REGISTRATION" : null,
  });
  const sale = await posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, {
    key: crypto.randomUUID(),
    selection: {
      menuId,
      expectedRevision: 2,
      lines: [{ dishId: "plate", variantId: null, groups: [], quantity: 1 }],
    },
    fulfillmentMode: "dine_in",
    tableId: null,
    expectedSubtotalMinor: "28000",
  });
  await transitionOutletOrder(f.actor, f.outlet.id, sale.orderId, {
    targetStatus: "accepted",
    expectedVersion: 1,
  });
  async function cmd(action: string, data: Record<string, unknown>, key = crypto.randomUUID()) {
    return financeCommand(f.actor, f.outlet.organizationId, f.outlet.id, { action, key, data });
  }
  async function view(view: string, id?: string) {
    return financeRead(f.actor, f.outlet.organizationId, f.outlet.id, id ? { view, id } : { view });
  }
  return { ...f, sale, cmd, view };
}
async function operatorGate(outletId: string, orgId: string, fiscal = false) {
  await admin(async (_db, pool) =>
    pool.query(
      `insert into pos_finance_gates(outlet_id,organization_id,payments_enabled,documents_enabled,fiscal_approved,approval_note)
   values($1,$2,true,true,$3,'isolated integration test only')`,
      [outletId, orgId, fiscal]
    )
  );
}
describe("POS D–G real PostgreSQL finance integration", () => {
  it("defaults all live finance gates off, with denied direct ledger access", async () => {
    const f = await setup();
    expect(await f.view("context")).toMatchObject({
      paymentsEnabled: false,
      documentsEnabled: false,
      fiscalApproved: false,
    });
    await f.cmd("profile", {
      expectedRevision: 0,
      mode: "non_registered",
      inclusive: false,
      taxLabel: "No tax",
      classes: [],
    });
    await expect(
      f.cmd("open_shift", { registerName: "counter", openingMinor: "0" })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(getPool().query("select * from pos_tenders")).rejects.toThrow();
    await expect(
      getPool().query("update pos_finance_gates set payments_enabled=true")
    ).rejects.toThrow();
  });
  it("freezes one tax snapshot, accepts concurrent split manual tenders, issues a receipt and full credit", async () => {
    const f = await setup();
    await operatorGate(f.outlet.id, f.outlet.organizationId);
    await f.cmd("profile", {
      expectedRevision: 0,
      mode: "non_registered",
      inclusive: false,
      taxLabel: "No tax",
      classes: [],
    });
    const quote = (await f.view("preview", f.sale.saleId)) as {
      totalMinor: string;
      taxMinor: string;
      taxProfileRevision: number;
    };
    expect(quote).toMatchObject({ totalMinor: "28000", taxMinor: "0" });
    const frozen = await f.cmd("freeze", {
      saleId: f.sale.saleId,
      expectedTotalMinor: quote.totalMinor,
      expectedTaxRevision: quote.taxProfileRevision,
      customer: { name: "Fixture Buyer" },
    });
    expect(frozen.frozen).toBe(true);
    await expect(
      f.cmd("freeze", {
        saleId: f.sale.saleId,
        expectedTotalMinor: quote.totalMinor,
        expectedTaxRevision: quote.taxProfileRevision,
        customer: {},
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    const opened = (await f.cmd("open_shift", {
      registerName: "counter",
      openingMinor: "10000",
    })) as { shiftId: string };
    const firstCommand = {
      action: "tender",
      key: crypto.randomUUID(),
      data: {
        saleId: f.sale.saleId,
        shiftId: opened.shiftId,
        method: "cash",
        amountMinor: "10000",
        tenderedMinor: "20000",
        reference: null,
      },
    };
    const both = await Promise.all([
      financeCommand(f.actor, f.outlet.organizationId, f.outlet.id, firstCommand),
      financeCommand(f.actor, f.outlet.organizationId, f.outlet.id, firstCommand),
    ]);
    expect(both[0]?.tenderId).toBe(both[1]?.tenderId);
    expect([both[0]?.duplicate ?? false, both[1]?.duplicate ?? false].sort()).toEqual([
      false,
      true,
    ]);
    expect(both[0]?.changeMinor).toBe("10000");
    await expect(
      f.cmd("tender", {
        saleId: f.sale.saleId,
        shiftId: opened.shiftId,
        method: "cash",
        amountMinor: "19000",
        tenderedMinor: "19000",
        reference: null,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    const paid = await f.cmd("tender", {
      saleId: f.sale.saleId,
      shiftId: opened.shiftId,
      method: "upi_external",
      amountMinor: "18000",
      tenderedMinor: "18000",
      reference: "staff-confirmed-reference",
    });
    expect(paid).toMatchObject({ remainingMinor: "0", status: "paid", evidence: "staff_recorded" });
    const detail = (await f.view("sale", f.sale.saleId)) as {
      bill: { totalMinor: string };
      tenders: unknown[];
      documents: unknown[];
    };
    expect(detail.tenders).toHaveLength(2);
    expect(detail.bill.totalMinor).toBe("28000");
    const issued = (await f.cmd("issue", { saleId: f.sale.saleId })) as {
      documentId: string;
      documentNumber: string;
      kind: string;
    };
    expect(issued.kind).toBe("receipt");
    const printable = (await f.view("document", issued.documentId)) as {
      number: string;
      snapshot: { bill: { totalMinor: string } };
    };
    expect(printable.number).toBe(issued.documentNumber);
    expect(printable.snapshot.bill.totalMinor).toBe("28000");
    const refunded = (await f.cmd("refund", {
      saleId: f.sale.saleId,
      shiftId: opened.shiftId,
      reason: "Customer received full reversal",
      externalRefundAttested: true,
    })) as { kind: string; refundedMinor: string };
    expect(refunded).toMatchObject({ kind: "credit_note", refundedMinor: "28000" });
    const closing = (await f.cmd("close_shift", {
      shiftId: opened.shiftId,
      countedMinor: "10000",
    })) as { expectedMinor: string; varianceMinor: string };
    // Opening 10000 + applied cash 10000 - fully reversed cash 10000.
    expect(closing).toMatchObject({ expectedMinor: "10000", varianceMinor: "0" });
    const reconciliation = (await f.view("reconcile")) as { anomalies: unknown[] };
    expect(reconciliation.anomalies).toEqual([]);
    const docs = await admin(async (_db, pool) =>
      pool.query(
        "select kind,document_number,source_document_id from pos_documents where sale_id=$1 order by issued_at",
        [f.sale.saleId]
      )
    );
    expect(docs.rowCount).toBe(2);
    await expect(getPool().query("delete from pos_documents")).rejects.toThrow();
  });
  it("uses classified line tax rounding and denies fiscal invoice issuance until operator approved", async () => {
    const f = await setup("classified");
    await operatorGate(f.outlet.id, f.outlet.organizationId, false);
    await f.cmd("profile", {
      expectedRevision: 0,
      mode: "classified",
      inclusive: false,
      taxLabel: "Test tax",
      classes: [{ dishId: "plate", classification: "EXAMPLE", rateBps: 500 }],
    });
    const quote = (await f.view("preview", f.sale.saleId)) as {
      totalMinor: string;
      taxMinor: string;
      taxProfileRevision: number;
    };
    expect(quote).toMatchObject({ totalMinor: "29400", taxMinor: "1400" });
    await f.cmd("freeze", {
      saleId: f.sale.saleId,
      expectedTotalMinor: quote.totalMinor,
      expectedTaxRevision: quote.taxProfileRevision,
      customer: {},
    });
    const order = await admin(async (_db, pool) =>
      pool.query("select subtotal_minor,tax_minor,total_minor from orders where id=$1", [
        f.sale.orderId,
      ])
    );
    expect(order.rows[0]).toMatchObject({
      subtotal_minor: 28000,
      tax_minor: 1400,
      total_minor: 29400,
    });
    const shift = (await f.cmd("open_shift", { registerName: "counter", openingMinor: "0" })) as {
      shiftId: string;
    };
    await f.cmd("tender", {
      saleId: f.sale.saleId,
      shiftId: shift.shiftId,
      method: "cash",
      amountMinor: "29400",
      tenderedMinor: "29400",
      reference: null,
    });
    await expect(f.cmd("issue", { saleId: f.sale.saleId })).rejects.toMatchObject({
      statusCode: 403,
    });
    await admin(async (_db, pool) =>
      pool.query("update pos_finance_gates set fiscal_approved=true where outlet_id=$1", [
        f.outlet.id,
      ])
    );
    const invoice = await f.cmd("issue", { saleId: f.sale.saleId });
    expect(invoice.kind).toBe("invoice");
    const other = await fixture();
    await expect(
      financeRead(f.actor, other.outlet.organizationId, other.outlet.id, { view: "ledger" })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
