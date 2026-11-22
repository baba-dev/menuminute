import { sql } from "drizzle-orm";
import { z } from "zod";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { normalizePayeeName, parseUpiId } from "@/lib/pos/upi";
import { withActor, withOutlet, type Actor } from "@/modules/tenancy/service";

/** Per-outlet UPI payee used to print a pre-filled "Scan & Pay" QR on unpaid INR receipts.
 * MenuMinute only prints a link the merchant's own UPI ID accepts: no provider call, no payment
 * confirmation. Authorization is enforced in the database functions (migration 0114).
 */
const profileSchema = z.object({
  configured: z.boolean(),
  upiId: z.string().nullable(),
  payeeName: z.string().nullable(),
  enabled: z.boolean(),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
});
export type ReceiptPaymentProfile = z.infer<typeof profileSchema>;

export const receiptPaymentCommandSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    upiId: z
      .string()
      .max(400)
      .transform((value, ctx) => {
        const parsed = parseUpiId(value);
        if (!parsed) {
          ctx.addIssue({ code: "custom", message: "Enter a valid UPI ID such as name@bank." });
          return z.NEVER;
        }
        return parsed;
      }),
    payeeName: z
      .string()
      .max(400)
      .transform((value, ctx) => {
        const parsed = normalizePayeeName(value);
        if (!parsed) {
          ctx.addIssue({
            code: "custom",
            message: "Payee name must be 2 to 40 letters, numbers or . & ' -",
          });
          return z.NEVER;
        }
        return parsed;
      }),
    enabled: z.boolean(),
  })
  .strict();

function sqlCode(error: unknown): string {
  const inner = error instanceof Error && error.cause ? error.cause : error;
  return inner && typeof inner === "object" && "code" in inner ? String(inner.code) : "";
}

/** Readable by anyone who may print receipts for the outlet, and by outlet managers. */
export async function getOutletReceiptPayment(
  actor: Actor,
  organizationId: string,
  outletId: string
): Promise<ReceiptPaymentProfile> {
  try {
    return await withActor(actor, async (tx) => {
      await tx.execute(sql`select set_config('app.outlet_id',${outletId},true)`);
      const result = await tx.execute<{ profile: unknown }>(
        sql`select app_private.read_outlet_receipt_payment(${organizationId},${outletId}) as profile`
      );
      return profileSchema.parse(result.rows[0]?.profile);
    });
  } catch (error) {
    if (sqlCode(error) === "42501") throw new ForbiddenError();
    throw error;
  }
}

export async function saveOutletReceiptPayment(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
): Promise<ReceiptPaymentProfile> {
  const input = receiptPaymentCommandSchema.parse(raw);
  try {
    return await withOutlet(actor, outletId, "outlet.manage", async (tx) => {
      const result = await tx.execute<{ profile: unknown }>(
        sql`select app_private.save_outlet_receipt_payment(
          ${organizationId},${outletId},${input.expectedRevision},
          ${JSON.stringify({ upiId: input.upiId, payeeName: input.payeeName, enabled: input.enabled })}::jsonb
        ) as profile`
      );
      return profileSchema.parse(result.rows[0]?.profile);
    });
  } catch (error) {
    const code = sqlCode(error);
    if (code === "40001")
      throw new ConflictError(
        "Receipt payment settings changed elsewhere. Reload and review before saving."
      );
    if (code === "22023") throw new ValidationError("Invalid UPI ID or payee name");
    if (code === "42501") throw new ForbiddenError();
    throw error;
  }
}
