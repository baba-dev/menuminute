import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import {
  adminArchiveTicket,
  adminListTickets,
  adminReplyTicket,
  adminTicketDetail,
  adminUpdateTicket,
  createSupportTicket,
  listMySupportTickets,
} from "../src/modules/support/service";

async function operator() {
  const f = await fixture();
  const s = { actor: f.actor, organizationId: f.outlet.organizationId, outletId: f.outlet.id };
  return { f, s };
}
async function platformAdmin() {
  const f = await fixture();
  const sessionId = crypto.randomUUID();
  await admin(async (_db, pool) => {
    // The database requires a live session, verified email and 2FA before it honours a platform admin.
    await pool.query(
      "update users set is_super_admin=true,two_factor_enabled=true,email_verified=true where id=$1",
      [f.actor.userId]
    );
    await pool.query(
      "insert into sessions(id,token,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",
      [sessionId, crypto.randomUUID(), f.actor.userId]
    );
  });
  return {
    id: f.actor.userId,
    email: `${f.actor.userId}@test.invalid`,
    name: "Admin",
    twoFactorEnabled: true,
    sessionId,
  };
}
const subject = () => `Printer will not print ${crypto.randomUUID().slice(0, 8)}`;

describe("support tickets: operator side", () => {
  it("creates a ticket, lists it for its owner only, and cleans the text", async () => {
    const a = await operator();
    const b = await operator();
    const t = await createSupportTicket(a.s, {
      subject: subject(),
      details: "The kitchen\u0000 printer stopped\n\nsince noon.",
      category: "kitchen",
    });
    expect(t.ticketNumber).toBeGreaterThan(0);
    const mine = await listMySupportTickets(a.s.actor);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ status: "open", latestReply: null });
    expect(await listMySupportTickets(b.s.actor)).toEqual([]);
    const adminActor = await platformAdmin();
    const detail = await adminTicketDetail(adminActor, t.id);
    expect(detail.body).toBe("The kitchen printer stopped\n\nsince noon.");
    expect(detail.organizationName).toBeTruthy();
  });

  it("rejects bad input, other people's outlets, the demo tenant and floods", async () => {
    const a = await operator();
    const b = await operator();
    await expect(createSupportTicket(a.s, { subject: "hi", details: "x" })).rejects.toThrow();
    await expect(
      createSupportTicket(a.s, { subject: subject(), details: "x", category: "hacking" })
    ).rejects.toThrow();
    await expect(
      createSupportTicket(a.s, { subject: subject(), details: "x", extra: 1 })
    ).rejects.toThrow();
    await expect(
      createSupportTicket(
        { ...b.s, outletId: a.s.outletId, organizationId: a.s.organizationId },
        {
          subject: subject(),
          details: "x",
        }
      )
    ).rejects.toThrow();
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set is_demo_data=true where id=$1", [b.s.outletId]);
    });
    await expect(createSupportTicket(b.s, { subject: subject(), details: "x" })).rejects.toThrow(
      /demo/
    );
    for (let i = 0; i < 10; i++)
      await createSupportTicket(a.s, { subject: subject(), details: "x" });
    await expect(createSupportTicket(a.s, { subject: subject(), details: "x" })).rejects.toThrow();
  });
});

describe("support tickets: admin side", () => {
  it("lists, filters, searches, updates, replies and archives with an audit trail", async () => {
    const op = await operator();
    const boss = await platformAdmin();
    const title = subject();
    const t = await createSupportTicket(op.s, {
      subject: title,
      details: "Please help",
      priority: "high",
    });

    const all = await adminListTickets(boss, { q: title });
    expect(all.tickets.map((x) => x.subject)).toContain(title);
    expect(all.counts.open).toBeGreaterThan(0);
    expect((await adminListTickets(boss, { q: `#${t.ticketNumber}` })).tickets[0]?.id).toBe(t.id);
    expect((await adminListTickets(boss, { q: title, priority: "low" })).tickets).toHaveLength(0);
    expect(
      (await adminListTickets(boss, { q: "%" })).tickets.every((x) =>
        /%/.test(x.subject + x.requesterName + x.requesterEmail + x.organizationName)
      )
    ).toBe(true);

    await adminUpdateTicket(boss, t.id, { status: "in_progress", assign: "me" });
    expect((await adminTicketDetail(boss, t.id)).assigneeId).toBe(boss.id);

    await adminReplyTicket(boss, t.id, { body: "Checking the printer logs", internal: true });
    await adminReplyTicket(boss, t.id, { body: "Please restart the printer and try again." });
    const detail = await adminTicketDetail(boss, t.id);
    expect(detail.messages.map((m) => m.internal)).toEqual([true, false]);
    expect(detail.status).toBe("waiting");

    const mine = await listMySupportTickets(op.s.actor);
    expect(mine[0]?.latestReply?.body).toBe("Please restart the printer and try again.");
    expect(JSON.stringify(mine)).not.toContain("printer logs"); // internal note never leaks

    await adminUpdateTicket(boss, t.id, { status: "resolved" });
    expect((await adminListTickets(boss, { status: "resolved", q: title })).tickets).toHaveLength(
      1
    );

    await adminArchiveTicket(boss, t.id, true);
    expect((await adminListTickets(boss, { q: title })).tickets).toHaveLength(0);
    expect((await adminListTickets(boss, { q: title, archived: true })).tickets).toHaveLength(1);
    expect(await listMySupportTickets(op.s.actor)).toEqual([]);
    await adminArchiveTicket(boss, t.id, false);
    expect((await adminListTickets(boss, { q: title })).tickets).toHaveLength(1);

    const audit = await admin(
      async (_db, pool) =>
        (
          await pool.query(
            "select action,details from admin_audit_logs where target_id=$1 order by created_at",
            [t.id]
          )
        ).rows
    );
    expect(audit.map((r) => r.action)).toEqual([
      "support.update",
      "support.note",
      "support.reply",
      "support.update",
      "support.archive",
      "support.restore",
    ]);
    expect(JSON.stringify(audit)).not.toContain("restart the printer"); // text is never audited
  });

  it("refuses every admin action to a non-admin and never shows other people's tickets", async () => {
    const op = await operator();
    const other = await operator();
    const t = await createSupportTicket(op.s, { subject: subject(), details: "Help" });
    const impostor = {
      id: other.s.actor.userId,
      email: "x@test.invalid",
      name: "x",
      twoFactorEnabled: true,
      sessionId: "s",
    };
    await expect(adminUpdateTicket(impostor, t.id, { status: "closed" })).rejects.toThrow();
    await expect(adminReplyTicket(impostor, t.id, { body: "hi" })).rejects.toThrow();
    await expect(adminArchiveTicket(impostor, t.id, true)).rejects.toThrow();
    await expect(adminTicketDetail(impostor, t.id)).rejects.toThrow();
    expect((await adminListTickets(impostor, {})).tickets).toEqual([]);
  });

  it("rejects invalid updates and assigning someone who is not an admin", async () => {
    const op = await operator();
    const boss = await platformAdmin();
    const t = await createSupportTicket(op.s, { subject: subject(), details: "Help" });
    await expect(adminUpdateTicket(boss, t.id, {})).rejects.toThrow();
    await expect(adminUpdateTicket(boss, t.id, { status: "bogus" })).rejects.toThrow();
    await expect(adminReplyTicket(boss, t.id, { body: "   " })).rejects.toThrow();
  });
});
