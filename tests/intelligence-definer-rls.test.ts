import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { describe, expect, it, vi } from "vitest";
import { fixture } from "./helpers";
import {
  beginTurn,
  createConversation,
  reserveAttempt,
  settleAttempt,
} from "../src/modules/intelligence/store";
import {
  actionKinds,
  decideAction,
  proposeAction,
} from "../src/modules/intelligence/action-requests";
import {
  adminReplyTicket,
  adminTicketDetail,
  createSupportTicket,
} from "../src/modules/support/service";

const spend = {
  reservationMicroUsd: 15,
  dailyCapMicroUsd: 18,
  inputPriceMicroUsdMtok: 1_000_000,
  outputPriceMicroUsdMtok: 1_000_000,
};
const TABLES = [
  "assistant_conversations",
  "assistant_turns",
  "assistant_attempts",
  "assistant_action_proposals",
];
const FUNCTIONS = [
  "app_private.ai_settle_model_spend(text,text,text,text,boolean,integer,integer)",
  "app_private.ai_reserve_model_spend(text,text,text,text,text,bigint,bigint)",
];

/**
 * CI's migration owner is a superuser and bypasses row security, which hid a production-only
 * failure: with a NOSUPERUSER/NOBYPASSRLS owner, SECURITY DEFINER settlement saw no rows.
 */
