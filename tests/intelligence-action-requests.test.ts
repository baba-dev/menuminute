import { afterEach, describe, expect, it, vi } from "vitest";
import { fixture, admin } from "./helpers";
import { createConversation } from "../src/modules/intelligence/store";
import {
  actionKinds,
  actionRequestHistory,
  decideAction,
  proposeAction,
} from "../src/modules/intelligence/action-requests";

const uuid = () => crypto.randomUUID();
async function setup() {
  const f = await fixture();
  const scope = { actor: f.actor, organizationId: f.outlet.organizationId, outletId: f.outlet.id };
  const conversation = await createConversation(scope, uuid());
  const propose = (over: Record<string, unknown> = {}) =>
    proposeAction(scope, {
      conversationId: conversation.id,
      key: uuid(),
      kind: "service_request.acknowledge",
      params: { requestId: uuid() },
      summary: "Mark table 5's request for water as seen",
      ...over,
    });
  return { f, scope, conversation, propose };
}
afterEach(() => vi.restoreAllMocks());

describe("Ember confirm-first action requests", () => {
  it("creates a pending request once per key and refuses a conflicting replay", async () => {
    const { propose } = await setup();
    const key = uuid();
    const params = { requestId: uuid() };
    const a = await propose({ key, params });
    const b = await propose({ key, params });
    expect(a.status).toBe("pending");
    expect(b.id).toBe(a.id);
    await expect(propose({ key, params: { requestId: uuid() } })).rejects.toThrow();
  });

  it("rejects params the registry does not allow (strict, typed)", async () => {
    const { propose } = await setup();
    await expect(propose({ params: { requestId: "not-a-uuid" } })).rejects.toThrow();
    await expect(propose({ params: { requestId: uuid(), extra: 1 } })).rejects.toThrow();
    await expect(
      propose({
        kind: "order.transition",
        params: { orderId: "o1", targetStatus: "paid", expectedVersion: 1 },
      })
    ).rejects.toThrow();
  });

  it("runs the domain command exactly once, even when confirm is repeated", async () => {
    const { scope, propose } = await setup();
    const run = vi
      .spyOn(actionKinds["service_request.acknowledge"], "execute")
      .mockResolvedValue({ status: "confirmed", message: "Marked as seen by staff." });
    const req = await propose();
    const key = uuid();
    const first = await decideAction(scope, req.id, { key, decision: "confirm" });
    const replay = await decideAction(scope, req.id, { key, decision: "confirm" });
    expect(first).toMatchObject({ status: "confirmed", message: "Marked as seen by staff." });
    expect(replay).toEqual(first);
    expect(run).toHaveBeenCalledTimes(1);
    await expect(
      decideAction(scope, req.id, { key: uuid(), decision: "confirm" })
    ).rejects.toThrow();
    await expect(
      decideAction(scope, req.id, { key: uuid(), decision: "reject" })
    ).rejects.toThrow();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("makes no change on reject and records a plain receipt", async () => {
    const { scope, propose } = await setup();
    const run = vi.spyOn(actionKinds["service_request.acknowledge"], "execute");
    const req = await propose();
    const r = await decideAction(scope, req.id, { key: uuid(), decision: "reject" });
    expect(r).toMatchObject({ status: "rejected", message: "No change was made" });
    expect(run).not.toHaveBeenCalled();
  });

  it("records stale and failed outcomes without leaking technical detail", async () => {
    const { scope, propose } = await setup();
    const exec = vi.spyOn(actionKinds["service_request.acknowledge"], "execute");
    exec.mockResolvedValueOnce({ status: "stale", message: "That changed before you confirmed." });
    const stale = await decideAction(scope, (await propose()).id, {
      key: uuid(),
      decision: "confirm",
    });
    expect(stale.status).toBe("stale");
    exec.mockRejectedValueOnce(new Error("pg: relation orders does not exist"));
    const failed = await decideAction(scope, (await propose()).id, {
      key: uuid(),
      decision: "confirm",
    });
    expect(failed.status).toBe("failed");
    expect(JSON.stringify(failed)).not.toMatch(/pg:|relation|orders does not/);
  });

  it("keeps requests private to the person who made them", async () => {
    const mine = await setup();
    const other = await setup();
    const req = await mine.propose();
    const run = vi.spyOn(actionKinds["service_request.acknowledge"], "execute");
    await expect(
      decideAction(other.scope, req.id, { key: uuid(), decision: "confirm" })
    ).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
    expect(await actionRequestHistory(other.scope, mine.conversation.id).catch(() => [])).toEqual(
      []
    );
    expect(await actionRequestHistory(mine.scope, mine.conversation.id)).toHaveLength(1);
  });

  it("refuses to confirm an expired request", async () => {
    const { scope, propose } = await setup();
    const run = vi.spyOn(actionKinds["service_request.acknowledge"], "execute");
    const req = await propose();
    await admin(async (_db, pool) => {
      await pool.query(
        "update assistant_action_requests set expires_at=now()-interval '1 minute' where id=$1",
        [req.id]
      );
    });
    await expect(
      decideAction(scope, req.id, { key: uuid(), decision: "confirm" })
    ).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });
});
