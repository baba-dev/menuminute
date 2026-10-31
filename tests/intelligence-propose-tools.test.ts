import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, fixture } from "./helpers";
import { env } from "../src/lib/config/env";
import { callGuestService } from "../src/modules/hospitality/service";
import { createConversation } from "../src/modules/intelligence/store";
import { authorizedToolDefinitions, executeReadTool } from "../src/modules/intelligence/read-tools";
import { executeProposeTool } from "../src/modules/intelligence/propose-tools";
import { decideAction } from "../src/modules/intelligence/action-requests";
import { runReadOnlyTurn } from "../src/modules/intelligence/orchestrator";
import { beginTurn } from "../src/modules/intelligence/store";
import { createProviderHub } from "../src/modules/intelligence";
import { parseEnv } from "../src/lib/config/env";

const mutable = env as unknown as Record<string, unknown>;
const uuid = () => crypto.randomUUID();
let previous: unknown;
beforeAll(() => {
  previous = mutable["AI_ASSISTANT_ACTIONS_ENABLED"];
  mutable["AI_ASSISTANT_ACTIONS_ENABLED"] = true;
});
afterAll(() => {
  mutable["AI_ASSISTANT_ACTIONS_ENABLED"] = previous;
});

async function seed() {
  const f = await fixture();
  const scopeBase = {
    actor: f.actor,
    organizationId: f.outlet.organizationId,
    outletId: f.outlet.id,
  };
  const conversation = await createConversation(scopeBase, uuid());
  const ctx = { ...scopeBase, conversationId: conversation.id };
  const ids = { table: uuid(), served: uuid(), pendingDineIn: uuid(), pendingPickup: uuid() };
  const base = 1000 + Math.floor(Math.random() * 8000);
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into restaurant_tables(id,restaurant_id,table_number,is_active) values($1,$2,'T9',true)",
      [ids.table, f.outlet.id]
    );
    const order = (id: string, n: number, status: string, mode: string, table: string | null) =>
      pool.query(
        `insert into orders(id,restaurant_id,table_id,tracking_token,order_number,status,
         fulfillment_mode,payment_status,currency,total_minor,expires_at)
         values($1,$2,$3,$4,$5,$6,$7,'unpaid','INR',21000,now()+interval '1 hour')`,
        [id, f.outlet.id, table, uuid(), n, status, mode]
      );
    await order(ids.served, base, "served", "dine_in", ids.table);
    await order(ids.pendingDineIn, base + 1, "pending", "dine_in", ids.table);
    await order(ids.pendingPickup, base + 2, "pending", "pickup", null);
  });
  const tracking = await admin(
    async (_db, pool) =>
      (await pool.query("select tracking_token from orders where id=$1", [ids.served])).rows[0]
        .tracking_token as string
  );
  await callGuestService(ids.served, {
    token: f.outlet.publicId,
    trackingToken: tracking,
    signal: "water_refill",
  });
  const status = (id: string) =>
    admin(
      async (_db, pool) =>
        (await pool.query("select status from orders where id=$1", [id])).rows[0].status as string
    );
  return { f, ctx, ids, base, status };
}