describe("Ember definer functions under a non-superuser owner", () => {
  it("fails without the owner policy and settles with migration 0064", async () => {
    const owner = new pg.Client({ connectionString: process.env["MIGRATION_DATABASE_URL"] });
    await owner.connect();
    const sqlFile = await readFile(
      path.resolve("src/db/migrations/0064_assistant_definer_rls.sql"),
      "utf8"
    );
    const original = (await owner.query("select current_user as u")).rows[0].u as string;
    try {
      await owner.query("drop owned by ember_plain_owner").catch(() => {});
      await owner.query("drop role if exists ember_plain_owner");
      await owner.query("create role ember_plain_owner nosuperuser nobypassrls");
      await owner.query("grant ember_plain_owner to current_user");
      await owner.query("grant usage on schema public, app_private to ember_plain_owner");
      await owner.query(
        "grant execute on function app_private.ai_scope(text,text,text) to ember_plain_owner"
      );
      await owner.query(
        "grant all on assistant_model_daily_budget, users, organizations to ember_plain_owner"
      );
      for (const t of TABLES) await owner.query(`alter table ${t} owner to ember_plain_owner`);
      for (const f of FUNCTIONS)
        await owner.query(`alter function ${f} owner to ember_plain_owner`);
      await owner.query(
        "drop policy if exists ai_definer_assistant_attempts on assistant_attempts"
      );

      const f = await fixture();
      const scope = {
        actor: f.actor,
        organizationId: f.outlet.organizationId,
        outletId: f.outlet.id,
      };
      const conversation = await createConversation(scope, crypto.randomUUID());
      const turn = await beginTurn(scope, conversation.id, {
        key: crypto.randomUUID(),
        prompt: "How many orders are pending?",
      });
      const attempt = await reserveAttempt(scope, turn.turn, 1, "nvidia", "reviewed/model", spend);
      await expect(settleAttempt(scope, attempt, null)).rejects.toThrow(/inaccessible/);

      await owner.query("set role ember_plain_owner");
      await owner.query(sqlFile);
      await owner.query("reset role");
      await expect(settleAttempt(scope, attempt, null)).resolves.toBeUndefined();
    } finally {
      await owner.query("reset role");
      for (const t of TABLES) await owner.query(`alter table ${t} owner to ${original}`);
      for (const fn of FUNCTIONS) await owner.query(`alter function ${fn} owner to ${original}`);
      await owner.query("drop owned by ember_plain_owner");
      await owner.query("drop role ember_plain_owner");
      await owner.query(sqlFile);
      await owner.end();
    }
  }, 60000);

  it("lets the generic action-request functions work under a non-superuser owner", async () => {
    const owner = new pg.Client({ connectionString: process.env["MIGRATION_DATABASE_URL"] });
    await owner.connect();
    const original = (await owner.query("select current_user as u")).rows[0].u as string;
    const fns = [
      "app_private.ai_propose_action(text,text,text,text,jsonb,jsonb,text,text,uuid)",
      "app_private.ai_claim_action(text,text,uuid,uuid,text,text)",
      "app_private.ai_finish_action(text,text,uuid,uuid,text,jsonb)",
    ];
    try {
      await owner.query("drop owned by ember_plain_owner").catch(() => {});
      await owner.query("drop role if exists ember_plain_owner");
      await owner.query("create role ember_plain_owner nosuperuser nobypassrls");
      await owner.query("grant usage on schema public, app_private to ember_plain_owner");
      await owner.query(
        "grant execute on function app_private.ai_scope(text,text,text) to ember_plain_owner"
      );
      await owner.query(
        "grant execute on function app_private.can_outlet(text,text) to ember_plain_owner"
      );
      await owner.query("grant all on assistant_conversations, users to ember_plain_owner");
      // Mirrors migration 0064's owner policy for the role that owns the functions.
      await owner.query(
        "create policy tmp_plain_owner on assistant_conversations for all to ember_plain_owner using (true)"
      );
      await owner.query("alter table assistant_action_requests owner to ember_plain_owner");
      await owner.query(
        "create policy tmp_plain_owner on assistant_action_requests for all to ember_plain_owner using (true) with check (true)"
      );
      for (const fn of fns) await owner.query(`alter function ${fn} owner to ember_plain_owner`);
      const f = await fixture();
      const scope = {
        actor: f.actor,
        organizationId: f.outlet.organizationId,
        outletId: f.outlet.id,
      };
      const conversation = await createConversation(scope, crypto.randomUUID());
      const request = await proposeAction(scope, {
        conversationId: conversation.id,
        key: crypto.randomUUID(),
        kind: "service_request.acknowledge",
        params: { requestId: crypto.randomUUID() },
        summary: "Mark a request as seen",
      });
      const spy = vi
        .spyOn(actionKinds["service_request.acknowledge"], "execute")
        .mockResolvedValue({ status: "confirmed", message: "Marked as seen by staff." });
      const done = await decideAction(scope, request.id, {
        key: crypto.randomUUID(),
        decision: "confirm",
      });
      expect(done).toMatchObject({ status: "confirmed" });
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      vi.restoreAllMocks();
      await owner.query("reset role");
      await owner.query(`alter table assistant_action_requests owner to ${original}`);
      for (const fn of fns) await owner.query(`alter function ${fn} owner to ${original}`);
      await owner.query("drop owned by ember_plain_owner");
      await owner.query("drop role ember_plain_owner");
      await owner.end();
    }
  }, 60000);

  it("lets the support-desk functions work under a non-superuser owner", async () => {
    const owner = new pg.Client({ connectionString: process.env["MIGRATION_DATABASE_URL"] });
    await owner.connect();
    const original = (await owner.query("select current_user as u")).rows[0].u as string;
    const fns = [
      "app_private.support_create_ticket(text,text,text,text,text,text,text)",
      "app_private.support_admin_update(uuid,text,text,text,boolean)",
      "app_private.support_admin_reply(uuid,text,boolean,text)",
    ];
    const tables = ["support_tickets", "support_ticket_messages"];
    const core = ["users", "restaurants", "organizations"];
    try {
      await owner.query("drop owned by ember_plain_owner").catch(() => {});
      await owner.query("drop role if exists ember_plain_owner");
      await owner.query("create role ember_plain_owner nosuperuser nobypassrls");
      await owner.query("grant usage on schema public, app_private to ember_plain_owner");
      for (const f of ["app_private.can_outlet(text,text)", "app_private.is_super_admin(text)"])
        await owner.query(`grant execute on function ${f} to ember_plain_owner`);
      // The production migration owner owns every table (so ordinary row security does not hide
      // restaurants/organizations/users from it); mirror that for the temporary owner.
      for (const t of core) await owner.query(`alter table ${t} owner to ember_plain_owner`);
      for (const t of tables) {
        await owner.query(`alter table ${t} owner to ember_plain_owner`);
        await owner.query(
          `create policy tmp_plain_owner on ${t} for all to ember_plain_owner using (true) with check (true)`
        );
      }
      for (const fn of fns) await owner.query(`alter function ${fn} owner to ember_plain_owner`);
      const f = await fixture();
      const scope = {
        actor: f.actor,
        organizationId: f.outlet.organizationId,
        outletId: f.outlet.id,
      };
      const ticket = await createSupportTicket(scope, {
        subject: "Printer will not print",
        details: "Please help",
      });
      expect(ticket.ticketNumber).toBeGreaterThan(0);
      const sessionId = crypto.randomUUID();
      await owner.query(
        "update users set is_super_admin=true,two_factor_enabled=true,email_verified=true where id=$1",
        [f.actor.userId]
      );
      await owner.query(
        "insert into sessions(id,token,user_id,expires_at) values($1,$2,$3,now()+interval '1 hour')",
        [sessionId, crypto.randomUUID(), f.actor.userId]
      );
      const boss = {
        id: f.actor.userId,
        email: "a@test.invalid",
        name: "A",
        twoFactorEnabled: true,
        sessionId,
      };
      await adminReplyTicket(boss, ticket.id, { body: "On it." });
      expect((await adminTicketDetail(boss, ticket.id)).status).toBe("waiting");
    } finally {
      await owner.query("reset role");
      for (const t of [...tables, ...core])
        await owner.query(`alter table ${t} owner to ${original}`);
      for (const fn of fns) await owner.query(`alter function ${fn} owner to ${original}`);
      await owner.query("drop owned by ember_plain_owner");
      await owner.query("drop role ember_plain_owner");
      await owner.end();
    }
  }, 60000);
});
