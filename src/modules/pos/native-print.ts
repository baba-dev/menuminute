import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getPool } from "@/db";
import { env } from "@/lib/config/env";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { posReceipt } from "@/modules/pos/service";
import { buildThermalReceipt } from "@/modules/pos/thermal-view";
import { encodeThermalReceipt, type ThermalPaper } from "@/lib/pos/thermal-receipt";
import {
  getDefaultOrActiveRestaurant,
  getRestaurantsByUserId,
} from "@/modules/restaurants/service";

/**
 * Native print bridge contract (Android Bluetooth Classic / USB).
 *
 * The Play TWA cannot open Bluetooth Classic or USB printers, so the web app hands one receipt to a
 * native Android activity. That activity has no browser cookies, so the web session first mints a
 * short-lived, signed GRANT scoped to exactly one sale, paper width, user and session. The native
 * activity redeems it for ESC/POS bytes. The grant is NOT authorization: every redemption re-checks
 * the live session and current outlet membership (posReceipt -> pos_context). Nothing here
 * recalculates money; bytes come from the same immutable receipt view as the receipt page.
 */
export const NATIVE_PRINT_GRANT_TTL_SECONDS = 120;
const VERSION = 1;

const payloadSchema = z.object({
  v: z.literal(VERSION),
  uid: z.string().min(1).max(128),
  sid: z.string().min(1).max(128),
  org: z.string().min(1).max(64),
  out: z.string().min(1).max(64),
  sale: z.string().min(1).max(64),
  paper: z.enum(["58", "80"]),
  exp: z.number().int().positive(),
});
export type NativePrintGrant = z.infer<typeof payloadSchema>;

function key(): Buffer {
  // Domain-separated from every other AUTH_SECRET use.
  return createHmac("sha256", env.AUTH_SECRET).update("menuminute/native-print-grant/v1").digest();
}

function sign(body: string): string {
  return createHmac("sha256", key()).update(body).digest("base64url");
}

export function mintNativePrintGrant(
  input: Omit<NativePrintGrant, "v" | "exp">,
  nowMs: number = Date.now()
): { grant: string; expiresAt: string } {
  const exp = Math.floor(nowMs / 1000) + NATIVE_PRINT_GRANT_TTL_SECONDS;
  const body = Buffer.from(JSON.stringify({ v: VERSION, ...input, exp })).toString("base64url");
  return { grant: `${body}.${sign(body)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifyNativePrintGrant(
  token: unknown,
  nowMs: number = Date.now()
): NativePrintGrant {
  if (typeof token !== "string" || token.length > 2048) throw new UnauthorizedError();
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) throw new UnauthorizedError();
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new UnauthorizedError();
  let parsed: NativePrintGrant;
  try {
    parsed = payloadSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
  } catch {
    throw new UnauthorizedError();
  }
  if (parsed.exp * 1000 <= nowMs) throw new UnauthorizedError();
  return parsed;
}

/** The web request that mints a grant must come from a signed-in member of the active outlet. */
export async function issueNativePrintGrant(
  actor: { userId: string; sessionId: string },
  activeOutletId: string | undefined,
  saleId: string,
  paper: ThermalPaper
) {
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, activeOutletId);
  if (!outlet) throw new ForbiddenError("Choose an outlet first");
  const receipt = await posReceipt(actor, outlet.organizationId, outlet.id, saleId);
  if (receipt.issuedDocumentId)
    throw new ValidationError("Issued fiscal documents are printed from the ledger document page");
  return mintNativePrintGrant({
    uid: actor.userId,
    sid: actor.sessionId,
    org: outlet.organizationId,
    out: outlet.id,
    sale: saleId,
    paper,
  });
}

async function sessionIsActive(userId: string, sessionId: string): Promise<boolean> {
  const result = await getPool().query(
    "select 1 from sessions where id=$1 and user_id=$2 and expires_at>now()",
    [sessionId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

/** Redeem a grant for ESC/POS bytes. Re-validates session and membership on every call. */
export async function redeemNativePrintGrant(token: unknown): Promise<Uint8Array> {
  const grant = verifyNativePrintGrant(token);
  if (!(await sessionIsActive(grant.uid, grant.sid))) throw new UnauthorizedError();
  const outlet = (await getRestaurantsByUserId(grant.uid)).find(
    (o) => o.id === grant.out && o.organizationId === grant.org
  );
  if (!outlet) throw new ForbiddenError("Outlet access changed; open the receipt again");
  const receipt = await posReceipt(
    { userId: grant.uid, sessionId: grant.sid },
    grant.org,
    grant.out,
    grant.sale
  );
  if (receipt.issuedDocumentId)
    throw new ValidationError("Issued fiscal documents are printed from the ledger document page");
  return encodeThermalReceipt(buildThermalReceipt(receipt, outlet), grant.paper);
}
