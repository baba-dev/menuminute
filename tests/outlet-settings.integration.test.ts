import { describe, it, expect } from "vitest";
import { admin, fixture } from "./helpers";
import {
  editableOutletProfile,
  saveOutletProfile,
  outletProfileCommandSchema,
  canManageOutletProfile,
} from "../src/modules/restaurants/profile";

describe("Outlet Atelier scoped profile persistence", () => {
  it("saves audited contact and branding with monotonic optimistic version", async () => {
    const f = await fixture(),
      base = editableOutletProfile(f.outlet);
    expect(await canManageOutletProfile(f.actor, f.outlet.id)).toBe(true);
    const first = await saveOutletProfile(f.actor, f.outlet.organizationId, f.outlet.id, {
      expectedVersion: 0,
      fields: {
        ...base,
        description: "A table with a story",
        phone: "+91 1234567890",
        email: "Hello@Example.com",
        website: "https://example.com",
        addressLine1: "Main Lane",
        primaryColor: "#AABBCC",
        secondaryColor: "#112233",
      },
    });
    expect(first.profileVersion).toBe(1);
    expect(first.fields.email).toBe("hello@example.com");
    expect(first.fields.primaryColor).toBe("#aabbcc");
    const persisted = await admin(async (_, pool) =>
      pool.query<{
        profile_version: number;
        description: string;
        email: string;
        primary_color: string;
      }>("select profile_version,description,email,primary_color from restaurants where id=$1", [
        f.outlet.id,
      ])
    );
    expect(persisted.rows[0]).toMatchObject({
      profile_version: 1,
      description: "A table with a story",
      email: "hello@example.com",
      primary_color: "#aabbcc",
    });
    const audit = await admin(async (_, pool) =>
      pool.query<{ n: number }>(
        "select count(*)::int as n from audit_logs where restaurant_id=$1 and action='settings.profile.update'",
        [f.outlet.id]
      )
    );
    expect(audit.rows[0]?.n).toBe(1);
    await expect(
      saveOutletProfile(f.actor, f.outlet.organizationId, f.outlet.id, {
        expectedVersion: 0,
        fields: { ...base, description: "Stale editor" },
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it("rejects cross-tenant edits, invalid fields and unchanged financial identity", async () => {
    const owner = await fixture(),
      other = await fixture(),
      base = editableOutletProfile(owner.outlet);
    await expect(
      saveOutletProfile(other.actor, owner.outlet.organizationId, owner.outlet.id, {
        expectedVersion: 0,
        fields: base,
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      saveOutletProfile(owner.actor, other.outlet.organizationId, owner.outlet.id, {
        expectedVersion: 0,
        fields: base,
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(
      outletProfileCommandSchema.safeParse({
        expectedVersion: 0,
        fields: { ...base, currency: "USD" },
      }).success
    ).toBe(false);
    expect(
      outletProfileCommandSchema.safeParse({
        expectedVersion: 0,
        fields: { ...base, website: "javascript:alert(1)" },
      }).success
    ).toBe(false);
    expect(
      outletProfileCommandSchema.safeParse({
        expectedVersion: 0,
        fields: { ...base, primaryColor: "red;" },
      }).success
    ).toBe(false);
    const guarded = await admin(async (_, pool) =>
      pool.query<{ currency: string; profile_version: number }>(
        "select currency,profile_version from restaurants where id=$1",
        [owner.outlet.id]
      )
    );
    expect(guarded.rows[0]).toMatchObject({ currency: "INR", profile_version: 0 });
  });
  it("rejects direct application-role UPDATE on the protected restaurant table", async () => {
    const f = await fixture();
    const allowed = await admin(async (_, pool) =>
      pool.query<{ allowed: boolean }>(
        "select has_table_privilege('menuminute_app','restaurants','UPDATE') as allowed"
      )
    );
    expect(allowed.rows[0]?.allowed).toBe(false);
    expect(f.outlet.profileVersion).toBe(0);
  });
});
