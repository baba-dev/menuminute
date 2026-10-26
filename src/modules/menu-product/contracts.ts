import { z } from "zod";
import { currencyExponent } from "@/lib/money";
export const entityId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const title = z.string().trim().min(1).max(100);
export const minor = z.number().int().min(0).max(2147483647);
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const window = z
  .object({ start: clock, end: clock, allDay: z.boolean().default(false) })
  .strict()
  .refine((w) => w.allDay || w.start !== w.end, "Use all-day for equal times");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (d) => !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d,
    "Invalid date"
  );
export const scheduleSchema = z
  .object({
    weekly: z.array(window.safeExtend({ day: z.number().int().min(0).max(6) })).max(28),
    exceptions: z
      .array(
        z
          .object({ date, closed: z.boolean(), windows: z.array(window).max(8) })
          .strict()
          .refine((e) => !e.closed || e.windows.length === 0)
      )
      .max(366),
  })
  .strict()
  .refine(
    (s) => new Set(s.exceptions.map((e) => e.date)).size === s.exceptions.length,
    "Duplicate exception date"
  );
const option = z
  .object({ id: entityId, name: title, priceMinor: minor, isAvailable: z.boolean().default(true) })
  .strict();
const group = z
  .object({
    id: entityId,
    name: title,
    min: z.number().int().min(0),
    max: z.number().int().min(1),
    options: z.array(option).min(1).max(100),
  })
  .strict()
  .refine((g) => g.min <= g.max && g.max <= g.options.length, "Invalid selection rule");
export const allergenEnum = z.enum([
  "dairy",
  "gluten",
  "nuts",
  "peanuts",
  "eggs",
  "soy",
  "fish",
  "shellfish",
  "sesame",
  "mustard",
  "sulfites",
]);
export type Allergen = z.infer<typeof allergenEnum>;

export const nutritionSchema = z
  .object({
    calories: z.number().int().min(0).max(10000).optional(),
    proteinGrams: z.number().min(0).max(1000).optional(),
    carbsGrams: z.number().min(0).max(1000).optional(),
    fatGrams: z.number().min(0).max(1000).optional(),
    fiberGrams: z.number().min(0).max(500).optional(),
    servingSize: z.string().trim().max(60).optional(),
    verified: z.boolean().optional(),
  })
  .strict();
export type DishNutrition = z.infer<typeof nutritionSchema>;

export const culinaryProfileSchema = z
  .object({
    spiceLevel: z.number().int().min(0).max(4).default(0),
    flavorNotes: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
    chefNote: z.string().trim().max(300).optional(),
    servingTemp: z.enum(["hot", "chilled", "ambient"]).optional(),
    pairingDishIds: z.array(entityId).max(4).default([]),
  })
  .strict();
export type DishCulinaryProfile = z.infer<typeof culinaryProfileSchema>;

export const safetyProfileSchema = z
  .object({
    ingredients: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    allergens: z.array(allergenEnum).max(11).default([]),
    crossContact: z.string().trim().max(250).optional(),
    verified: z.boolean().optional(),
    verifiedFreeFrom: z
      .array(z.enum(["nuts", "dairy"]))
      .max(2)
      .optional(),
  })
  .strict()
  .superRefine((profile, ctx) => {
    const freeFrom = profile.verifiedFreeFrom ?? [];
    if (freeFrom.length !== new Set(freeFrom).size)
      ctx.addIssue({ code: "custom", message: "Duplicate free-from claim" });
    if (!freeFrom.length) return;
    if (!profile.verified || profile.ingredients.length === 0 || profile.crossContact?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["verifiedFreeFrom"],
        message: "Free-from claims require verified ingredients and no cross-contact warning",
      });
    }
    if (
      (freeFrom.includes("nuts") &&
        profile.allergens.some((a) => a === "nuts" || a === "peanuts")) ||
      (freeFrom.includes("dairy") && profile.allergens.includes("dairy"))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["verifiedFreeFrom"],
        message: "Free-from claim conflicts with declared allergens",
      });
    }
  });
export type DishSafetyProfile = z.infer<typeof safetyProfileSchema>;

