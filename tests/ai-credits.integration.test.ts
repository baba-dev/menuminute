import { describe, expect, it, vi } from "vitest";

// Credits are only counted while plan limits are enforced; enable that for this file only.
vi.mock("@/lib/config/env", async (original) => {
  const mod = await original<typeof import("@/lib/config/env")>();
  return { ...mod, env: { ...mod.env, PLAN_LIMITS_ENFORCED: true } };
});

import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { listOrganizations, manageOrganization } from "../src/modules/organizations/service";
import { withOutlet } from "../src/modules/tenancy/service";
import { refundAiCredits, spendAiCredits } from "../src/modules/plans/credits";
import { getPlanUsageView } from "../src/modules/plans/usage";
import { beginTurn, createConversation, failTurn } from "../src/modules/intelligence/store";
import { Pool } from "pg";
import {
  cancelImport,
  createImport,
  importDetail,
  submitImportForProcessing,
} from "../src/modules/menu-import/service";

type F = Awaited<ReturnType<typeof fixture>>;
const owner = <T>(text: string, params: unknown[] = []) =>
  admin(async (_db, pool) => (await pool.query(text, params)).rows as T[]);
const spend = (f: F, cost = 1, outletId = f.outlet.id, actor = f.actor) =>
  withOutlet(actor, outletId, "menu.read", (tx) => spendAiCredits(tx, outletId, cost));
const refund = (f: F, cost = 1, outletId = f.outlet.id) =>
  withOutlet(f.actor, outletId, "menu.read", (tx) => refundAiCredits(tx, outletId, cost));
const used = async (f: F) =>
  (
    await owner<{ used: number }>(
      "select coalesce(sum(used),0)::int as used from app_private.ai_credit_usage where organization_id=$1 and month=(date_trunc('month',now() at time zone 'UTC'))::date",
      [f.outlet.organizationId]
    )
  )[0]!.used;
const grant = (f: F, capability: "ordering.new" | "kitchen.new") =>
  admin(async (_db, pool) => {
    await applyEntitlement(pool, {
      key: crypto.randomUUID(),
      organizationId: f.outlet.organizationId,
      operator: "credit-test",
      reason: "AI credit test",
      action: "grant",
      capability,
      billingCurrency: "INR",
      startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
    });
  });
async function addOutlet(f: F, name: string) {
  const version = (await listOrganizations(f.actor)).find(
    (o) => o.id === f.outlet.organizationId
  )!.version;
  return manageOrganization(f.actor, f.outlet.organizationId, {
    key: crypto.randomUUID(),
    expectedVersion: version,
    command: {
      action: "outlet.create",
      data: {
        name,
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "restaurant",
        fulfillmentModes: ["dine_in"],
      },
    },
  });
}

