import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { admin, fixture } from "./helpers";
import { createRestaurant } from "../src/modules/restaurants/service";
import {
  saveOnboarding,
  onboardingState,
  provisionOnboarding,
  inviteMember,
  invitationPreview,
  acceptInvitation,
  revokeInvitation,
  listInvitations,
} from "../src/modules/onboarding/service";
import { drainAuthTestMessages } from "../src/lib/auth-email";
async function verified() {
  const userId = crypto.randomUUID();
  const email = userId + "@test.invalid";
  await admin(async (_, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'Invite test',$2,true)",
      [userId, email]
    );
  });
  return { userId, email };
}
it("restores server-owned draft and reconciles an accepted lost provisioning response without a duplicate", async () => {
  const actor = await verified();
  const details = {
    name: "Recovered Kitchen",
    country: "OM",
    currency: "OMR",
    timezone: "Asia/Muscat",
    outletType: "restaurant" as const,
    fulfillmentModes: ["dine_in" as const],
    menuSchedule: null,
  };
  const saved = await saveOnboarding(actor, details);
  expect((await onboardingState(actor)).draft).toEqual(details);
  expect((await saveOnboarding(actor, details)).key).toBe(saved.key);
  const outlet = await createRestaurant(actor.userId, details, saved.key);
  const restored = await onboardingState(actor);
  expect(restored).toMatchObject({ status: "completed", outletId: outlet.id });
  expect(await provisionOnboarding(actor)).toMatchObject({
    outletId: outlet.id,
    status: "completed",
  });
  await expect(
    saveOnboarding(actor, { ...details, name: "Duplicate Kitchen" })
  ).rejects.toMatchObject({ statusCode: 409 });
  await admin(async (_, pool) => {
    const count = await pool.query("select count(*)::int as n from restaurants where id=$1", [
      outlet.id,
    ]);
    expect(count.rows[0].n).toBe(1);
    // Regression: provisioning must preserve the default menu and its outlet
    // assignment from the latest menu-product migration, not just the new quota.
    const menu = await pool.query(
      "select count(*)::int as n from menus m join menu_assignments a on a.menu_id=m.id and a.outlet_id=$1 where m.outlet_id=$1",
      [outlet.id]
    );
    expect(menu.rows[0].n).toBe(1);
  });
});
it("only the verified matching recipient can accept a pending invitation once", async () => {
  const { actor, outlet } = await fixture();
  const member = await verified(),
    other = await verified();
  drainAuthTestMessages();
  const key = crypto.randomUUID();
  const invitation = await inviteMember(actor, outlet.organizationId, {
    email: member.email,
    role: "member",
    key,
  });
  expect(invitation.id).toBeTruthy();
  const mail = drainAuthTestMessages().find((m) => m.subject.includes("Invitation"));
  const token = mail?.text.match(/\/invite\/([a-f0-9]{64})/)?.[1];
  expect(token).toBeTruthy();
  await expect(invitationPreview(other, token!)).rejects.toMatchObject({ statusCode: 422 });
  expect((await invitationPreview(member, token!)).email).toBe(member.email);
  await expect(acceptInvitation(other, token!)).rejects.toThrow();
  const accepted = await acceptInvitation(member, token!);
  expect(accepted.organizationId).toBe(outlet.organizationId);
  await expect(acceptInvitation(member, token!)).rejects.toThrow();
  const rows = await listInvitations(actor, outlet.organizationId);
  expect(rows.find((x) => x.id === invitation.id)?.status).toBe("accepted");
  drainAuthTestMessages();
  const revoked = await inviteMember(actor, outlet.organizationId, {
    email: other.email,
    role: "member",
    key: crypto.randomUUID(),
  });
  const otherToken = drainAuthTestMessages()[0]?.text.match(/\/invite\/([a-f0-9]{64})/)?.[1];
  expect(otherToken).toBeTruthy();
  await revokeInvitation(actor, outlet.organizationId, revoked.id);
  await expect(acceptInvitation(other, otherToken!)).rejects.toThrow();
  // Hash-only persistence: the raw invite token is never stored.
  const hash = createHash("sha256").update(token!).digest("hex");
  await admin(async (_, p) => {
    const record = await p.query("select token_hash from organization_invitations where id=$1", [
      invitation.id,
    ]);
    expect(record.rows[0].token_hash).toBe(hash);
  });
});
it("caps a verified new owner at three organizations without weakening idempotent retries", async () => {
  const actor = await verified();
  const details = {
    name: "Capped Free Kitchen",
    country: "IN",
    currency: "INR",
    timezone: "Asia/Kolkata",
    outletType: "restaurant" as const,
  };
  const keys = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  for (const key of keys.slice(0, 3)) {
    const outlet = await createRestaurant(actor.userId, details, key);
    expect((await createRestaurant(actor.userId, details, key)).id).toBe(outlet.id);
  }
  await expect(createRestaurant(actor.userId, details, keys[3]!)).rejects.toMatchObject({
    cause: { code: "P3001" },
  });
});

