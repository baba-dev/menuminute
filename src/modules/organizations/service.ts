import { sql, eq, asc, desc, and, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  organizations,
  organizationMembers,
  restaurants,
  brands,
  brandOutlets,
  outletGrants,
  users,
  domainAudit,
  outboxEvents,
  domainProjections,
} from "@/db/schema";
import { withActor, type Actor } from "@/modules/tenancy/service";
import { createRestaurantSchema } from "@/modules/restaurants/service";
import { AppError, ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
const id = z.string().min(1).max(128);
const name = z.string().trim().min(2).max(100);
const modes = z
  .array(z.enum(["dine_in", "pickup"]))
  .min(1)
  .max(2)
  .refine((v) => new Set(v).size === v.length);
const outletFields = createRestaurantSchema
  .omit({ description: true, city: true, menuSchedule: true, fulfillmentModes: true })
  .extend({ fulfillmentModes: modes });
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("organization.rename"), data: z.object({ name }).strict() }),
  z.object({
    action: z.literal("organization.active"),
    data: z.object({ isActive: z.boolean() }).strict(),
  }),
  z.object({ action: z.literal("owner.transfer"), data: z.object({ memberId: id }).strict() }),
  z.object({
    action: z.literal("member.save"),
    data: z
      .object({
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        role: z.enum(["admin", "member"]),
        isActive: z.boolean(),
      })
      .strict(),
  }),
  z.object({ action: z.literal("outlet.create"), data: outletFields.strict() }),
  z.object({
    action: z.literal("outlet.update"),
    data: outletFields.partial().extend({ outletId: id }).strict(),
  }),
  z.object({
    action: z.literal("outlet.roles"),
    data: z
      .object({
        outletId: id,
        memberId: id,
        roles: z
          .array(z.enum(["manager", "service", "kitchen", "menu_editor"]))
          .max(4)
          .refine((v) => new Set(v).size === v.length),
      })
      .strict(),
  }),
  z.object({ action: z.literal("brand.create"), data: z.object({ name }).strict() }),
  z.object({
    action: z.literal("brand.link"),
    data: z.object({ brandId: id, outletId: id, linked: z.boolean() }).strict(),
  }),
]);
export const organizationCommandSchema = z
  .object({ key: z.uuid(), expectedVersion: z.number().int().nonnegative(), command: action })
  .strict();