describe("monthly AI credits", () => {
  it("lets Free spend its 10 credits and then refuses with the reset date and an upgrade pointer", async () => {
    const f = await fixture();
    for (let i = 0; i < 10; i++) expect(await spend(f)).toBe(true);
    const now = new Date();
    const resets = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    await expect(spend(f)).rejects.toMatchObject({
      code: "AI_CREDITS_EXHAUSTED",
      limit: 10,
      upgradeTo: "Ordering",
    });
    const err = await spend(f).catch((e) => e);
    expect(new Date(err.resetsAt).getTime()).toBe(resets.getTime());
    expect(await used(f)).toBe(10);
  });

  it("refuses a multi-credit spend that does not fit, without spending part of it", async () => {
    const f = await fixture();
    await spend(f, 8);
    await expect(spend(f, 3)).rejects.toMatchObject({ code: "AI_CREDITS_EXHAUSTED" });
    expect(await used(f)).toBe(8);
    expect(await spend(f, 2)).toBe(true);
    expect(await used(f)).toBe(10);
  });

  it("never lets concurrent requests overspend the allowance", async () => {
    const f = await fixture();
    const results = await Promise.allSettled(Array.from({ length: 16 }, () => spend(f)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    expect(await used(f)).toBe(10);
  });

  it("gives credits back and never goes below zero", async () => {
    const f = await fixture();
    await spend(f, 3);
    await refund(f, 2);
    expect(await used(f)).toBe(1);
    await refund(f, 5);
    expect(await used(f)).toBe(0);
  });

  it("raises the allowance with the plan: Ordering 150 credits", async () => {
    const f = await fixture();
    await grant(f, "ordering.new");
    expect(await spend(f, 150)).toBe(true);
    await expect(spend(f, 501)).rejects.toBeTruthy(); // a single request above the sanity bound is invalid
    await expect(spend(f)).rejects.toMatchObject({
      code: "AI_CREDITS_EXHAUSTED",
      limit: 150,
      upgradeTo: "Kitchen Pro",
    });
  });

  it("pools the allowance across the organization's outlets (Kitchen Pro 1,000)", async () => {
    const f = await fixture();
    await grant(f, "kitchen.new");
    const second = await addOutlet(f, "Second outlet");
    const secondId =
      (second as unknown as { outletId?: string; id?: string }).outletId ??
      (
        await owner<{ id: string }>(
          "select id from restaurants where organization_id=$1 and id<>$2",
          [f.outlet.organizationId, f.outlet.id]
        )
      )[0]!.id;
    await spend(f, 500);
    await spend(f, 100);
    await spend(f, 400, secondId);
    expect(await used(f)).toBe(1000);
    await expect(spend(f)).rejects.toMatchObject({ code: "AI_CREDITS_EXHAUSTED", limit: 1000 });
    await expect(spend(f, 1, secondId)).rejects.toMatchObject({ code: "AI_CREDITS_EXHAUSTED" });
  });

  it("starts each UTC month fresh: last month's usage does not count", async () => {
    const f = await fixture();
    await owner(
      "insert into app_private.ai_credit_usage(organization_id,month,used) values($1,(date_trunc('month',now() at time zone 'UTC') - interval '1 month')::date,10)",
      [f.outlet.organizationId]
    );
    expect(await spend(f, 10)).toBe(true);
  });

  it("only a member who can read the outlet may spend, and the ledger is private", async () => {
    const f = await fixture();
    const stranger = await fixture();
    await expect(
      withOutlet(stranger.actor, f.outlet.id, "menu.read", (tx) =>
        spendAiCredits(tx, f.outlet.id, 1)
      )
    ).rejects.toBeTruthy();
    expect(await used(f)).toBe(0);
    await expect(
      withOutlet(f.actor, f.outlet.id, "menu.read", (tx) =>
        tx.execute(sql`select * from app_private.ai_credit_usage`)
      )
    ).rejects.toBeTruthy();
  });

  it("shows the meter with this month's usage", async () => {
    const f = await fixture();
    await spend(f, 4);
    const view = await getPlanUsageView(f.actor, f.outlet.id);
    expect(view?.meters.find((m) => m.key === "aiCredits")).toMatchObject({
      used: 4,
      cap: 10,
      state: "ok",
    });
  });
});

describe("assistant messages cost one credit", () => {
  async function turn(f: F, conversationId: string, prompt: string) {
    const scope = {
      actor: f.actor,
      organizationId: f.outlet.organizationId,
      outletId: f.outlet.id,
    };
    return {
      scope,
      ...(await beginTurn(scope, conversationId, { key: crypto.randomUUID(), prompt })),
    };
  }
  async function conversation(f: F) {
    const scope = {
      actor: f.actor,
      organizationId: f.outlet.organizationId,
      outletId: f.outlet.id,
    };
    return (await createConversation(scope, crypto.randomUUID())).id;
  }

  it("spends a credit per new message, refuses at the limit, and refunds a failed one", async () => {
    const f = await fixture();
    const id = await conversation(f);
    const first = await turn(f, id, "How many orders are pending?");
    expect(await used(f)).toBe(1);
    await failTurn(first.scope, first.turn.id, "provider_unavailable");
    expect(await used(f)).toBe(0);
    // A turn that fails twice does not refund twice.
    await failTurn(first.scope, first.turn.id, "provider_unavailable").catch(() => undefined);
    expect(await used(f)).toBe(0);

    await spend(f, 10);
    await expect(turn(f, id, "Another question")).rejects.toMatchObject({
      code: "AI_CREDITS_EXHAUSTED",
    });
    expect(await used(f)).toBe(10);
  });
});

describe("AI menu import costs one credit per page", () => {
  async function importWithPages(f: F, pages: number) {
    const id = crypto.randomUUID();
    await createImport(f.actor, f.outlet.id, { id, key: crypto.randomUUID() });
    for (let i = 0; i < pages; i++)
      await owner(
        "insert into menu_import_sources(id,import_id,organization_id,outlet_id,page_index,status,request_sha256,request_bytes,stored_sha256,stored_bytes,width,height,storage_key) values($1,$2,$3,$4,$5,'ready',$6,100,$7,90,10,10,$8)",
        [
          crypto.randomUUID(),
          id,
          f.outlet.organizationId,
          f.outlet.id,
          i,
          "a".repeat(64),
          "b".repeat(64),
          `imports/${f.outlet.organizationId}/${id}/${crypto.randomUUID()}.webp`,
        ]
      );
    return { id, revision: (await importDetail(f.actor, f.outlet.id, id)).revision };
  }
  const submit = (f: F, i: { id: string; revision: number }) =>
    submitImportForProcessing(f.actor, f.outlet.id, i.id, i.revision);

  it("spends one credit per ready page and queues the import", async () => {
    const f = await fixture();
    const imp = await importWithPages(f, 3);
    await expect(submit(f, imp)).resolves.toMatchObject({ status: "queued" });
    expect(await used(f)).toBe(3);
  });

  it("refuses an import that does not fit the allowance, and leaves it unqueued and uncharged", async () => {
    const f = await fixture();
    await spend(f, 8);
    const imp = await importWithPages(f, 3);
    await expect(submit(f, imp)).rejects.toMatchObject({ code: "AI_CREDITS_EXHAUSTED", limit: 10 });
    expect(await used(f)).toBe(8);
    const status = await owner<{ status: string }>("select status from menu_imports where id=$1", [
      imp.id,
    ]);
    expect(status[0]!.status).toBe("collecting");
  });

  it("records the charge, and a queued import cancelled before it starts gets every credit back once", async () => {
    const f = await fixture();
    const imp = await importWithPages(f, 3);
    const queued = await submit(f, imp);
    expect(await used(f)).toBe(3);
    const recorded = await owner<{ credits_charged: number }>(
      "select credits_charged from menu_imports where id=$1",
      [imp.id]
    );
    expect(recorded[0]!.credits_charged).toBe(3);

    await cancelImport(f.actor, f.outlet.id, imp.id, { expectedRevision: queued.revision });
    const [event] = await owner<{ id: string }>(
      "select id from outbox_events where type='menu_import.process' and payload->>'importId'=$1",
      [imp.id]
    );
    const pool = new Pool({ connectionString: process.env["WORKER_DATABASE_URL"], max: 1 });
    try {
      const begin = () =>
        pool.query("select app_private.import_engine_begin($1,$2,$3) as r", [
          event!.id,
          f.outlet.organizationId,
          "test/vision",
        ]);
      expect((await begin()).rows[0].r).toMatchObject({ done: true });
      expect(await used(f)).toBe(0);
      // A redelivery must not return the credits a second time.
      await spend(f, 2);
      await begin();
      expect(await used(f)).toBe(2);
    } finally {
      await pool.end();
    }
    const after = await owner<{ credits_charged: number }>(
      "select credits_charged from menu_imports where id=$1",
      [imp.id]
    );
    expect(after[0]!.credits_charged).toBe(0);
  });

  it("does not charge when the submission itself fails (stale revision)", async () => {
    const f = await fixture();
    const imp = await importWithPages(f, 2);
    await expect(
      submitImportForProcessing(f.actor, f.outlet.id, imp.id, imp.revision + 5)
    ).rejects.toBeTruthy();
    expect(await used(f)).toBe(0);
  });
});