export const dishSchema = z
  .object({
    id: entityId,
    name: title,
    description: z.string().max(1000).default(""),
    priceMinor: minor,
    soldOut: z.boolean().default(false),
    archived: z.boolean().default(false),
    mediaId: entityId.nullable().default(null),
    artworkId: z
      .string()
      .regex(/^[a-z0-9-]+__[a-z0-9-]+$/)
      .nullable()
      .default(null),
    imageMode: z.enum(["auto", "artwork", "photo", "none"]).default("auto"),
    dietary: z
      .array(z.enum(["vegetarian", "vegan", "gluten_free"]))
      .max(3)
      .default([]),
    nutrition: nutritionSchema.optional(),
    culinary: culinaryProfileSchema.optional(),
    safety: safetyProfileSchema.optional(),
    variants: z.array(option).max(100).default([]),
    addOnGroups: z.array(group).max(30).default([]),
    schedule: scheduleSchema.nullable().default(null),
  })
  .strict()
  .superRefine((dish, ctx) => {
    if (dish.imageMode === "photo" && !dish.mediaId)
      ctx.addIssue({ code: "custom", path: ["mediaId"], message: "Select an approved photo" });
    if (dish.imageMode === "artwork" && !dish.artworkId)
      ctx.addIssue({ code: "custom", path: ["artworkId"], message: "Select an illustration" });
  });
export const menuDocumentSchema = z
  .object({
    name: title,
    currency: z.string().refine((v) => currencyExponent(v) !== null, "Unsupported currency"),
    schedule: scheduleSchema.nullable().default(null),
    presentation: z
      .object({
        cover: z
          .enum(["artisan-bakery", "cafe-coffee", "indian-restaurant", "street-food-cloud-kitchen"])
          .default("indian-restaurant"),
        headline: z.string().trim().max(110).default(""),
        featuredDishIds: z.array(entityId).max(8).default([]),
      })
      .strict()
      .optional(),
    categories: z
      .array(
        z
          .object({
            id: entityId,
            name: title,
            description: z.string().max(500).default(""),
            archived: z.boolean().default(false),
            items: z.array(dishSchema).max(1000),
          })
          .strict()
      )
      .max(100),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const ids: string[] = [];
    for (const c of doc.categories) {
      ids.push(c.id);
      for (const i of c.items) {
        ids.push(i.id);
        for (const v of i.variants) ids.push(v.id);
        for (const g of i.addOnGroups) {
          ids.push(g.id);
          for (const o of g.options) ids.push(o.id);
        }
      }
    }
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "Category, dish and option IDs must be unique" });
    if (JSON.stringify(doc).length > 500000)
      ctx.addIssue({ code: "custom", message: "Menu document exceeds operational request limit" });
  });
export type MenuDocument = z.infer<typeof menuDocumentSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export const menuCommandSchema = z
  .object({
    key: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    action: z.enum([
      "create",
      "save",
      "publish",
      "unpublish",
      "archive",
      "restore",
      "assign",
      "override",
    ]),
    data: z.record(z.string(), z.unknown()),
  })
  .strict();
export function validateMenuCommand(raw: unknown) {
  const c = menuCommandSchema.parse(raw);
  switch (c.action) {
    case "create":
    case "save":
      c.data = z.object({ document: menuDocumentSchema }).strict().parse(c.data);
      break;
    case "assign":
      c.data = z
        .object({ outletId: entityId, brandId: entityId.nullable(), assigned: z.boolean() })
        .strict()
        .parse(c.data);
      break;
    case "override":
      c.data = z
        .object({
          outletId: entityId,
          dishId: entityId,
          priceMinor: minor.nullable(),
          soldOut: z.boolean().nullable(),
        })
        .strict()
        .parse(c.data);
      break;
    default:
      c.data = z.object({}).strict().parse(c.data);
  }
  return c;
}
export function availableNow(schedule: Schedule | null, timezone: string, instant: Date) {
  if (!schedule) return true;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (k: string) => parts.find((p) => p.type === k)!.value;
  const local = `${get("year")}-${get("month")}-${get("day")}`;
  const dayDate = new Date(`${local}T00:00:00Z`);
  const minute = Number(get("hour")) * 60 + Number(get("minute"));
  const previous = new Date(dayDate.valueOf() - 86400000).toISOString().slice(0, 10);
  const windows = (d: string) => {
    const ex = schedule.exceptions.find((e) => e.date === d);
    return ex
      ? ex.closed
        ? []
        : ex.windows
      : schedule.weekly.filter((w) => w.day === new Date(`${d}T00:00:00Z`).getUTCDay());
  };
  const todayException = schedule.exceptions.find((e) => e.date === local);
  if (todayException?.closed) return false;
  const mins = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
  if (
    windows(local).some(
      (w) =>
        w.allDay ||
        (mins(w.end) > mins(w.start)
          ? minute >= mins(w.start) && minute < mins(w.end)
          : minute >= mins(w.start))
    )
  )
    return true;
  // An explicit exception replaces the whole date, including prior-day carryover.
  return (
    !todayException &&
    windows(previous).some((w) => !w.allDay && mins(w.end) < mins(w.start) && minute < mins(w.end))
  );
}
