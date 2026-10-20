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
  await expect(createRestaurant(actor.userId, details, keys[3]!)).rejects.toMatchObject({ code: "P3001" });
});
