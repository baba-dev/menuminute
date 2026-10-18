import { sql, eq, and, desc, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getPool } from "@/db";
import { orders, orderItems, restaurants, type SelectedOptionSnapshot } from "@/db/schema";
import { publicProduct } from "@/modules/menu-product/service";
import { projectMenu } from "@/modules/menu-product/projector";
import { withOutlet, type Actor, type Permission } from "@/modules/tenancy/service";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  orderSubmissionSchema,
  orderTransitionSchema,
  type OrderStatus,
} from "./contracts";

// ─── Guest Order Submission ───────────────────────────────────────────────────

export async function submitGuestOrder(token: string, raw: unknown) {
  const input = orderSubmissionSchema.parse(raw);

  // 1. Resolve menu product and active outlet configuration
  const data = await publicProduct(token);
  if (!data) throw new NotFoundError("Menu or service point unavailable");

  const outlet = data.outlet;
  const outletId = outlet.id;

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

  // 4. Project live menu categories and dishes for server-side price & availability verification
  const now = new Date(data.now);
  const projectedMenus = data.menus.map((m) =>
    projectMenu(m.document, outlet.timezone, now, m.overrides)
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
      dish.addOnGroups.flatMap((group) =>
        group.options.map((option) => group.id + ":" + option.id)
      )
    );
    if (requestedItem.selectedAddOns.some((choice) => !validPairs.has(choice.groupId + ":" + choice.optionId))) {
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
      const chosenForGroup = requestedItem.selectedAddOns.filter(
        (a) => a.groupId === group.id
      );

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
          throw new ConflictError(
            `Option "${option.name}" for "${dish.name}" is sold out.`
          );
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

  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const payload = {
    ...input,
    requestHash,
    catalogFingerprint: data.catalogFingerprint,
    currency: outlet.currency,
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
    const result = await getPool().query<{ data: {
      orderId: string;
      trackingToken: string;
      orderNumber: number;
      status: OrderStatus;
      totalMinor: number;
      currency: string;
      isDuplicate: boolean;
    } }>("select app_private.submit_guest_order($1,$2::jsonb) as data", [
      token,
      JSON.stringify(payload),
    ]);
    return result.rows[0]!.data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("menu changed") || error.message.includes("Submission key reused")) {
        throw new ConflictError(error.message);
      }
      if (error.message.includes("not enabled for this outlet")) {
        throw new ForbiddenError("Online ordering is not enabled for this outlet.");
      }
    }
    throw error;
  }
}

// ─── Guest Order Tracking ─────────────────────────────────────────────────────

export async function getGuestOrderTracking(
  token: string,
  orderId: string,
  trackingToken: string
) {
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
      const [outlet] = await tx.select({ organizationId: restaurants.organizationId })
        .from(restaurants).where(eq(restaurants.id, outletId));
      if (!outlet || outlet.organizationId !== organizationId) throw new NotFoundError("Outlet");
    }
    const filters: Record<string, (typeof orders.$inferSelect)["status"][]> = {
      active: ["pending", "accepted", "preparing", "ready"],
      completed: ["served", "collected"],
      cancelled: ["rejected", "cancelled", "expired"],
    };
    const statuses = statusFilter ? (filters[statusFilter] ?? [statusFilter as (typeof orders.$inferSelect)["status"]]) : null;
    const predicate = statuses
      ? and(eq(orders.restaurantId, outletId), inArray(orders.status, statuses))
      : eq(orders.restaurantId, outletId);
    const rows = await tx.select().from(orders)
      .where(predicate).orderBy(desc(orders.createdAt)).limit(100);
    const orderIds = rows.map((order) => order.id);
    const items = orderIds.length
      ? await tx.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
      : [];
    const byOrder = new Map<string, typeof items>();
    for (const item of items) {
      const group = byOrder.get(item.orderId) ?? [];
      group.push(item);
      byOrder.set(item.orderId, group);
    }
    return rows.map((order) => ({
      id: order.id,
      restaurantId: order.restaurantId,
      tableId: order.tableId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      fulfillmentMode: order.fulfillmentMode,
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
      const [outlet] = await tx.select({ organizationId: restaurants.organizationId })
        .from(restaurants).where(eq(restaurants.id, outletId));
      if (!outlet || outlet.organizationId !== organizationId) throw new NotFoundError("Outlet");
    }
    const result = await tx.execute<{ data: {
      success?: boolean;
      expired?: boolean;
      orderId?: string;
      previousStatus?: string;
      currentStatus?: string;
      version?: number;
    } }>(sql`select app_private.transition_order(
      ${outletId},${orderId},${input.targetStatus},${input.expectedVersion},${input.reason ?? ""}
    ) as data`);
    return result.rows[0]!.data;
  });
}
