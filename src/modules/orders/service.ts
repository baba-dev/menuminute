import { sql, eq, and, desc, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getPool } from "@/db";
import { orders, orderItems, restaurants, type SelectedOptionSnapshot } from "@/db/schema";
import { publicProduct } from "@/modules/menu-product/service";
import { projectMenu } from "@/modules/menu-product/projector";
import { availableNow } from "@/modules/menu-product/contracts";
import { withOutlet, type Actor, type Permission } from "@/modules/tenancy/service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  orderSubmissionSchema,
  orderTransitionSchema,
  orderPaymentSchema,
  type OrderStatus,
} from "./contracts";

function mapOrderDatabaseError(error: unknown): never {
  if (
    error instanceof ConflictError ||
    error instanceof ForbiddenError ||
    error instanceof ValidationError ||
    error instanceof NotFoundError
  )
    throw error;
  const cause = error instanceof Error && error.cause ? error.cause : error;
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  const message = cause instanceof Error ? cause.message : "";
  if (code === "40001" || message.includes("Submission key reused")) {
    throw new ConflictError("Order data changed. Refresh and retry with the correct cart.");
  }
  if (code === "42501") throw new ForbiddenError("Order operation is not permitted.");
  if (code === "22023")
    throw new ValidationError(
      message.includes("Invalid") || message.includes("unavailable")
        ? message
        : "Invalid order operation."
    );
  throw error;
}

export function validatePickupInstant(input: {
  value: string;
  now: Date;
  timezone: string;
  leadMinutes: number;
  slotMinutes: number;
  advanceDays: number;
}) {
  const requested = new Date(input.value);
  if (!Number.isFinite(requested.getTime()))
    throw new ValidationError("Choose a valid pickup time.");
  const earliest = input.now.getTime() + input.leadMinutes * 60000;
  const latest = input.now.getTime() + input.advanceDays * 86400000;
  if (requested.getTime() < earliest)
    throw new ConflictError(
      `Pickup requires at least ${input.leadMinutes} minutes of preparation.`
    );
  if (requested.getTime() > latest)
    throw new ValidationError(`Pickup can be scheduled up to ${input.advanceDays} days ahead.`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: input.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(requested);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    (hour * 60 + minute) % input.slotMinutes
  )
    throw new ValidationError(`Choose a pickup time on a ${input.slotMinutes}-minute interval.`);
  return requested;
}

// ─── Guest Order Submission ───────────────────────────────────────────────────

