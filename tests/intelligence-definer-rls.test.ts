import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { fixture } from "./helpers";
import {
  beginTurn,
  createConversation,
  reserveAttempt,
  settleAttempt,
} from "../src/modules/intelligence/store";

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
});
