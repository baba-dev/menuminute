import { z } from "zod";

export const orderItemSubmissionSchema = z.object({
  dishId: z.string().min(1).max(128),
  variantId: z.string().min(1).max(128).nullable().optional(),
  selectedAddOns: z
    .array(
      z.object({
        groupId: z.string().min(1).max(128),
        optionId: z.string().min(1).max(128),
      })
    )
    .max(150)
    .superRefine((items, ctx) => {
      const keys = items.map((item) => item.groupId + ":" + item.optionId);
      if (new Set(keys).size !== keys.length)
        ctx.addIssue({ code: "custom", message: "Duplicate add-on option" });
    })
    .default([]),
  quantity: z.number().int().min(1).max(99),
  itemNotes: z.string().trim().max(200).optional(),
});

export const orderSubmissionSchema = z.object({
  clientSubmissionKey: z.string().uuid(),
  quotedTotalMinor: z.number().int().min(0).max(2147483647),
  fulfillmentMode: z.enum(["dine_in", "pickup"]).default("dine_in"),
  customerName: z.string().trim().max(80).optional().default(""),
  customerPhone: z.string().trim().max(30).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  items: z.array(orderItemSubmissionSchema).min(1).max(50),
});

export const orderTransitionSchema = z.object({
  targetStatus: z.enum([
    "accepted",
    "preparing",
    "ready",
    "served",
    "collected",
    "rejected",
    "cancelled",
  ]),
  paymentStatus: z.enum(["unpaid", "paid", "voided"]).optional(),
  reason: z.string().trim().max(300).optional(),
  expectedVersion: z.number().int().min(1),
});

export type OrderItemSubmission = z.infer<typeof orderItemSubmissionSchema>;
export type OrderSubmissionInput = z.infer<typeof orderSubmissionSchema>;
export type OrderTransitionInput = z.infer<typeof orderTransitionSchema>;

export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "collected"
  | "rejected"
  | "cancelled"
  | "expired";

export type PaymentStatus = "unpaid" | "paid" | "voided";

export const orderPaymentSchema = z
  .object({
    expectedVersion: z.number().int().min(1),
    paymentStatus: z.enum(["paid", "voided"]),
    paymentMethod: z.enum(["cash", "card", "other"]),
  })
  .strict();