export async function submitGuestOrder(token: string, raw: unknown) {
  const input = orderSubmissionSchema.parse(raw);
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  // A committed submission must be recoverable even if the menu changes after an HTTP response is lost.
  try {
    const existing = await getPool().query<{
      data: {
        orderId: string;
        trackingToken: string;
        orderNumber: number;
        status: OrderStatus;
        totalMinor: number;
        currency: string;
        isDuplicate: boolean;
      } | null;
    }>("select app_private.lookup_guest_submission($1,$2,$3) as data", [
      token,
      input.clientSubmissionKey,
      requestHash,
    ]);
    if (existing.rows[0]?.data) return existing.rows[0].data;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Submission key reused"))
      throw new ConflictError("Submission key reused with a different cart.");
    mapOrderDatabaseError(error);
  }

  // 1. Resolve menu product and active outlet configuration
  const data = await publicProduct(token);
  if (!data) throw new NotFoundError("Menu or service point unavailable");

  const outlet = data.outlet;

  // 2. Validate requested fulfillment mode against outlet settings
  if (
    outlet.fulfillmentModes &&
    outlet.fulfillmentModes.length > 0 &&
    !outlet.fulfillmentModes.includes(input.fulfillmentMode)
  ) {
    throw new ValidationError(
      `Fulfillment mode "${input.fulfillmentMode}" is not accepted by this outlet.`
    );
  }

  const requestedFulfillmentAt = input.requestedFulfillmentAt
    ? validatePickupInstant({
        value: input.requestedFulfillmentAt,
        now: new Date(data.now),
        timezone: outlet.timezone,
        leadMinutes: outlet.pickupLeadMinutes ?? 15,
        slotMinutes: outlet.pickupSlotMinutes ?? 15,
        advanceDays: outlet.pickupAdvanceDays ?? 7,
      })
    : null;

  // Revalidate at the trusted server boundary before final transactional commit.
  // 4. Project live menu categories and dishes for server-side price & availability verification
  const now = new Date(data.now);
  const serviceInstant = requestedFulfillmentAt ?? now;
  const projectedMenus = data.menus.map((m) =>
    projectMenu(m.document, outlet.timezone, serviceInstant, m.overrides)
  );

  const allCategories = projectedMenus.flatMap((m) => m.categories);
  const allDishes = allCategories.flatMap((c) => c.items);
  const dishLookup = new Map(allDishes.map((dish) => [dish.id, dish]));

  type PreparedItem = {
    dishId: string;
    dishName: string;
    variantId?: string | null;
    variantName?: string | null;
    selectedOptions: SelectedOptionSnapshot[];
    unitPriceMinor: number;
    quantity: number;
    totalMinor: number;
    notes?: string;
  };

  const preparedItems: PreparedItem[] = [];
  let subtotalMinor = 0;

  for (const requestedItem of input.items) {
    const dish = dishLookup.get(requestedItem.dishId);
    if (!dish) {
      throw new ValidationError(`Dish "${requestedItem.dishId}" is not currently on the menu.`);
    }

    if (dish.soldOut || !dish.open) {
      throw new ConflictError(`"${dish.name}" is currently sold out or outside service hours.`);
    }

    const validPairs = new Set(
      dish.addOnGroups.flatMap((group) => group.options.map((option) => group.id + ":" + option.id))
    );
    if (
      requestedItem.selectedAddOns.some(
        (choice) => !validPairs.has(choice.groupId + ":" + choice.optionId)
      )
    ) {
      throw new ValidationError("An unknown add-on was selected.");
    }

    let unitBasePrice = dish.priceMinor;
    let selectedVariantName: string | null = null;

    // Revalidate variant
    if (requestedItem.variantId) {
      const variant = dish.variants.find((v) => v.id === requestedItem.variantId);
      if (!variant) {
        throw new ValidationError(`Selected option for "${dish.name}" does not exist.`);
      }
      if (!variant.isAvailable) {
        throw new ConflictError(`Option "${variant.name}" for "${dish.name}" is sold out.`);
      }
      unitBasePrice = variant.priceMinor;
      selectedVariantName = variant.name;
    } else if (dish.variants.length > 0) {
      throw new ValidationError(`Please select an option for "${dish.name}".`);
    }

    // Revalidate add-ons and selection bounds
    const selectedOptionsList: SelectedOptionSnapshot[] = [];
    let addOnsPriceMinor = 0;

    for (const group of dish.addOnGroups) {
      const chosenForGroup = requestedItem.selectedAddOns.filter((a) => a.groupId === group.id);

      if (chosenForGroup.length < group.min) {
        throw new ValidationError(
          `Please select at least ${group.min} option(s) for "${group.name}" on "${dish.name}".`
        );
      }
      if (chosenForGroup.length > group.max) {
        throw new ValidationError(
          `You may select at most ${group.max} option(s) for "${group.name}" on "${dish.name}".`
        );
      }

      for (const choice of chosenForGroup) {
        const option = group.options.find((o) => o.id === choice.optionId);
        if (!option) {
          throw new ValidationError(
            `Option "${choice.optionId}" is not valid for "${group.name}".`
          );
        }
        if (!option.isAvailable) {
          throw new ConflictError(`Option "${option.name}" for "${dish.name}" is sold out.`);
        }
        addOnsPriceMinor += option.priceMinor;
        selectedOptionsList.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceMinor: option.priceMinor,
        });
      }
    }

    const itemUnitPriceMinor = unitBasePrice + addOnsPriceMinor;
    const itemTotalMinor = itemUnitPriceMinor * requestedItem.quantity;

    subtotalMinor += itemTotalMinor;

    preparedItems.push({
      dishId: dish.id,
      dishName: dish.name,
      variantId: requestedItem.variantId ?? null,
      variantName: selectedVariantName,
      selectedOptions: selectedOptionsList,
      unitPriceMinor: itemUnitPriceMinor,
      quantity: requestedItem.quantity,
      totalMinor: itemTotalMinor,
      notes: requestedItem.itemNotes || undefined,
    });
  }

  // Tax inclusive by default
  const taxMinor = 0;
  const totalMinor = subtotalMinor + taxMinor;

  if (!Number.isSafeInteger(totalMinor) || totalMinor > 2147483647) {
    throw new ValidationError("Order total exceeds supported amount.");
  }
  if (input.quotedTotalMinor !== totalMinor) {
    throw new ConflictError("Your cart price has changed. Please review the updated menu.");
  }
  if (!outlet.versioned) {
    throw new ForbiddenError("Online ordering requires a published versioned menu.");
  }

  // Snapshot the earliest selected item's closing boundary, capped at a two-hour default.
  const selectedDishIds = new Set(input.items.map((item) => item.dishId));
  const schedules = data.menus.flatMap((menu) =>
    menu.document.categories.flatMap((category) =>
      category.items
        .filter((item) => selectedDishIds.has(item.id))
        .map((item) => ({
          menu: menu.document.schedule,
          dish: item.schedule,
        }))
    )
  );
  let expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  if (!requestedFulfillmentAt && schedules.some((s) => s.menu || s.dish)) {
    for (let minute = 1; minute <= 120; minute++) {
      const instant = new Date(now.getTime() + minute * 60000);
      if (
        schedules.some(
          (s) =>
            !availableNow(s.menu, outlet.timezone, instant) ||
            !availableNow(s.dish, outlet.timezone, instant)
        )
      ) {
        expiresAt = instant;
        break;
      }
    }
  }
  const payload = {
    ...input,
    requestHash,
    catalogFingerprint: data.catalogFingerprint,
    expiresAt: expiresAt.toISOString(),
    currency: outlet.currency,
    requestedFulfillmentAt: requestedFulfillmentAt?.toISOString() ?? null,
    subtotalMinor,
    taxMinor,
    totalMinor,
    items: preparedItems.map((item) => ({
      dishId: item.dishId,
      dishName: item.dishName,
      variantId: item.variantId ?? null,
      variantName: item.variantName ?? null,
      selectedOptions: item.selectedOptions,
      unitPriceMinor: item.unitPriceMinor,
      totalMinor: item.totalMinor,
      quantity: item.quantity,
      notes: item.notes ?? null,
    })),
  };
  try {
    const result = await getPool().query<{
      data: {
        orderId: string;
        trackingToken: string;
        orderNumber: number;
        status: OrderStatus;
        totalMinor: number;
        currency: string;
        isDuplicate: boolean;
      };
    }>("select app_private.submit_guest_order($1,$2::jsonb) as data", [
      token,
      JSON.stringify(payload),
    ]);
    return result.rows[0]!.data;
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("menu changed") ||
        error.message.includes("Submission key reused")
      ) {
        throw new ConflictError(error.message);
      }
      if (error.message.includes("not enabled for this outlet")) {
        throw new ForbiddenError("Online ordering is not enabled for this outlet.");
      }
    }
    mapOrderDatabaseError(error);
  }
}

