import { describe, expect, it } from "vitest";
import {
  buildDynamicEntries,
  buildStaticEntries,
  normalize,
  parsePaletteIndex,
  parseQuery,
  scoreEntry,
  searchPalette,
  type PaletteFlags,
  type PaletteIndexData,
} from "../src/modules/dashboard/palette-model";
import type { DashboardNavigation } from "../src/modules/menu-product/dashboard-data";

const caps = (over: Partial<DashboardNavigation> = {}): DashboardNavigation => ({
  ordering: true,
  kitchen: true,
  ordersRead: true,
  kitchenRead: true,
  kitchenSetup: false,
  kitchenOperational: true,
  kitchenDraining: false,
  ...over,
});
const flags = (over: Partial<PaletteFlags> = {}): PaletteFlags => ({
  capabilities: caps(),
  menuWrite: true,
  assistantEnabled: false,
  ...over,
});
const index = (over: Partial<PaletteIndexData> = {}): PaletteIndexData => ({
  dishes: {
    state: "ready",
    data: [
      { id: "d1", menuId: "m1", name: "Citrus salad", category: "Starters", soldOut: false },
      { id: "d2", menuId: "m1", name: "Lamb shawarma", category: "Mains", soldOut: true },
    ],
  },
  tables: {
    state: "ready",
    data: [
      { id: "t4", tableNumber: "4", label: null, activeOrders: 2, unpaidOrders: 1 },
      { id: "t12", tableNumber: "12", label: "Terrace 12", activeOrders: 0, unpaidOrders: 0 },
    ],
  },
  orders: {
    state: "ready",
    data: [
      {
        id: "o1",
        orderNumber: 42,
        status: "pending",
        servicePoint: "Table 4",
        fulfillmentMode: "dine_in",
        paymentStatus: "unpaid",
      },
      {
        id: "o2",
        orderNumber: 421,
        status: "ready",
        servicePoint: null,
        fulfillmentMode: "pickup",
        paymentStatus: "paid",
      },
    ],
  },
  ...over,
});
function run(query: string, f: PaletteFlags = flags(), idx: PaletteIndexData = index()) {
  return searchPalette(query, buildStaticEntries(f), buildDynamicEntries(idx, f), f);
}
const labels = (query: string, f?: PaletteFlags, idx?: PaletteIndexData) =>
  run(query, f, idx).flatMap((s) => s.entries.map((e) => e.label));

describe("query parsing", () => {
  it("normalizes case, accents and spacing", () => {
    expect(normalize("  Crème   BRÛLÉE ")).toBe("creme brulee");
  });
  it("recognizes order numbers in the forms people type", () => {
    for (const raw of ["42", "#42", "order 42", "order #42", "no. 42", "042"])
      expect(parseQuery(raw).orderNumber).toBe("42");
    expect(parseQuery("table 4").orderNumber).toBeNull();
    expect(parseQuery("citrus").orderNumber).toBeNull();
  });
  it("detects questions for Ember, and only real ones", () => {
    expect(parseQuery("? best sellers").askEmber).toBe(true);
    expect(parseQuery("how many orders are waiting right now").askEmber).toBe(true);
    expect(parseQuery("one two three four five six").askEmber).toBe(true);
    expect(parseQuery("citrus salad").askEmber).toBe(false);
    expect(parseQuery("open till").askEmber).toBe(false);
  });
  it("bounds very long input", () => {
    expect(parseQuery("x".repeat(5000)).raw.length).toBe(200);
  });
});

describe("scoring", () => {
  const entry = buildStaticEntries(flags()).find((e) => e.id === "action:open-till")!;
  it("requires every token to match somewhere", () => {
    expect(scoreEntry(entry, ["open", "till"])).toBeGreaterThan(0);
    expect(scoreEntry(entry, ["open", "zebra"])).toBe(0);
  });
  it("ranks a label prefix above a keyword hit", () => {
    expect(scoreEntry(entry, ["open"])).toBeGreaterThan(scoreEntry(entry, ["register"]));
  });
  it("matches by keyword so people find things by what they call them", () => {
    expect(scoreEntry(entry, ["register"])).toBeGreaterThan(0);
  });
});

