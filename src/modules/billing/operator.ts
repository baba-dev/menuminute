import { Pool } from "pg";
import { z } from "zod";
const base = {
  key: z.uuid(),
  organizationId: z.string().min(1).max(128),
  operator: z.string().trim().min(3).max(100),
  reason: z.string().trim().min(5).max(500),
};
export const entitlementCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...base,
      action: z.literal("grant"),
      capability: z.enum(["ordering.new", "kitchen.new"]),
      billingCurrency: z.enum(["USD", "INR"]),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
    })
    .strict()
    .refine(
      (v) => Date.parse(v.endsAt) > Date.parse(v.startsAt),
      "Explicit positive grant window required"
    ),
  z.object({ ...base, action: z.literal("revoke"), grantId: z.uuid() }).strict(),
]);
/** Administrative CLI only. The web role has no entitlement write privilege. */
export async function applyEntitlement(pool: Pool, raw: unknown) {
  const command = entitlementCommandSchema.parse(raw);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const org = await client.query("select id from organizations where id=$1 for update", [
      command.organizationId,
    ]);
    if (!org.rowCount) throw new Error("Unknown organization");
    const actor = `operator:${command.operator}`;
    const prior = (
      await client.query(
        "select command,result from domain_commands where organization_id=$1 and actor_id=$2 and request_key=$3",
        [command.organizationId, actor, command.key]
      )
    ).rows[0];
    if (prior) {
      const same = await client.query("select $1::jsonb=$2::jsonb as same", [
        JSON.stringify(prior.command),
        JSON.stringify(command),
      ]);
      if (!same.rows[0].same) throw new Error("Entitlement request key conflict");
      await client.query("COMMIT");
      return prior.result;
    }
    let grantId: string;
    if (command.action === "grant") {
      grantId = crypto.randomUUID();
      await client.query(
        "insert into entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          grantId,
          command.organizationId,
          command.capability,
          command.billingCurrency,
          command.startsAt,
          command.endsAt,
          command.operator,
          command.reason,
          command.key,
        ]
      );
    } else {
      grantId = command.grantId;
      const grant = await client.query(
        "update entitlement_grants set revoked_at=coalesce(revoked_at,now()) where id=$1 and organization_id=$2 returning id",
        [grantId, command.organizationId]
      );
      if (!grant.rowCount) throw new Error("Unknown scoped grant");
    }
    const result = { grantId };
    await client.query("select set_config('app.actor_id',$1,true)", [actor]);
    const version = await client.query("select app_private.record_org_change($1,$2) as version", [
      command.organizationId,
      `entitlement.${command.action}`,
    ]);
    await client.query(
      "update domain_audit set details=details||$3::jsonb where organization_id=$1 and details->>'version'=$2",
      [
        command.organizationId,
        String(version.rows[0].version),
        JSON.stringify({ grantId, operator: command.operator, reason: command.reason }),
      ]
    );
    await client.query(
      "insert into domain_commands(id,organization_id,actor_id,request_key,command,result) values($1,$2,$3,$4,$5,$6)",
      [
        crypto.randomUUID(),
        command.organizationId,
        actor,
        command.key,
        JSON.stringify(command),
        JSON.stringify(result),
      ]
    );
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