// ─── Guest Order Tracking ─────────────────────────────────────────────────────

export async function getGuestOrderTracking(token: string, orderId: string, trackingToken: string) {
  const result = await getPool().query<{ data: unknown | null }>(
    "select app_private.track_guest_order($1,$2,$3) as data",
    [token, orderId, trackingToken]
  );
  const data = result.rows[0]?.data;
  if (!data) throw new NotFoundError("Order tracking capability not found");
  return data;
}

// ─── Merchant Order Management ────────────────────────────────────────────────

export async function listOutletOrders(
  actor: Actor,
  outletId: string,
  statusFilter?: string,
  organizationId?: string
) {
  return withOutlet(actor, outletId, "orders.read", async (tx) => {
    if (organizationId) {
      const [outlet] = await tx
        .select({ organizationId: restaurants.organizationId })
        .from(restaurants)
        .where(eq(restaurants.id, outletId));
      if (!outlet || outlet.organizationId !== organizationId) throw new NotFoundError("Outlet");
    }
    const filters: Record<string, (typeof orders.$inferSelect)["status"][]> = {
      active: ["pending", "accepted", "preparing", "ready"],
      completed: ["served", "collected"],
      cancelled: ["rejected", "cancelled", "expired"],
    };
    const statuses = statusFilter
      ? (filters[statusFilter] ?? [statusFilter as (typeof orders.$inferSelect)["status"]])
      : null;
    const predicate = statuses
      ? and(eq(orders.restaurantId, outletId), inArray(orders.status, statuses))
      : eq(orders.restaurantId, outletId);
    const canPay = await tx.execute<{ allowed: boolean }>(
      sql`select app_private.can_outlet(${outletId},\'billing.manage\') as allowed`
    );
    const rows = await tx
      .select()
      .from(orders)
      .where(predicate)
      .orderBy(desc(orders.createdAt))
      .limit(100);
    const orderIds = rows.map((order) => order.id);
    const items = orderIds.length
      ? await tx.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
      : [];
    const managed = await tx.execute<{ data: string[] }>(
      sql`select app_private.kitchen_managed_orders(${outletId}) as data`
    );
    const kitchenManaged = new Set(managed.rows[0]?.data ?? []);
    const byOrder = new Map<string, typeof items>();
    for (const item of items) {
      const group = byOrder.get(item.orderId) ?? [];
      group.push(item);
      byOrder.set(item.orderId, group);
    }
    return rows.map((order) => ({
      id: order.id,
      canManagePayment: canPay.rows[0]?.allowed ?? false,
      kitchenManaged: kitchenManaged.has(order.id),
      restaurantId: order.restaurantId,
      tableId: order.tableId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      fulfillmentMode: order.fulfillmentMode,
      requestedFulfillmentAt: order.requestedFulfillmentAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      taxMinor: order.taxMinor,
      totalMinor: order.totalMinor,
      notes: order.notes,
      rejectionReason: order.rejectionReason,
      orderNumber: order.orderNumber,
      version: order.version,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      expiresAt: order.expiresAt,
      items: byOrder.get(order.id) ?? [],
    }));
  });
}

