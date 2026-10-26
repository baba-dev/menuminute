import { sql } from "drizzle-orm";
import { z } from "zod";
import { withActor } from "@/modules/tenancy/service";
import { type AdminActor } from "@/lib/admin-guard";

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const sha = z.string().regex(/^[a-f0-9]{40}$/);
export const pilotCommandSchema = z
  .object({
    outletId: id,
    action: z.enum(["request", "approve", "activate", "drain", "finalize"]),
    releaseSha: z.string().max(40).default(""),
    evidenceUrl: z.string().max(500).default(""),
    reason: z.string().trim().min(10).max(500),
    key: z.uuid(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (["request", "approve", "activate"].includes(value.action)) {
      if (!sha.safeParse(value.releaseSha).success)
        ctx.addIssue({ code: "custom", path: ["releaseSha"], message: "Exact 40-character release SHA required" });
    }
    if (["request", "approve"].includes(value.action) &&
      !/^https:\/\/github\.com\/baba-dev\/menuminute\/(issues|pull)\/[0-9]+/.test(value.evidenceUrl))
      ctx.addIssue({ code: "custom", path: ["evidenceUrl"], message: "Link to the reviewed GitHub evidence" });
  });
export type PilotCommand = z.input<typeof pilotCommandSchema>;

export type KitchenPilotStatus = {
  outletId: string;
  organizationId: string;
  state: "setup" | "requested" | "approved" | "active" | "draining" | "disabled";
  revision: number;
  releaseSha: string | null;
  evidenceUrl: string | null;
  requestedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  enabled: boolean;
  activeStations: number;
  assignedMembers: number;
  publishedDishes: number;
  unroutedDishes: number;
  openKitchenOrders: number;
  orderingEntitled: boolean;
  kitchenEntitled: boolean;
  configurationReady: boolean;
};

export type KitchenPilotTarget = {
  id: string;
  name: string;
  organizationName: string;
  organizationId: string;
};

const actorScope = (actor: AdminActor) => ({
  userId: actor.id,
  sessionId: actor.sessionId,
});

export async function findKitchenPilotTargets(actor: AdminActor, query: string) {
  const term = query.trim().slice(0, 80);
  if (term.length < 2) return [] as KitchenPilotTarget[];
  const pattern = "%" + term.replace(/[%_\\]/g, (match) => "\\" + match) + "%";
  return withActor(actorScope(actor), async (tx) => {
    const result = await tx.execute<KitchenPilotTarget>(sql`
      SELECT r.id, r.name, r.organization_id AS "organizationId",
        o.name AS "organizationName"
      FROM restaurants r JOIN organizations o ON o.id=r.organization_id
      WHERE (r.name ILIKE ${pattern} ESCAPE '\' OR o.name ILIKE ${pattern} ESCAPE '\')
      ORDER BY o.name,r.name,r.id LIMIT 25
    `);
    return result.rows;
  });
}

/** The DB authorization is authoritative. Never rely on UI/readiness preview for writes. */
export async function kitchenPilotStatus(actor: AdminActor, outletId: string) {
  const parsed = id.parse(outletId);
  return withActor(actorScope(actor), async (tx) => {
    const result = await tx.execute<{ data: KitchenPilotStatus }>(
      sql`SELECT app_private.kitchen_pilot_status(${parsed}) AS data`
    );
    if (!result.rows[0]) throw new Error("Kitchen pilot status unavailable");
    return result.rows[0].data;
  });
}

/** One-use step-up, live superadmin and distinct reviewer are revalidated in PostgreSQL. */
export async function kitchenPilotCommand(actor: AdminActor, input: PilotCommand) {
  const parsed = pilotCommandSchema.parse(input);
  if (parsed.action === "activate") {
    const deployedSha = process.env.NEXT_PUBLIC_RELEASE_SHA;
    if (!deployedSha || !sha.safeParse(deployedSha).success ||
        deployedSha !== parsed.releaseSha) {
      throw new Error("The deployed release SHA does not match the reviewed candidate");
    }
  }
  return withActor(actorScope(actor), async (tx) => {
    const result = await tx.execute<{ data: KitchenPilotStatus }>(
      sql`SELECT app_private.kitchen_pilot_command(
        ${parsed.outletId},${parsed.action},
        ${JSON.stringify({
          releaseSha: parsed.releaseSha,
          evidenceUrl: parsed.evidenceUrl,
          reason: parsed.reason,
        })}::jsonb,${parsed.key}
      ) AS data`
    );
    if (!result.rows[0]) throw new Error("Pilot command returned no receipt");
    return result.rows[0].data;
  });
}

export function kitchenPilotFailureMessage(error: unknown) {
  if (error instanceof z.ZodError) return "Check the outlet, audit reason, release SHA and evidence URL.";
  if (error instanceof Error && error.message.includes("deployed release SHA"))
    return "This server is not running the approved release SHA; activation denied.";
  let cause: unknown = error;
  for (let i = 0; i < 4 && cause && typeof cause === "object"; i++) {
    const message = "message" in cause && typeof cause.message === "string" ? cause.message : "";
    if (/privileged action|password and authenticator/.test(message))
      return "Confirm your password and TOTP again; the single-use proof may have expired.";
    if (/Separate operator|requested evidence/.test(message))
      return "Approval requires a second superadmin reviewing the exact request and evidence.";
    if (/configuration|outstanding work|drain/i.test(message))
      return "The outlet is not ready, or live tickets still need to be completed. Refresh readiness.";
    if (/Unapproved|expired or mismatched/.test(message))
      return "Approval expired or the reviewed release SHA does not match. Request a new review.";
    cause = "cause" in cause ? cause.cause : undefined;
  }
  return "The command could not be confirmed. Refresh status before retrying; do not assume it failed.";
}
