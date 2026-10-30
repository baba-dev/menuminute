import { describe, expect, it } from "vitest";
import { fixture } from "./helpers";
import { commandMenu, menuDetail } from "../src/modules/menu-product/service";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";
import { merchantFindDish, merchantReport, merchantImports, merchantQr } from "../src/modules/intelligence/merchant-tools";
const id = () => crypto.randomUUID();

describe("Ember live-scoped merchant reads", () => {
  it("distinguishes draft from published dishes, overlays effective stock and forbids a foreign organization", async () => {
    const f = await fixture();
    const scope = { actor: f.actor, organizationId: f.outlet.organizationId, outletId: f.outlet.id };
    const menuId = id();
    await commandMenu(f.actor, f.outlet.id, menuId, {
      key: id(), expectedRevision: 0, action: "create",
      data: { document: menuDocumentSchema.parse({
        name: "Lunch menu", currency: "INR", categories: [{
          id: "mains", name: "Mains",
          items: [{ id: "chole", name: "Chole Bhature", priceMinor: 18500 }],
        }],
      }) },
    });
    const draftOnly = await merchantFindDish(scope, "Chole");
    expect(draftOnly.data.matches).toEqual([]);
    const created = await menuDetail(f.actor, menuId);
    await commandMenu(f.actor, f.outlet.id, menuId, {
      key: id(), expectedRevision: created.revision, action: "publish", data: {},
    });
    const published = await merchantFindDish(scope, "Chole");
    expect(published.data.matches).toMatchObject([{
      dish: "Chole Bhature", priceMinor: 18500, soldOut: false,
    }]);
    const current = await menuDetail(f.actor, menuId);
    await commandMenu(f.actor, f.outlet.id, menuId, {
      key: id(), expectedRevision: current.revision, action: "override",
      data: { outletId: f.outlet.id, dishId: "chole", priceMinor: 18500, soldOut: true },
    });
    const unavailable = await merchantFindDish(scope, "Chole");
    expect(unavailable.data.matches[0]?.soldOut).toBe(true);
    const foreign = await fixture();
    await expect(merchantFindDish({
      ...scope, actor: foreign.actor,
    }, "Chole")).rejects.toThrow();
  });
  it("uses authorized reporting, QR and import projections rather than raw tables", async () => {
    const f = await fixture();
    const scope = { actor: f.actor, organizationId: f.outlet.organizationId, outletId: f.outlet.id };
    const report = await merchantReport(scope, "week");
    expect(report.source).toBe("reports.getReportsWorkspace");
    expect(report.data.currency).toBe(f.outlet.currency);
    expect(report.data.orderCount).toBeGreaterThanOrEqual(0);
    expect(report.data.limitation).toContain("Orders are not");
    const imports = await merchantImports(scope);
    expect(imports.data.imports).toEqual([]);
    const qr = await merchantQr(scope);
    expect(qr.data.active).toBeLessThanOrEqual(qr.data.total);
  });
});
