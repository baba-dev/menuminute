import { z } from "zod";

export const TIFFIN_OUTLET_TYPE = "tiffin" as const;
export const SLOT_KINDS = ["lunch", "dinner"] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

const MAX_PRICE_MINOR = 2147483647;

export const slotInputSchema = z
  .object({
    kind: z.enum(SLOT_KINDS),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
    cutoffMinutesBefore: z.number().int().min(0).max(10080),
    capacity: z.number().int().min(1).max(MAX_PRICE_MINOR).nullable(),
  })
  .refine((slot) => slot.endMinute > slot.startMinute, {
    message: "endMinute must be after startMinute",
    path: ["endMinute"],
  });

export const comboInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(300).default(""),
  priceMinor: z.number().int().min(0).max(MAX_PRICE_MINOR),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .min(1)
    .max(20),
  addons: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        priceMinor: z.number().int().min(0).max(MAX_PRICE_MINOR),
      })
    )
    .max(20),
});

export const areaInputSchema = z.object({ name: z.string().trim().min(1).max(60) });

const idList = z
  .array(z.string().min(1).max(64))
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, { message: "comboIds must be unique" });

const localDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }, "Not a valid calendar date");

export const comboSaveSchema = comboInputSchema
  .extend({ id: z.string().min(1).max(64).optional() })
  .strict();

export const weekSetSchema = z
  .object({
    slotKind: z.enum(SLOT_KINDS),
    weekday: z.number().int().min(0).max(6),
    comboIds: idList,
  })
  .strict();

export const overrideSetSchema = z
  .object({
    slotKind: z.enum(SLOT_KINDS),
    localDate,
    closed: z.boolean(),
    comboIds: idList,
  })
  .strict();

export const tiffinQuoteInputSchema = z
  .object({
    localDate,
    slotKind: z.enum(SLOT_KINDS),
    lines: z
      .array(
        z
          .object({
            comboId: z.string().min(1).max(64),
            addonIds: z.array(z.string().min(1).max(64)).max(20),
            quantity: z.number().int().min(1).max(99),
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict();

const strictFlag = z.enum(["true", "false"]).transform((v) => v === "true");

/** Parses only TIFFIN_ENABLED at call time (fail closed: unset is off, other values throw). */
export function tiffinFlagEnabled(): boolean {
  const raw = process.env["TIFFIN_ENABLED"];
  return raw === undefined ? false : strictFlag.parse(raw);
}

export function tiffinEnabled(): boolean {
  return tiffinFlagEnabled();
}
