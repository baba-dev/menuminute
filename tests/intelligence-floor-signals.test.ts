import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixture } from "./helpers";
import { env } from "../src/lib/config/env";
import { createConversation } from "../src/modules/intelligence/store";
import { authorizedToolDefinitions } from "../src/modules/intelligence/read-tools";
import { executeProposeTool } from "../src/modules/intelligence/propose-tools";
import { decideAction } from "../src/modules/intelligence/action-requests";
import { selectQuestionTools } from "../src/modules/intelligence/tool-selection";
import { getSignalSettings } from "../src/modules/hospitality/floor-service";

const mutable = env as unknown as Record<string, unknown>;
const uuid = () => crypto.randomUUID();
let prior: unknown;
beforeAll(() => {
  prior = mutable["AI_ASSISTANT_ACTIONS_ENABLED"];
  mutable["AI_ASSISTANT_ACTIONS_ENABLED"] = true;
});
afterAll(() => {
  mutable["AI_ASSISTANT_ACTIONS_ENABLED"] = prior;
});

describe("Ember live table signals action", () => {
  it("is offered to an owner and picked for explicit on/off requests only", async () => {
    const f = await fixture();
    const ctx = { actor: f.actor, organizationId: f.outlet.organizationId, outletId: f.outlet.id };
    const allowed = await authorizedToolDefinitions(ctx);
    expect(allowed.map((t) => t.name)).toContain("propose.floorSignals");
    const picks = (question: string) => selectQuestionTools(allowed, question).map((t) => t.name);
    expect(picks("please turn on live table signals")).toContain("propose.floorSignals");
    expect(picks("switch off the water button")).toContain("propose.floorSignals");
    expect(picks("how many orders today")).not.toContain("propose.floorSignals");
  });

  it("prepares a card, changes nothing until confirmed, and refuses a no-op", async () => {
    const f = await fixture();
    const scope = {
      actor: f.actor,
      organizationId: f.outlet.organizationId,
      outletId: f.outlet.id,
    };
    const ctx = { ...scope, conversationId: (await createConversation(scope, uuid())).id };
    const confirm = (id: string) => decideAction(ctx, id, { key: uuid(), decision: "confirm" });

    expect((await getSignalSettings(f.actor, f.outlet.id)).enabled).toBe(false);
    const prepared = await executeProposeTool(ctx, "propose.floorSignals", { enabled: true });
    expect(prepared.data).toMatchObject({
      prepared: true,
      awaitingConfirmation: true,
      kind: "floor.signals",
      summary: "Turn on live table signals",
    });
    // Preparing is not doing: still off.
    expect((await getSignalSettings(f.actor, f.outlet.id)).enabled).toBe(false);

    const receipt = await confirm((prepared.data as { requestId: string }).requestId);
    expect(receipt).toMatchObject({ status: "confirmed" });
    expect((await getSignalSettings(f.actor, f.outlet.id)).enabled).toBe(true);

    const noop = await executeProposeTool(ctx, "propose.floorSignals", { enabled: true });
    expect((noop.data as { reason: string }).reason).toMatch(/already set that way/);

    const source = await executeProposeTool(ctx, "propose.floorSignals", {
      guestWaterButton: false,
    });
    expect((source.data as { summary: string }).summary).toBe("Turn off the guest water button");
    await confirm((source.data as { requestId: string }).requestId);
    expect(await getSignalSettings(f.actor, f.outlet.id)).toMatchObject({
      enabled: true,
      guestWaterButton: false,
    });
  });

  it("rejects unknown fields and an empty request", async () => {
    const f = await fixture();
    const scope = {
      actor: f.actor,
      organizationId: f.outlet.organizationId,
      outletId: f.outlet.id,
    };
    const ctx = { ...scope, conversationId: (await createConversation(scope, uuid())).id };
    await expect(
      executeProposeTool(ctx, "propose.floorSignals", { everything: true })
    ).rejects.toThrow();
    await expect(executeProposeTool(ctx, "propose.floorSignals", {})).rejects.toThrow();
  });
});
