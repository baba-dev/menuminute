import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixture } from "./helpers";
import { env } from "../src/lib/config/env";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";
import { commandMenu, menuDetail } from "../src/modules/menu-product/service";
import { createConversation } from "../src/modules/intelligence/store";
import { authorizedToolDefinitions, executeReadTool } from "../src/modules/intelligence/read-tools";
import { executeProposeTool } from "../src/modules/intelligence/propose-tools";
import { decideAction } from "../src/modules/intelligence/action-requests";
import { introducesSafetyClaim } from "../src/modules/intelligence/menu-actions";

const mutable = env as unknown as Record<string, unknown>;
const uuid = () => crypto.randomUUID();
let prior: [unknown, unknown];
beforeAll(() => {
  prior = [mutable["AI_ASSISTANT_ACTIONS_ENABLED"], mutable["AI_ASSISTANT_PUBLISH_ENABLED"]];
  mutable["AI_ASSISTANT_ACTIONS_ENABLED"] = true;
  mutable["AI_ASSISTANT_PUBLISH_ENABLED"] = true;
});
afterAll(() => {
  mutable["AI_ASSISTANT_ACTIONS_ENABLED"] = prior[0];
  mutable["AI_ASSISTANT_PUBLISH_ENABLED"] = prior[1];
});

async function setup() {
  const f = await fixture();
  const scope = { actor: f.actor, organizationId: f.outlet.organizationId, outletId: f.outlet.id };
  const conversation = await createConversation(scope, uuid());
  const ctx = { ...scope, conversationId: conversation.id };
  const menuId = uuid();
  const doc = menuDocumentSchema.parse({
    name: "Lunch",
    currency: "INR",
    categories: [
      {
        id: "mains",
        name: "Mains",
        items: [
          { id: "paneer", name: "Paneer Tikka", priceMinor: 15000, description: "Smoky and soft." },
          { id: "dal", name: "Dal Makhani", priceMinor: 12000 },
          { id: "dal2", name: "Dal Tadka", priceMinor: 11000 },
        ],
      },
    ],
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: uuid(),
    expectedRevision: 0,
    action: "create",
    data: { document: doc },
  });
  const created = await menuDetail(f.actor, menuId);
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: uuid(),
    expectedRevision: created.revision,
    action: "publish",
    data: {},
  });
  const confirm = (id: string) => decideAction(ctx, id, { key: uuid(), decision: "confirm" });
  const draft = async () => menuDetail(f.actor, menuId);
  const price = (d: Awaited<ReturnType<typeof menuDetail>>, dishId: string) =>
    d.document.categories[0]!.items.find((i) => i.id === dishId)!.priceMinor;
  const livePrice = (d: Awaited<ReturnType<typeof menuDetail>>, dishId: string) =>
    d.publishedDocument!.categories[0]!.items.find((i) => i.id === dishId)!.priceMinor;
  return { f, ctx, menuId, confirm, draft, price, livePrice };
}

describe("Ember draft price and description edits", () => {
  it("prepares without changing anything, saves only the DRAFT on confirm, and leaves live untouched", async () => {
    const { ctx, menuId, confirm, draft, price, livePrice } = await setup();
    const prep = await executeProposeTool(ctx, "propose.menuPrice", {
      dish: "paneer",
      newPrice: 180,
    });
    expect(prep.data).toMatchObject({
      prepared: true,
      summary: "Change Paneer Tikka from ₹150.00 to ₹180.00 in the “Lunch” draft",
    });
    expect(price(await draft(), "paneer")).toBe(15000);
    const receipt = await confirm((prep.data as { requestId: string }).requestId);
    expect(receipt).toMatchObject({ status: "confirmed" });
    const after = await draft();
    expect(price(after, "paneer")).toBe(18000);
    expect(livePrice(after, "paneer")).toBe(15000); // guests still see the published price
    expect(after.publishedRevision).not.toBe(after.revision);
    expect(menuId).toBeTruthy();
  });

  it("asks instead of guessing: unknown, ambiguous, unchanged, big jump, and local overrides", async () => {
    const { ctx } = await setup();
    const run = (args: Record<string, unknown>) =>
      executeProposeTool(ctx, "propose.menuPrice", args as never);
    expect((await run({ dish: "pizza", newPrice: 100 })).data).toMatchObject({ prepared: false });
    const ambiguous = (await run({ dish: "dal", newPrice: 100 })).data as { reason: string };
    expect(ambiguous.reason).toMatch(/Dal Makhani.*Dal Tadka|Dal Tadka.*Dal Makhani/);
    expect((await run({ dish: "Dal Makhani", newPrice: 120 })).data).toMatchObject({
      prepared: false,
    });
    const jump = (await run({ dish: "Paneer Tikka", newPrice: 1500 })).data as { reason: string };
    expect(jump.reason).toMatch(/big jump/);
    expect(
      (await run({ dish: "Paneer Tikka", newPrice: 1500, confirmLargeChange: true })).data
    ).toMatchObject({ prepared: true });
    await expect(run({ dish: "Paneer", newPrice: -5 })).rejects.toThrow();
  });

  it("refuses allergen, dietary and nutrition wording, but accepts ordinary descriptions", async () => {
    const { ctx, confirm, draft } = await setup();
    const bad = await executeProposeTool(ctx, "propose.menuDescription", {
      dish: "Paneer Tikka",
      description: "Gluten free and nut free, made with dairy.",
    });
    expect(bad.data).toMatchObject({ prepared: false });
    expect((bad.data as { reason: string }).reason).toMatch(/allergen/);
    const ok = await executeProposeTool(ctx, "propose.menuDescription", {
      dish: "Paneer Tikka",
      description: "Chargrilled cottage cheese with mint chutney.",
    });
    expect(ok.data).toMatchObject({
      prepared: true,
      summary: "Update the description of Paneer Tikka in the “Lunch” draft",
    });
    await confirm((ok.data as { requestId: string }).requestId);
    expect((await draft()).document.categories[0]!.items[0]!.description).toBe(
      "Chargrilled cottage cheese with mint chutney."
    );
    expect(introducesSafetyClaim("Contains nuts.", "Contains nuts and honey.")).toBe(false);
    expect(introducesSafetyClaim("Soft.", "Soft and vegan.")).toBe(true);
  });

  it("reports a draft that moved after the proposal as stale and never overwrites it", async () => {
    const { f, ctx, menuId, confirm, draft, price } = await setup();
    const prep = await executeProposeTool(ctx, "propose.menuPrice", {
      dish: "Paneer Tikka",
      newPrice: 170,
    });
    const current = await draft();
    const doc = structuredClone(current.document);
    doc.categories[0]!.items[1]!.priceMinor = 12500; // someone else edits Dal in Menu Studio
    await commandMenu(f.actor, f.outlet.id, menuId, {
      key: uuid(),
      expectedRevision: current.revision,
      action: "save",
      data: { document: doc },
    });
    const receipt = await confirm((prep.data as { requestId: string }).requestId);
    expect(receipt.status).toBe("stale");
    const after = await draft();
    expect(price(after, "paneer")).toBe(15000);
    expect(price(after, "dal")).toBe(12500);
  });
});