describe("Ember propose-only tools", () => {
  it("only appear when actions are enabled and the person holds a matching permission", async () => {
    const { ctx } = await seed();
    const on = (await authorizedToolDefinitions(ctx)).map((t) => t.name);
    expect(on).toEqual(
      expect.arrayContaining([
        "propose.guestRequest",
        "propose.orderStatus",
        "propose.kitchenTicket",
      ])
    );
    mutable["AI_ASSISTANT_ACTIONS_ENABLED"] = false;
    try {
      const off = (await authorizedToolDefinitions(ctx)).map((t) => t.name);
      expect(off.some((n) => n.startsWith("propose."))).toBe(false);
      await expect(
        executeReadTool(ctx, "propose.orderStatus", { orderNumber: 1, targetStatus: "accepted" })
      ).rejects.toThrow();
    } finally {
      mutable["AI_ASSISTANT_ACTIONS_ENABLED"] = true;
    }
  });

  it("prepares a guest-request change, changes nothing, then applies it only on confirm", async () => {
    const { ctx } = await seed();
    const prep = await executeProposeTool(ctx, "propose.guestRequest", {
      table: "T9",
      action: "acknowledge",
    });
    expect(prep.data).toMatchObject({
      prepared: true,
      awaitingConfirmation: true,
      summary: "Mark table T9's water request as seen",
    });
    const none = await executeProposeTool(ctx, "propose.guestRequest", {
      table: "nope",
      action: "acknowledge",
    });
    expect(none.data).toMatchObject({ prepared: false });
    const id = (prep.data as { requestId: string }).requestId;
    const receipt = await decideAction(ctx, id, { key: uuid(), decision: "confirm" });
    expect(receipt).toMatchObject({ status: "confirmed" });
  });

  it("moves an order only on confirm, refuses illegal steps, and reports a changed order as stale", async () => {
    const { ctx, ids, base, status } = await seed();
    const skip = await executeProposeTool(ctx, "propose.orderStatus", {
      orderNumber: base + 1,
      targetStatus: "ready",
    });
    expect(skip.data).toMatchObject({ prepared: false });
    expect((skip.data as { reason: string }).reason).toMatch(/can't go straight/);
    const wrongMode = await executeProposeTool(ctx, "propose.orderStatus", {
      orderNumber: base + 2,
      targetStatus: "collected",
    });
    expect(wrongMode.data).toMatchObject({ prepared: false });

    const prep = await executeProposeTool(ctx, "propose.orderStatus", {
      orderNumber: base + 1,
      targetStatus: "accepted",
    });
    expect(prep.data).toMatchObject({
      prepared: true,
      summary: `Mark order #${base + 1} (dine-in) as accepted`,
    });
    expect(await status(ids.pendingDineIn)).toBe("pending"); // proposing changed nothing
    const done = await decideAction(ctx, (prep.data as { requestId: string }).requestId, {
      key: uuid(),
      decision: "confirm",
    });
    expect(done).toMatchObject({ status: "confirmed" });
    expect(await status(ids.pendingDineIn)).toBe("accepted");

    const stalePrep = await executeProposeTool(ctx, "propose.orderStatus", {
      orderNumber: base + 2,
      targetStatus: "accepted",
    });
    await admin(async (_db, pool) => {
      await pool.query("update orders set version=version+1 where id=$1", [ids.pendingPickup]);
    });
    const stale = await decideAction(ctx, (stalePrep.data as { requestId: string }).requestId, {
      key: uuid(),
      decision: "confirm",
    });
    expect(stale.status).toBe("stale");
    expect(await status(ids.pendingPickup)).toBe("pending");
  });

  it("needs a conversation and rejects unknown arguments", async () => {
    const { ctx } = await seed();
    const noConversation = {
      actor: ctx.actor,
      organizationId: ctx.organizationId,
      outletId: ctx.outletId,
    };
    await expect(
      executeProposeTool(noConversation, "propose.guestRequest", { table: "T9", action: "resolve" })
    ).rejects.toThrow();
    await expect(
      executeProposeTool(ctx, "propose.orderStatus", { orderNumber: 1, targetStatus: "paid" })
    ).rejects.toThrow();
    await expect(
      executeProposeTool(ctx, "propose.orderStatus", {
        orderNumber: 1,
        targetStatus: "ready",
        x: 1,
      })
    ).rejects.toThrow();
  });

  it("a full turn prepares the change, answers in plain words and leaves the order untouched", async () => {
    const { ctx, ids, base, status } = await seed();
    const scope = { actor: ctx.actor, organizationId: ctx.organizationId, outletId: ctx.outletId };
    const turn = await beginTurn(scope, ctx.conversationId, {
      key: uuid(),
      prompt: `Please accept order ${base + 1}`,
    });
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: "t1",
                      type: "function",
                      function: {
                        name: "propose_orderStatus",
                        arguments: JSON.stringify({
                          orderNumber: base + 1,
                          targetStatus: "accepted",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
          { headers: { "content-type": "application/json" } }
        )
    );
    const config = parseEnv({
      NODE_ENV: "test",
      APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://localhost/menuminute_test",
      AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
      AUTH_ALLOW_TEST_EMAIL: "true",
      EMAIL_PROVIDER: "test",
      REDIS_QUEUE_URL: "redis://127.0.0.1:6379",
      REDIS_CACHE_URL: "redis://127.0.0.1:6380",
      MEDIA_STORAGE: "local",
      MEDIA_ROOT: "/tmp/menuminute-test-media",
      AI_FEATURES_ENABLED: "true",
      AI_ORCHESTRATOR_ENABLED: "true",
      AI_NVIDIA_ENABLED: "true",
      AI_NVIDIA_COMMERCIAL_APPROVED: "true",
      NVIDIA_API_KEY: "unit-test-only-key",
      AI_NVIDIA_MODEL: "reviewed/model",
      AI_NVIDIA_TOOLS_VERIFIED: "true",
      AI_EMBER_NVIDIA_INPUT_MICROUSD_MTOK: "1000000",
      AI_EMBER_NVIDIA_OUTPUT_MICROUSD_MTOK: "1000000",
      AI_EMBER_NVIDIA_DAILY_CAP_MICROUSD: "50000",
    });
    const hub = createProviderHub(config, fetcher as unknown as typeof fetch);
    const result = await runReadOnlyTurn(scope, turn.turn, hub, undefined, true, config);
    expect(result.status).toBe("completed");
    expect(result.answer).toMatch(/Nothing changes until you tap/);
    const saved = await admin(
      async (_db, pool) =>
        (
          await pool.query(
            "select summary,status from assistant_action_requests where conversation_id=$1",
            [ctx.conversationId]
          )
        ).rows
    );
    expect(saved).toEqual([
      { summary: `Mark order #${base + 1} (dine-in) as accepted`, status: "pending" },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1); // grounded reply: no second model call
    expect(await status(ids.pendingDineIn)).toBe("pending");
  });
});