it("rejects expired invitations even for a verified matching recipient", async () => {
  const { actor, outlet } = await fixture();
  const recipient = await verified();
  drainAuthTestMessages();
  const invite = await inviteMember(actor, outlet.organizationId, {
    email: recipient.email,
    role: "member",
    key: crypto.randomUUID(),
  });
  const token = drainAuthTestMessages()[0]?.text.match(/\/invite\/([a-f0-9]{64})/)?.[1];
  expect(token).toBeTruthy();
  await admin(async (_db, pool) => {
    await pool.query(
      "update organization_invitations set expires_at=now()-interval '1 minute' where id=$1",
      [invite.id]
    );
  });
  await expect(invitationPreview(recipient, token!)).rejects.toThrow();
  await expect(acceptInvitation(recipient, token!)).rejects.toThrow();
});
it("bounds outstanding invitations and refuses an eleventh pending invitation", async () => {
  const { actor, outlet } = await fixture();
  drainAuthTestMessages();
  for (let i = 0; i < 10; i++) {
    const recipient = await verified();
    const result = await inviteMember(actor, outlet.organizationId, {
      email: recipient.email,
      role: "member",
      key: crypto.randomUUID(),
    });
    expect(result.id).toBeTruthy();
  }
  const extra = await verified();
  await expect(
    inviteMember(actor, outlet.organizationId, {
      email: extra.email,
      role: "member",
      key: crypto.randomUUID(),
    })
  ).rejects.toThrow();
  const invitations = await listInvitations(actor, outlet.organizationId);
  expect(invitations.filter((i) => i.status === "pending")).toHaveLength(10);
});

it("provisions outlet with physical address, GPS coordinates, brand colors, and auto-generates tables", async () => {
  const actor = await verified();
  const superOnboardingDetails = {
    name: "Amber Coastal Bistro",
    outletType: "restaurant" as const,
    description: "Artisan seafood and woodfired specialties",
    addressLine1: "12 Marine Drive",
    addressLine2: "Suite 4B",
    city: "Mumbai",
    state: "Maharashtra",
    postalCode: "400020",
    country: "IN",
    latitude: 18.922,
    longitude: 72.8347,
    phone: "+91 98765 43210",
    email: "contact@amberbistro.test",
    website: "https://amberbistro.test",
    primaryColor: "#f97316",
    secondaryColor: "#1c1917",
    currency: "INR",
    timezone: "Asia/Kolkata",
    fulfillmentModes: ["dine_in" as const, "pickup" as const],
    pickupLeadMinutes: 20,
    pickupSlotMinutes: 15,
    pickupAdvanceDays: 5,
    tableCount: 6,
    menuSchedule: null,
  };

  const saved = await saveOnboarding(actor, superOnboardingDetails);
  expect((await onboardingState(actor)).draft).toEqual(superOnboardingDetails);

  const outlet = await createRestaurant(actor.userId, superOnboardingDetails, saved.key);
  expect(outlet.id).toBeTruthy();

  await admin(async (_, pool) => {
    const res = await pool.query<{
      latitude: string;
      longitude: string;
      address_line1: string;
      primary_color: string;
      table_count: number;
    }>(
      `select r.latitude, r.longitude, r.address_line1, r.primary_color,
              (select count(*)::int from restaurant_tables t where t.restaurant_id = r.id) as table_count
       from restaurants r where r.id = $1`,
      [outlet.id]
    );

    expect(res.rows[0]).toMatchObject({
      address_line1: "12 Marine Drive",
      primary_color: "#f97316",
      table_count: 6,
    });
    expect(parseFloat(res.rows[0]!.latitude)).toBeCloseTo(18.922, 3);
    expect(parseFloat(res.rows[0]!.longitude)).toBeCloseTo(72.8347, 3);
  });
});

it("does not provision dining tables for a pickup-only outlet", async () => {
  const actor = await verified();
  const input = {
    name: "Pickup Only Kitchen",
    outletType: "cloud_kitchen" as const,
    country: "IN",
    currency: "INR",
    timezone: "Asia/Kolkata",
    fulfillmentModes: ["pickup" as const],
    tableCount: 10,
  };
  const saved = await saveOnboarding(actor, input);
  const outlet = await createRestaurant(actor.userId, input, saved.key);
  const rows = await admin(async (_, pool) =>
    pool.query<{ count: number }>(
      "select count(*)::int as count from restaurant_tables where restaurant_id = $1",
      [outlet.id]
    )
  );
  expect(rows.rows[0]?.count).toBe(0);
});