describe("Ember confirmed publishing", () => {
  it("shows exactly what goes live, refuses while an edit is pending, then publishes on confirm", async () => {
    const { ctx, confirm, draft, livePrice } = await setup();
    const nothing = await executeProposeTool(ctx, "propose.menuPublish", { menu: "Lunch" });
    expect((nothing.data as { reason: string }).reason).toMatch(/nothing to put live/);

    const edit = await executeProposeTool(ctx, "propose.menuPrice", {
      dish: "Paneer Tikka",
      newPrice: 180,
    });
    const blocked = await executeProposeTool(ctx, "propose.menuPublish", { menu: "Lunch" });
    expect((blocked.data as { reason: string }).reason).toMatch(/Confirm or dismiss/);
    await confirm((edit.data as { requestId: string }).requestId);

    const prep = await executeProposeTool(ctx, "propose.menuPublish", { menu: "Lunch" });
    expect(prep.data).toMatchObject({
      prepared: true,
      summary: "Publish “Lunch”: 1 change goes live",
    });
    const { actionRequestHistory } = await import("../src/modules/intelligence/action-requests");
    const row = (await actionRequestHistory(ctx, ctx.conversationId)).find(
      (r) => (r as { kind: string }).kind === "menu.publish"
    ) as { preview: string };
    expect(row.preview).toContain("Paneer Tikka: price ₹150.00 → ₹180.00");
    expect(livePrice(await draft(), "paneer")).toBe(15000); // preparing publishes nothing

    const receipt = await confirm((prep.data as { requestId: string }).requestId);
    expect(receipt).toMatchObject({ status: "confirmed" });
    const live = await draft();
    expect(livePrice(live, "paneer")).toBe(18000);
    expect(live.publishedRevision).toBe(live.revision);
  });

  it("refuses a publish prepared against a draft that has since changed", async () => {
    const { f, ctx, menuId, confirm, draft } = await setup();
    const edit = await executeProposeTool(ctx, "propose.menuPrice", {
      dish: "Paneer Tikka",
      newPrice: 180,
    });
    await confirm((edit.data as { requestId: string }).requestId);
    const prep = await executeProposeTool(ctx, "propose.menuPublish", { menu: "Lunch" });
    const current = await draft();
    const doc = structuredClone(current.document);
    doc.categories[0]!.items[2]!.priceMinor = 11500;
    await commandMenu(f.actor, f.outlet.id, menuId, {
      key: uuid(),
      expectedRevision: current.revision,
      action: "save",
      data: { document: doc },
    });
    const receipt = await confirm((prep.data as { requestId: string }).requestId);
    expect(receipt.status).toBe("stale");
    expect((await draft()).publishedRevision).not.toBe((await draft()).revision);
  });

  it("is only offered when the separate publish switch is on", async () => {
    const { ctx } = await setup();
    expect((await authorizedToolDefinitions(ctx)).map((t) => t.name)).toContain(
      "propose.menuPublish"
    );
    mutable["AI_ASSISTANT_PUBLISH_ENABLED"] = false;
    try {
      expect((await authorizedToolDefinitions(ctx)).map((t) => t.name)).not.toContain(
        "propose.menuPublish"
      );
      expect((await authorizedToolDefinitions(ctx)).map((t) => t.name)).toContain(
        "propose.menuPrice"
      );
      await expect(executeReadTool(ctx, "propose.menuPublish", {})).rejects.toThrow();
    } finally {
      mutable["AI_ASSISTANT_PUBLISH_ENABLED"] = true;
    }
  });
});