describe("what is offered, by permission", () => {
  it("offers only suggested actions and pages for an empty query, never dynamic data", () => {
    const sections = run("");
    expect(sections.map((s) => s.group)).toEqual(["actions", "pages"]);
    expect(labels("")).not.toContain("Order #42");
  });

  it("finds the till by what people call it", () => {
    expect(labels("open till")).toContain("Open till");
    expect(labels("register")).toContain("Open till");
  });

  it("hides ordering pages when ordering is not enabled", () => {
    const f = flags({ capabilities: caps({ ordering: false }) });
    expect(labels("orders", f)).not.toContain("Orders");
    expect(labels("reports", f)).not.toContain("Reports & Insights");
    expect(labels("z-report", f)).not.toContain("Z-report");
    expect(labels("settings", f)).toContain("Settings");
  });

  it("only offers authoring actions to someone who can write the menu", () => {
    expect(labels("add a dish")).toContain("Add a dish");
    expect(labels("add a dish", flags({ menuWrite: false }))).not.toContain("Add a dish");
    expect(labels("import", flags({ menuWrite: false }))).not.toContain("Import a menu");
  });

  it("offers Mark sold out / Restore only to someone who may change availability", () => {
    expect(labels("citrus")).toContain("Mark Citrus salad sold out");
    expect(labels("shawarma")).toContain("Restore Lamb shawarma");
    // Kitchen staff (orders.prepare) may toggle even without menu.write.
    const kitchen = flags({ menuWrite: false, capabilities: caps({ kitchenRead: true }) });
    expect(labels("citrus", kitchen)).toContain("Mark Citrus salad sold out");
    // Everyone else just navigates to the dish, with no toggle action.
    const reader = flags({ menuWrite: false, capabilities: caps({ kitchenRead: false }) });
    expect(labels("citrus", reader)).toContain("Citrus salad");
    expect(labels("citrus", reader)).not.toContain("Mark Citrus salad sold out");
    const entry = run("citrus", reader)
      .flatMap((s) => s.entries)
      .find((e) => e.id.startsWith("dish:"))!;
    expect(entry.command.kind).toBe("navigate");
  });

  it("states availability in text, not only colour", () => {
    const entries = run("shawarma").flatMap((s) => s.entries);
    expect(entries.find((e) => e.id.startsWith("dish:"))!.status).toEqual({
      tone: "bad",
      text: "Sold out",
    });
  });

  it("omits sources the user cannot read instead of showing empty or fake results", () => {
    const idx = index({
      orders: { state: "restricted", data: null },
      tables: { state: "unavailable", data: null },
    });
    expect(labels("42", flags(), idx)).not.toContain("Order #42");
    expect(labels("table 4", flags(), idx)).not.toContain("Table 4");
  });
});

describe("orders, tables and Ember", () => {
  it("looks up an order by number, exact match first, with orders ahead of everything", () => {
    const sections = run("42");
    expect(sections[0]!.group).toBe("orders");
    expect(sections[0]!.entries.map((e) => e.label)).toEqual(["Order #42", "Order #421"]);
    expect(run("#421")[0]!.entries.map((e) => e.label)).toEqual(["Order #421"]);
  });

  it("falls back to a history search when no active order matches", () => {
    const sections = run("9001");
    const first = sections[0]!.entries[0]!;
    expect(first.label).toBe("Search orders for #9001");
    expect(first.command).toEqual({
      kind: "navigate",
      href: "/dashboard/orders?q=9001&tab=history",
    });
  });

  it("finds tables by number, label and the way staff say it", () => {
    expect(labels("table 4")).toContain("Table 4");
    expect(labels("terrace")).toContain("Terrace 12");
    expect(labels("t4")).toContain("Table 4");
  });

  it("only offers Ember when it is enabled and the query is more than one word", () => {
    expect(labels("how many orders are waiting")).not.toContain(
      "Ask Ember: how many orders are waiting"
    );
    const on = flags({ assistantEnabled: true });
    const sections = run("how many orders are waiting", on);
    expect(sections[0]!.group).toBe("ember");
    expect(sections[0]!.entries[0]!.command).toEqual({
      kind: "ember",
      prompt: "how many orders are waiting",
    });
    // A plain two-word search still lists Ember, but after the real results.
    const plain = run("citrus salad", on);
    expect(plain.at(-1)!.group).toBe("ember");
    expect(plain[0]!.group).not.toBe("ember");
    // A single word never triggers it.
    expect(run("citrus", on).some((s) => s.group === "ember")).toBe(false);
  });

  it("caps each group so the list stays scannable", () => {
    const many = index({
      dishes: {
        state: "ready",
        data: Array.from({ length: 40 }, (_, i) => ({
          id: "d" + i,
          menuId: "m",
          name: "Salad " + i,
          category: "Starters",
          soldOut: false,
        })),
      },
    });
    const dishes = run("salad", flags(), many).find((s) => s.group === "dishes")!;
    expect(dishes.entries).toHaveLength(6);
  });
});

describe("palette index validation", () => {
  const body = {
    outletId: "o1",
    dishes: {
      state: "ready",
      data: [{ id: "d", menuId: "m", name: "Soup", category: "Starters", soldOut: false }],
    },
    tables: { state: "restricted", data: null },
    orders: {
      state: "ready",
      data: [
        {
          id: "o",
          orderNumber: 7,
          status: "ready",
          servicePoint: null,
          fulfillmentMode: "pickup",
          paymentStatus: "paid",
        },
      ],
    },
  };
  it("accepts a well-formed index and keeps restricted sections as restricted", () => {
    const parsed = parsePaletteIndex(body, "o1")!;
    expect(parsed.dishes).toMatchObject({ state: "ready" });
    expect(parsed.tables).toEqual({ state: "restricted", data: null });
    expect(parsed.orders?.data?.[0]).toMatchObject({ orderNumber: 7, servicePoint: null });
  });
  it("rejects a response for a different outlet", () => {
    expect(parsePaletteIndex(body, "other")).toBeNull();
    expect(parsePaletteIndex(null, "o1")).toBeNull();
    expect(parsePaletteIndex("x", "o1")).toBeNull();
  });
  it("skips malformed rows and treats a malformed section as unavailable, never as empty", () => {
    const parsed = parsePaletteIndex(
      {
        ...body,
        dishes: {
          state: "ready",
          data: [{ id: "d" }, { id: "e", menuId: "m", name: "Ok", soldOut: true }, null, 5],
        },
        orders: { state: "ready", data: "nope" },
        tables: undefined,
      },
      "o1"
    )!;
    expect(parsed.dishes?.data).toHaveLength(1);
    expect(parsed.orders).toEqual({ state: "unavailable", data: null });
    expect(parsed.tables).toEqual({ state: "unavailable", data: null });
  });
});