export async function transitionOutletOrder(
  actor: Actor,
  outletId: string,
  orderId: string,
  raw: unknown,
  organizationId?: string
) {
  const input = orderTransitionSchema.parse(raw);
  if (input.paymentStatus) {
    throw new ValidationError("Payment updates require a separate authorized finance workflow.");
  }
  let requiredPermission: Permission = "orders.accept";
  if (input.targetStatus === "preparing") requiredPermission = "orders.prepare";
  else if (["ready", "served", "collected"].includes(input.targetStatus))
    requiredPermission = "orders.complete";
  else if (["rejected", "cancelled"].includes(input.targetStatus))
    requiredPermission = "orders.cancel";

  return withOutlet(actor, outletId, requiredPermission, async (tx) => {
    if (organizationId) {
      const [outlet] = await tx
        .select({ organizationId: restaurants.organizationId })
        .from(restaurants)
        .where(eq(restaurants.id, outletId));
      if (!outlet || outlet.organizationId !== organizationId) throw new NotFoundError("Outlet");
    }
    const result = await tx.execute<{
      data: {
        success?: boolean;
        expired?: boolean;
        orderId?: string;
        previousStatus?: string;
        currentStatus?: string;
        version?: number;
      };
    }>(sql`select app_private.transition_order(
      ${outletId},${orderId},${input.targetStatus},${input.expectedVersion},${input.reason ?? ""}
    ) as data`);
    return result.rows[0]!.data;
  }).catch(mapOrderDatabaseError);
}

export async function recordOutletOrderPayment(
  actor: Actor,
  outletId: string,
  orderId: string,
  organizationId: string,
  raw: unknown
) {
  const input = orderPaymentSchema.parse(raw);
  return withOutlet(actor, outletId, "billing.manage", async (tx) => {
    const [outlet] = await tx
      .select({ organizationId: restaurants.organizationId })
      .from(restaurants)
      .where(eq(restaurants.id, outletId));
    if (!outlet || outlet.organizationId !== organizationId) throw new NotFoundError("Outlet");
    const result = await tx.execute<{
      data: {
        success: boolean;
        orderId: string;
        paymentStatus: string;
        version: number;
      };
    }>(sql`select app_private.record_order_payment(
      ${outletId},${orderId},${input.expectedVersion},${input.paymentStatus},${input.paymentMethod}
    ) as data`);
    return result.rows[0]!.data;
  }).catch(mapOrderDatabaseError);
}
