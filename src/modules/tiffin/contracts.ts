import { z } from "zod";
import { parseEnv } from "@/lib/config/env";

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

/** Reads the flag at call time (not the import-time `env` snapshot) so tests can toggle it. */
export function tiffinEnabled(): boolean {
  return parseEnv(process.env).TIFFIN_ENABLED;
}