export type OrganizationCommand = z.input<typeof organizationCommandSchema>;
export function domainError(error: unknown): never {
  const inner = error instanceof Error && error.cause ? error.cause : error;
  const code =
    typeof inner === "object" && inner !== null && "code" in inner ? inner.code : undefined;
  if (code === "42501") throw new ForbiddenError();
  if (code === "40001" || code === "23505")
    throw new ConflictError("Organization changed or request key reused. Refresh and try again.");
  if (code === "23503" || code === "22023" || code === "23514" || code === "23502")
    throw new ValidationError(
      "Invalid domain change. Check the account, scope and settings; currency changes with existing prices require repricing."
    );
  if (code === "P3001")
    throw new AppError("The free account limit is three owned organizations. Contact support for a higher limit.", "PROVISIONING_LIMIT", 409);
  if (code === "P3002")
    throw new AppError("This organization has reached its invitation or member capacity.", "MEMBER_LIMIT", 409);
  if (code === "54000")
    throw new AppError(
      "Photo uploads are temporarily limited. Your existing photos are safe.",
      "MEDIA_LIMIT",
      503
    );
  if (code === "53000")
    throw new AppError("Background processing is behind. Try again later.", "BACKLOG", 503);
  throw error;
}
export async function manageOrganization(actor: Actor, organizationId: string, raw: unknown) {
  const input = organizationCommandSchema.parse(raw);
  id.parse(organizationId);
  try {
    return await withActor(actor, async (tx) => {
      const r = await tx.execute<{ result: Record<string, string | number> }>(
        sql`select app_private.manage_organization(${organizationId},${input.command.action},${JSON.stringify(input.command.data)}::jsonb,${input.key},${input.expectedVersion}) as result`
      );
      return r.rows[0]!.result;
    });
  } catch (e) {
    domainError(e);
  }
}
export async function listOrganizations(actor: Actor) {
  return withActor(actor, (tx) =>
    tx
      .select({
        id: organizations.id,
        name: organizations.name,
        isActive: organizations.isActive,
        version: organizations.version,
        role: organizationMembers.role,
      })
      .from(organizations)
      .innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, actor.userId))
      .orderBy(asc(organizations.name))
  );
}
export async function organizationDetail(actor: Actor, organizationId: string) {
  return withActor(actor, async (tx) => {
    const permission = await tx.execute<{ allowed: boolean }>(
      sql`select app_private.org_admin(${organizationId},false,true) as allowed`
    );
    if (!permission.rows[0]?.allowed) {
      const visible = await tx
        .select()
        .from(restaurants)
        .where(
          and(
            eq(restaurants.organizationId, organizationId),
            sql`app_private.can_outlet(${restaurants.id},'outlet.manage')`
          )
        );
      if (!visible.length) throw new ForbiddenError();
      const organization = (
        await tx.select().from(organizations).where(eq(organizations.id, organizationId))
      )[0]!;
      const directory = await tx.execute<{
        members: { id: string; name: string; email: string; role: string; isActive: boolean }[];
      }>(sql`select app_private.scoped_member_directory(${organizationId}) as members`);
      const grants = await tx
        .select()
        .from(outletGrants)
        .where(
          and(
            eq(outletGrants.organizationId, organizationId),
            inArray(
              outletGrants.outletId,
              visible.map((o) => o.id)
            )
          )
        );
      return {
        organization,
        members: directory.rows[0]!.members,
        outlets: visible,
        brands: [],
        links: [],
        grants,
        audit: [],
        jobs: [],
        projection: null,
      };
    }
    const organization = (
      await tx.select().from(organizations).where(eq(organizations.id, organizationId))
    )[0]!;
    const members = await tx
      .select({
        id: organizationMembers.id,
        name: users.name,
        email: users.email,
        role: organizationMembers.role,
        isActive: organizationMembers.isActive,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, organizationId));
    const outlets = await tx
      .select()
      .from(restaurants)
      .where(eq(restaurants.organizationId, organizationId));
    const brandList = await tx
      .select()
      .from(brands)
      .where(eq(brands.organizationId, organizationId));
    const links = await tx
      .select()
      .from(brandOutlets)
      .where(eq(brandOutlets.organizationId, organizationId));
    const grants = await tx
      .select()
      .from(outletGrants)
      .where(eq(outletGrants.organizationId, organizationId));
    const audit = await tx
      .select()
      .from(domainAudit)
      .where(eq(domainAudit.organizationId, organizationId))
      .orderBy(desc(domainAudit.createdAt))
      .limit(30);
    const jobs = await tx
      .select({
        id: outboxEvents.id,
        status: outboxEvents.status,
        attempts: outboxEvents.attempts,
        lastError: outboxEvents.lastError,
        createdAt: outboxEvents.createdAt,
      })
      .from(outboxEvents)
      .where(eq(outboxEvents.organizationId, organizationId))
      .orderBy(desc(outboxEvents.createdAt))
      .limit(30);
    const projection =
      (
        await tx
          .select()
          .from(domainProjections)
          .where(eq(domainProjections.organizationId, organizationId))
      )[0] ?? null;
    return {
      organization,
      members,
      outlets,
      brands: brandList,
      links,
      grants,
      audit,
      jobs,
      projection,
    };
  });
}
export async function retryEvent(actor: Actor, organizationId: string, eventId: string) {
  z.uuid().parse(eventId);
  try {
    await withActor(actor, (tx) =>
      tx.execute(sql`select app_private.retry_event(${organizationId},${eventId})`)
    );
  } catch (e) {
    domainError(e);
  }
}
