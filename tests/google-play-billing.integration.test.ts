import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { withActor } from "../src/modules/tenancy/service";

type F = Awaited<ReturnType<typeof fixture>>;
const owner = <T>(text: string, params: unknown[] = []) =>
  admin(async (_db, pool) => (await pool.query(text, params)).rows as T[]);
const DAY = 86_400_000;
const tokenOf = () => "tok_" + crypto.randomUUID().replace(/-/g, "") + "0123456789";

async function register(f: F, token: string) {
  await withActor(f.actor, (tx) =>
    tx.execute(
      sql`SELECT app_private.register_play_purchase(${token},${f.outlet.organizationId},'ordering')`
    )
  );
}
async function record(
  token: string,
  state: string,
  expiry: Date | null,
  extra: { linked?: string; order?: string; autoRenewing?: boolean } = {}
) {
  const rows = await owner<{ r: { state: string; entitled: boolean; grantId?: string | null } }>(
    "select app_private.record_play_state($1,$2,'ordering','menuminute_ordering','monthly',$3,$4,$5,$6,$7,false,true,'INR') r",
    [
      "evt_" + crypto.randomUUID(),
      token,
      state,
      expiry,
      extra.autoRenewing ?? true,
      extra.order ?? "GPA.1111-2222-3333-44444",
      extra.linked ?? null,
    ]
  );
  return rows[0]!.r;
}
const orderingAllowed = async (f: F) =>
  (
    await owner<{ a: boolean }>(
      "select exists(select 1 from entitlement_grants where organization_id=$1 and capability='ordering.new' and revoked_at is null and starts_at<=clock_timestamp() and ends_at>clock_timestamp()) a",
      [f.outlet.organizationId]
    )
  )[0]!.a;
const playGrants = (f: F) =>
  owner<{ id: string; revoked_at: Date | null; operator: string; ends_at: Date }>(
    "select id,revoked_at,operator,ends_at from entitlement_grants where organization_id=$1 and operator='google-play' order by created_at",
    [f.outlet.organizationId]
  );

