import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { accountWorkspacePreferences } from "../src/db/schema";
import { withActor } from "../src/modules/tenancy/service";
import {
  readWorkspacePreference,
  selectWorkspacePreference,
} from "../src/modules/organizations/workspace-preferences";
import {
  readDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
} from "../src/modules/dashboard/layout-preference";
import { dashboardWidgetIds, defaultDashboardLayout } from "../src/modules/dashboard/layout";

const custom = {
  version: 1 as const,
  order: ["health", "kpis", "priorities", "dispatch", "floor", "serviceRequests"],
  hidden: ["floor"],
  pinned: ["health"],
};

describe("dashboard layout preference", () => {
  it("defaults for a new account and round-trips a saved layout", async () => {
    const { actor } = await fixture();
    expect(await readDashboardLayout(actor.userId)).toEqual(defaultDashboardLayout);
    await saveDashboardLayout(actor, custom);
    expect(await readDashboardLayout(actor.userId)).toEqual(custom);
    // Full replace, not a merge.
    await saveDashboardLayout(actor, { ...custom, hidden: [], pinned: [] });
    const next = await readDashboardLayout(actor.userId);
    expect(next.hidden).toEqual([]);
    expect(next.pinned).toEqual([]);
  });

  it("is independent of the default-workspace preference in both directions", async () => {
    const { actor, outlet } = await fixture();
    await selectWorkspacePreference(actor, outlet.organizationId, outlet.id);
    await saveDashboardLayout(actor, custom);
    expect(await readWorkspacePreference(actor.userId)).toEqual({
      organizationId: outlet.organizationId,
      outletId: outlet.id,
    });
    // Re-selecting a workspace must not wipe the layout.
    await selectWorkspacePreference(actor, outlet.organizationId, outlet.id);
    expect(await readDashboardLayout(actor.userId)).toEqual(custom);
  });

  it("creates a row for an account that has never chosen a workspace", async () => {
    const { actor } = await fixture();
    await saveDashboardLayout(actor, custom);
    expect(await readWorkspacePreference(actor.userId)).toEqual({
      organizationId: null,
      outletId: null,
    });
  });

  it("rejects unknown widgets, duplicates and extra keys without persisting", async () => {
    const { actor } = await fixture();
    await expect(saveDashboardLayout(actor, { ...custom, order: ["ghost"] })).rejects.toThrow();
    await expect(
      saveDashboardLayout(actor, { ...custom, hidden: ["kpis", "kpis"] })
    ).rejects.toThrow();
    await expect(saveDashboardLayout(actor, { ...custom, extra: 1 })).rejects.toThrow();
    expect(await readDashboardLayout(actor.userId)).toEqual(defaultDashboardLayout);
  });

  it("isolates layouts per account through row-level security", async () => {
    const first = await fixture();
    const second = await fixture();
    await saveDashboardLayout(first.actor, custom);
    expect(await readDashboardLayout(second.actor.userId)).toEqual(defaultDashboardLayout);
    const peeked = await withActor(second.actor, (tx) =>
      tx
        .select()
        .from(accountWorkspacePreferences)
        .where(eq(accountWorkspacePreferences.userId, first.actor.userId))
    );
    expect(peeked).toEqual([]);
    // Writing as one account can never overwrite another account's row.
    await saveDashboardLayout(second.actor, { ...custom, pinned: [] });
    expect((await readDashboardLayout(first.actor.userId)).pinned).toEqual(["health"]);
  });

  it("resets to the default and tolerates a malformed stored value", async () => {
    const { actor } = await fixture();
    await saveDashboardLayout(actor, custom);
    expect(await resetDashboardLayout(actor)).toEqual(defaultDashboardLayout);
    expect(await readDashboardLayout(actor.userId)).toEqual(defaultDashboardLayout);
    await admin(async (_db, pool) => {
      await pool.query(
        "update account_workspace_preferences set dashboard_layout=$2::jsonb where user_id=$1",
        [actor.userId, JSON.stringify({ order: ["floor", "ghost"], hidden: 7 })]
      );
    });
    const tolerant = await readDashboardLayout(actor.userId);
    expect(tolerant.order[0]).toBe("floor");
    expect([...tolerant.order].sort()).toEqual([...dashboardWidgetIds].sort());
    expect(tolerant.hidden).toEqual([]);
  });

  it("enforces a shape and size ceiling in the database as well", async () => {
    const { actor } = await fixture();
    await saveDashboardLayout(actor, custom);
    await admin(async (_db, pool) => {
      await expect(
        pool.query(
          "update account_workspace_preferences set dashboard_layout='[]'::jsonb where user_id=$1",
          [actor.userId]
        )
      ).rejects.toThrow(/account_preferences_dashboard_layout_shape/);
      await expect(
        pool.query(
          "update account_workspace_preferences set dashboard_layout=$2::jsonb where user_id=$1",
          [actor.userId, JSON.stringify({ pad: "x".repeat(4000) })]
        )
      ).rejects.toThrow(/account_preferences_dashboard_layout_shape/);
    });
  });
});
