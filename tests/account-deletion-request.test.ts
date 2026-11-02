import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import {
  cancelAccountDeletion,
  getAccountDeletionRequest,
  requestAccountDeletion,
} from "../src/modules/support/account-deletion";
import { adminListTickets } from "../src/modules/support/service";

function weekdayCount(createdAt: string, dueAt: string) {
  const created = new Date(createdAt);
  const deadline = new Date(dueAt);
  const day = new Date(
    Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate())
  );
  let weekdays = 0;
  while (day < deadline) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (day >= deadline) break;
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) weekdays += 1;
  }
  return weekdays;
}

describe("reversible personal account deletion ticket", () => {
  it("creates one admin ticket, applies seven UTC weekdays, and allows cancellation", async () => {
    const f = await fixture();
    const input = {
      organizationId: f.outlet.organizationId,
      outletId: f.outlet.id,
      confirm: true as const,
    };
    expect(await getAccountDeletionRequest(f.actor)).toBeNull();
    const first = await requestAccountDeletion(f.actor, input);
    const second = await requestAccountDeletion(f.actor, input);
    expect(first.ticketNumber).toBe(second.ticketNumber);
    const status = await getAccountDeletionRequest(f.actor);
    expect(status).toMatchObject({
      ticketNumber: first.ticketNumber,
      canCancel: true,
      cancelledAt: null,
    });
    expect(weekdayCount(first.createdAt, first.dueAt)).toBe(7);

    const queue = await admin(
      async (_db, pool) =>
        (
          await pool.query(
            "select subject,body,status from support_tickets where ticket_number=$1",
            [first.ticketNumber]
          )
        ).rows
    );
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ subject: "Account deletion request", status: "open" });
    expect(queue[0].body).toContain("retention and ownership review");

    const cancelled = await cancelAccountDeletion(f.actor);
    expect(cancelled.cancelledAt).toBeTruthy();
    expect((await getAccountDeletionRequest(f.actor))?.canCancel).toBe(false);
    const withdrawn = await admin(
      async (_db, pool) =>
        (
          await pool.query("select subject,status from support_tickets where ticket_number=$1", [
            first.ticketNumber,
          ])
        ).rows
    );
    expect(withdrawn[0]).toMatchObject({
      subject: "Account deletion request (withdrawn)",
      status: "closed",
    });
    await expect(cancelAccountDeletion(f.actor)).rejects.toThrow();
  });

  it("never permits a different signed-in account to cancel another user's request", async () => {
    const owner = await fixture();
    const other = await fixture();
    await requestAccountDeletion(owner.actor, {
      organizationId: owner.outlet.organizationId,
      outletId: owner.outlet.id,
      confirm: true,
    });
    expect(await getAccountDeletionRequest(other.actor)).toBeNull();
    await expect(cancelAccountDeletion(other.actor)).rejects.toThrow(/No active/);
    await expect(
      requestAccountDeletion(other.actor, {
        organizationId: owner.outlet.organizationId,
        outletId: owner.outlet.id,
        confirm: true,
      })
    ).rejects.toThrow();
  });

  it("requires confirmation and refuses untrusted organization fields", async () => {
    const f = await fixture();
    await expect(
      requestAccountDeletion(f.actor, {
        organizationId: f.outlet.organizationId,
        outletId: f.outlet.id,
        confirm: false,
      })
    ).rejects.toThrow();
    await expect(
      requestAccountDeletion(f.actor, {
        organizationId: f.outlet.organizationId,
        outletId: f.outlet.id,
        confirm: true,
        unexpected: "value",
      })
    ).rejects.toThrow();
  });
});