describe("Google Play purchase ledger", () => {
  it("binds a token only for an owner, never re-binds it, and keeps privileged writers separate", async () => {
    const a = await fixture();
    const b = await fixture();
    const token = tokenOf();
    await register(a, token);
    await expect(register(b, token)).rejects.toThrow();
    // A different organization's owner cannot register against this organization.
    await expect(
      withActor(b.actor, (tx) =>
        tx.execute(
          sql`SELECT app_private.register_play_purchase(${tokenOf()},${a.outlet.organizationId},'ordering')`
        )
      )
    ).rejects.toThrow();
    // Idempotent for the same owner.
    await register(a, token);

    const priv = await owner<{ app: boolean; billing: boolean; reg: boolean }>(
      `select has_function_privilege('menuminute_app','app_private.record_play_state(text,text,text,text,text,text,timestamptz,boolean,text,text,boolean,boolean,text)','EXECUTE') app,
              has_function_privilege('menuminute_billing','app_private.record_play_state(text,text,text,text,text,text,timestamptz,boolean,text,text,boolean,boolean,text)','EXECUTE') billing,
              has_function_privilege('menuminute_app','app_private.register_play_purchase(text,text,text)','EXECUTE') reg`
    );
    expect(priv[0]).toEqual({ app: false, billing: true, reg: true });
    const tablePriv = await owner<{ c: boolean }>(
      "select has_table_privilege('menuminute_app','app_private.play_purchases','SELECT') c"
    );
    expect(tablePriv[0]!.c).toBe(false);
  });

  it("grants only after a verified state, is idempotent, rolls forward on renewal and revokes on hold", async () => {
    const f = await fixture();
    const token = tokenOf();
    await register(f, token);
    // Registered but unverified: nothing is unlocked.
    expect(await orderingAllowed(f)).toBe(false);

    const first = Date.now() + 30 * DAY;
    const r1 = await record(token, "active", new Date(first));
    expect(r1.entitled).toBe(true);
    expect(await orderingAllowed(f)).toBe(true);
    const again = await record(token, "active", new Date(first));
    expect(again.grantId).toBe(r1.grantId);
    expect(await playGrants(f)).toHaveLength(1);

    // Renewal: one live grant, previous one revoked.
    const renewed = await record(token, "active", new Date(first + 30 * DAY), {
      order: "GPA.1111-2222-3333-44445",
    });
    expect(renewed.grantId).not.toBe(r1.grantId);
    const grants = await playGrants(f);
    expect(grants.filter((g) => g.revoked_at === null)).toHaveLength(1);

    // Cancelled auto-renew still keeps paid access until expiry.
    const cancelled = await record(token, "canceled", new Date(first + 30 * DAY), {
      autoRenewing: false,
    });
    expect(cancelled.entitled).toBe(true);
    expect(await orderingAllowed(f)).toBe(true);

    // Account hold stops access immediately.
    const hold = await record(token, "on_hold", new Date(first + 30 * DAY));
    expect(hold.entitled).toBe(false);
    expect(await orderingAllowed(f)).toBe(false);

    // Recovery with the same expiry works (no request-key collision).
    expect((await record(token, "active", new Date(first + 30 * DAY))).entitled).toBe(true);
    expect(await orderingAllowed(f)).toBe(true);
  });

  it("revokes immediately for refunds/revocation and never grants for an already-expired period", async () => {
    const f = await fixture();
    const token = tokenOf();
    await register(f, token);
    await record(token, "active", new Date(Date.now() + 20 * DAY));
    expect(await orderingAllowed(f)).toBe(true);
    expect((await record(token, "revoked", new Date(Date.now() + 20 * DAY))).entitled).toBe(false);
    expect(await orderingAllowed(f)).toBe(false);

    const g = await fixture();
    const expired = tokenOf();
    await register(g, expired);
    const r = await record(expired, "active", new Date(Date.now() - DAY));
    expect(r.entitled).toBe(false);
    expect(r.state).toBe("expired");
    expect(await orderingAllowed(g)).toBe(false);
  });

  it("supersedes an automatic trial but flags a conflict instead of double-granting a paid entitlement", async () => {
    const f = await fixture();
    await owner(
      "insert into entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key) values($1,$2,'ordering.new','INR',clock_timestamp(),clock_timestamp()+interval '10 days','auto-trial','trial',$3)",
      [crypto.randomUUID(), f.outlet.organizationId, crypto.randomUUID()]
    );
    const token = tokenOf();
    await register(f, token);
    const r = await record(token, "active", new Date(Date.now() + 30 * DAY));
    expect(r.entitled).toBe(true);
    const trial = await owner<{ revoked_at: Date | null }>(
      "select revoked_at from entitlement_grants where organization_id=$1 and operator='auto-trial'",
      [f.outlet.organizationId]
    );
    expect(trial[0]!.revoked_at).not.toBeNull();

    // An operator-granted entitlement already covers the window: Play must not stack a second grant.
    const g = await fixture();
    await owner(
      "insert into entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key) values($1,$2,'ordering.new','INR',clock_timestamp(),clock_timestamp()+interval '90 days','ops','manual',$3)",
      [crypto.randomUUID(), g.outlet.organizationId, crypto.randomUUID()]
    );
    const t2 = tokenOf();
    await register(g, t2);
    const conflict = await record(t2, "active", new Date(Date.now() + 30 * DAY));
    expect(conflict).toMatchObject({ state: "conflict", entitled: false });
    expect(await playGrants(g)).toHaveLength(0);
  });

  it("replaces a linked (resubscribed) token so only one Play grant stays live", async () => {
    const f = await fixture();
    const oldToken = tokenOf();
    await register(f, oldToken);
    await record(oldToken, "active", new Date(Date.now() + 5 * DAY));
    const newToken = tokenOf();
    await register(f, newToken);
    // The old token's own hold arrives first; the resubscription is a fresh token that links to it.
    const resubscribed = await record(newToken, "active", new Date(Date.now() + 35 * DAY), {
      linked: oldToken,
    });
    expect(resubscribed.entitled).toBe(true);
    const live = (await playGrants(f)).filter((g) => g.revoked_at === null);
    expect(live).toHaveLength(1);
    const old = await owner<{ state: string }>(
      "select state from app_private.play_purchases where purchase_token=$1",
      [oldToken]
    );
    expect(old[0]!.state).toBe("replaced");
  });

  it("refuses unknown tokens and enforces a single billing provider per organization", async () => {
    const f = await fixture();
    await expect(record(tokenOf(), "active", new Date(Date.now() + DAY))).rejects.toThrow(
      "Unknown Google Play purchase"
    );
    const blocker = () =>
      withActor(f.actor, async (tx) => {
        const r = await tx.execute<{ b: string | null }>(
          sql`SELECT app_private.play_checkout_blocker(${f.outlet.organizationId}) b`
        );
        return r.rows[0]!.b;
      });
    expect(await blocker()).toBeNull();

    const token = tokenOf();
    await register(f, token);
    expect(await blocker()).toBeNull(); // registered-but-unverified must not block retry or restore
    await record(token, "active", new Date(Date.now() + 30 * DAY));
    expect(await blocker()).toBe("play");
    const blocksRazorpay = await withActor(f.actor, async (tx) => {
      const r = await tx.execute<{ b: boolean }>(
        sql`SELECT app_private.play_subscription_blocks_razorpay(${f.outlet.organizationId}) b`
      );
      return r.rows[0]!.b;
    });
    expect(blocksRazorpay).toBe(true);

    const g = await fixture();
    await owner(
      "insert into app_private.razorpay_subscriptions(subscription_id,organization_id,product_key,provider_plan_id,created_by,status) values($1,$2,'ordering','plan_x',$3,'active')",
      [
        "sub_" + crypto.randomUUID().replace(/-/g, "").slice(0, 14),
        g.outlet.organizationId,
        g.actor.userId,
      ]
    );
    const razorpayBlocker = await withActor(g.actor, async (tx) => {
      const r = await tx.execute<{ b: string | null }>(
        sql`SELECT app_private.play_checkout_blocker(${g.outlet.organizationId}) b`
      );
      return r.rows[0]!.b;
    });
    expect(razorpayBlocker).toBe("razorpay");
  });
});
