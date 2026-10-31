import { z } from "zod";
import { currencyExponent, displayToMinor } from "@/lib/money";
import { ConflictError, ValidationError } from "@/lib/errors";
import { commandMenu, listMenus, menuDetail } from "@/modules/menu-product/service";
import { menuDocumentSchema, type MenuDocument } from "@/modules/menu-product/contracts";
import type { Actor } from "@/modules/tenancy/service";
import type { ExecutionOutcome } from "./action-requests";

/**
 * Menu changes Ember can prepare for confirmation. Edits only ever touch the DRAFT; going live is a
 * separate, explicitly confirmed publish that shows exactly what changes and is refused if the draft
 * moved after it was prepared. Both ride the existing `menu_command` (permission, revision check,
 * idempotency key, outbox/cache invalidation); nothing here writes tables.
 */
type Scope = { actor: Actor; organizationId: string; outletId: string };
type Detail = Awaited<ReturnType<typeof menuDetail>>;
export type DraftDish = {
  menuId: string;
  menuName: string;
  revision: number;
  currency: string;
  dishId: string;
  dishName: string;
  priceMinor: number;
  description: string;
  hasVariants: boolean;
  localPriceMinor: number | null;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export function formatMoney(minor: number, currency: string) {
  const exp = currencyExponent(currency) ?? 2;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(minor / 10 ** exp);
}

/** Menus this outlet can edit (assigned, not archived, writable), newest first, bounded. */
export async function editableMenus(s: Scope, menuName?: string): Promise<Detail[]> {
  const rows = (await listMenus(s.actor, s.outletId)).filter((m) => !m.archived).slice(0, 12);
  const details = await Promise.all(rows.map((m) => menuDetail(s.actor, m.id)));
  const q = menuName ? norm(menuName) : "";
  return details.filter(
    (d) =>
      d.canWrite && (!q || norm(d.document.name).includes(q) || q.includes(norm(d.document.name)))
  );
}

export async function findDraftDishes(s: Scope, dish: string, menuName?: string) {
  const q = norm(dish);
  const found: DraftDish[] = [];
  for (const m of await editableMenus(s, menuName))
    for (const c of m.document.categories) {
      if (c.archived) continue;
      for (const d of c.items) {
        if (d.archived || !norm(d.name).includes(q)) continue;
        found.push({
          menuId: m.id,
          menuName: m.document.name,
          revision: m.revision,
          currency: m.document.currency,
          dishId: d.id,
          dishName: d.name,
          priceMinor: d.priceMinor,
          description: d.description,
          hasVariants: d.variants.length > 0,
          localPriceMinor:
            m.overrides.find((o) => o.dishId === d.id && o.outletId === s.outletId)?.priceMinor ??
            null,
        });
      }
    }
  // An exact name match wins over partial matches ("Dal" vs "Dal Makhani").
  const exact = found.filter((f) => norm(f.dishName) === q);
  return exact.length ? exact : found;
}

export function priceToMinor(value: number, currency: string) {
  try {
    return displayToMinor(String(value), currency);
  } catch {
    throw new ValidationError("That price isn't valid for this menu's currency.");
  }
}

/**
 * Allergen, dietary and nutrition wording is a safety claim someone must verify, never copy Ember
 * writes. A new description may not introduce such a term that the old one did not already contain.
 */
const CLAIM =
  /\b(gluten|wheat[- ]free|nut|nuts|peanut|peanuts|almond|cashew|dairy|lactose|egg[- ]free|soy|sesame|shellfish|allerg\w*|vegan|vegetarian|non[- ]veg|jain|halal|kosher|organic|sugar[- ]free|keto|low[- ](?:fat|carb|calorie|sodium)|calorie\w*|kcal|protein)\b/gi;
export function introducesSafetyClaim(before: string, after: string) {
  const had = new Set((before.match(CLAIM) ?? []).map((m) => m.toLowerCase()));
  return (after.match(CLAIM) ?? []).some((m) => !had.has(m.toLowerCase()));
}

/* ───────────────────────── publish preview ───────────────────────── */

export type DraftChange = string;
export function diffMenus(draft: MenuDocument, live: MenuDocument | null): DraftChange[] {
  const cur = draft.currency;
  const flat = (doc: MenuDocument) =>
    new Map(
      doc.categories.flatMap((c) =>
        c.items.map((d) => [d.id, { d, hidden: c.archived || d.archived }] as const)
      )
    );
  const now = flat(draft);
  const before = live
    ? flat(live)
    : new Map<string, ReturnType<typeof flat> extends Map<string, infer V> ? V : never>();
  const out: string[] = [];
  for (const [id, { d, hidden }] of now) {
    const old = before.get(id);
    if (!old) {
      if (!hidden) out.push(`New: ${d.name} (${formatMoney(d.priceMinor, cur)})`);
      continue;
    }
    if (old.hidden !== hidden)
      out.push(`${d.name}: ${hidden ? "removed from the menu" : "added back"}`);
    if (old.d.priceMinor !== d.priceMinor)
      out.push(
        `${d.name}: price ${formatMoney(old.d.priceMinor, cur)} → ${formatMoney(d.priceMinor, cur)}`
      );
    if (old.d.name !== d.name) out.push(`${old.d.name}: renamed to ${d.name}`);
    if (old.d.description !== d.description) out.push(`${d.name}: description updated`);
    if (old.d.soldOut !== d.soldOut)
      out.push(`${d.name}: marked ${d.soldOut ? "sold out" : "available"}`);
  }
  for (const [id, { d, hidden }] of before)
    if (!now.has(id) && !hidden) out.push(`Removed: ${d.name}`);
  if (live && draft.name !== live.name) out.push(`Menu renamed to “${draft.name}”`);
  return out;
}
export function describeChanges(changes: DraftChange[]) {
  const shown = changes.slice(0, 5);
  const more = changes.length - shown.length;
  return shown.join("\n") + (more > 0 ? `\n…and ${more} more` : "");
}

/* ───────────────────────── executors ───────────────────────── */

export const menuPriceParams = z
  .object({
    menuId: z.string().min(1).max(128),
    dishId: z.string().min(1).max(128),
    beforeMinor: z.number().int().min(0),
    priceMinor: z.number().int().min(0).max(2147483647),
    expectedRevision: z.number().int().min(0),
  })
  .strict();
export const menuDescriptionParams = z
  .object({
    menuId: z.string().min(1).max(128),
    dishId: z.string().min(1).max(128),
    before: z.string().max(1000),
    description: z.string().trim().min(1).max(500),
    expectedRevision: z.number().int().min(0),
  })
  .strict();
export const menuPublishParams = z
  .object({ menuId: z.string().min(1).max(128), expectedRevision: z.number().int().min(0) })
  .strict();

const STALE =
  "That changed before you confirmed, so nothing was changed. Ask me again for the latest.";
function locate(detail: Detail, dishId: string) {
  for (const c of detail.document.categories)
    for (const d of c.items) if (d.id === dishId && !d.archived && !c.archived) return d;
  return null;
}
async function saveDraft(
  s: Scope,
  detail: Detail,
  mutate: (doc: MenuDocument) => void,
  proposalId: string
) {
  const doc = structuredClone(detail.document) as MenuDocument;
  mutate(doc);
  await commandMenu(s.actor, s.outletId, detail.id, {
    action: "save",
    key: proposalId,
    expectedRevision: detail.revision,
    data: { document: menuDocumentSchema.parse(doc) },
  });
}

export async function executeMenuPrice(
  s: Scope,
  p: z.infer<typeof menuPriceParams>,
  proposalId: string
): Promise<ExecutionOutcome> {
  const detail = await menuDetail(s.actor, p.menuId);
  const dish = locate(detail, p.dishId);
  if (
    !detail.canWrite ||
    detail.archived ||
    !dish ||
    detail.revision !== p.expectedRevision ||
    dish.priceMinor !== p.beforeMinor ||
    dish.variants.length > 0
  )
    return { status: "stale", message: STALE };
  try {
    await saveDraft(
      s,
      detail,
      (doc) => {
        for (const c of doc.categories)
          for (const d of c.items) if (d.id === p.dishId) d.priceMinor = p.priceMinor;
      },
      proposalId
    );
  } catch (error) {
    if (error instanceof ConflictError) return { status: "stale", message: STALE };
    throw error;
  }
  return {
    status: "confirmed",
    message: `Price saved to the draft. Guests see it once the menu is published.`,
  };
}
export async function executeMenuDescription(
  s: Scope,
  p: z.infer<typeof menuDescriptionParams>,
  proposalId: string
): Promise<ExecutionOutcome> {
  const detail = await menuDetail(s.actor, p.menuId);
  const dish = locate(detail, p.dishId);
  if (
    !detail.canWrite ||
    detail.archived ||
    !dish ||
    detail.revision !== p.expectedRevision ||
    dish.description !== p.before
  )
    return { status: "stale", message: STALE };
  if (introducesSafetyClaim(p.before, p.description))
    return {
      status: "failed",
      message: "Allergen and dietary details must be edited in Menu Studio.",
    };
  try {
    await saveDraft(
      s,
      detail,
      (doc) => {
        for (const c of doc.categories)
          for (const d of c.items) if (d.id === p.dishId) d.description = p.description;
      },
      proposalId
    );
  } catch (error) {
    if (error instanceof ConflictError) return { status: "stale", message: STALE };
    throw error;
  }
  return {
    status: "confirmed",
    message: "Description saved to the draft. Guests see it once the menu is published.",
  };
}
export async function executeMenuPublish(
  s: Scope,
  p: z.infer<typeof menuPublishParams>,
  proposalId: string
): Promise<ExecutionOutcome> {
  const detail = await menuDetail(s.actor, p.menuId);
  if (!detail.canWrite || detail.archived || detail.revision !== p.expectedRevision)
    return { status: "stale", message: STALE };
  try {
    await commandMenu(s.actor, s.outletId, detail.id, {
      action: "publish",
      key: proposalId,
      expectedRevision: p.expectedRevision,
      data: {},
    });
  } catch (error) {
    if (error instanceof ConflictError) return { status: "stale", message: STALE };
    throw error;
  }
  return { status: "confirmed", message: `“${detail.document.name}” is now live for guests.` };
}
