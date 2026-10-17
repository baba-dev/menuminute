import { sql, eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, getPool } from "@/db";
import {
  orders,
  orderItems,
  orderStatusEvents,
  outboxEvents,
  restaurants,
  type SelectedOptionSnapshot,
} from "@/db/schema";
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
  type OrderSubmissionInput,
  type OrderTransitionInput,
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

  const db = getDb();

  // 3. Check Idempotency: Has this submission key already been committed?
  const existing = (
    await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, outletId),
          eq(orders.clientSubmissionKey, input.clientSubmissionKey)
        )
      )
  )[0];

  if (existing) {
    return {
      orderId: existing.id,
      trackingToken: existing.trackingToken!,
      orderNumber: existing.orderNumber,
      status: existing.status,
      totalMinor: existing.totalMinor,
      currency: existing.currency,
      isDuplicate: true,
    };
  }

  // 4. Project live menu categories and dishes for server-side price & availability verification
  const now = new Date(data.now);
  const projectedMenus = data.menus.map((m) =>
    projectMenu(m.document, outlet.timezone, now, m.overrides)
  );

  const allCategories = projectedMenus.flatMap((m) => m.categories);
  const allDishes = allCategories.flatMap((c) => c.items);

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
    const dish = allDishes.find((d) => d.id === requestedItem.dishId);
    if (!dish) {
      throw new ValidationError(`Dish "${requestedItem.dishId}" is not currently on the menu.`);
    }

    if (dish.soldOut || !dish.open) {
      throw new ConflictError(`"${dish.name}" is currently sold out or outside service hours.`);
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

  const orderId = `ord-${nanoid()}`;
  const trackingToken = `trk-${nanoid()}`;

  // Session expiry snapshot (2 hours default or closing instant)
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  // 5. Commit atomically in transaction
  return db.transaction(async (tx) => {
    // Generate safe daily order sequence
    let orderNum = 1;
    try {
      const res = await tx.execute<{ next_order_number: number }>(
        sql`SELECT app_private.next_order_number(${outletId}, CURRENT_DATE) as next_order_number`
      );
      if (res.rows[0]?.next_order_number) {
        orderNum = res.rows[0].next_order_number;
      }
    } catch {
      // Fallback if app_private counter is unavailable in non-migrated environment
      const countRes = await tx
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(eq(orders.restaurantId, outletId));
      orderNum = Number(countRes[0]?.count ?? 0) + 1;
    }

    // Insert Order
    await tx.insert(orders).values({
      id: orderId,
      restaurantId: outletId,
      customerName: input.customerName || null,
      customerPhone: input.customerPhone || null,
      fulfillmentMode: input.fulfillmentMode,
      status: "pending",
      paymentStatus: "unpaid",
      currency: outlet.currency,
      subtotalMinor,
      taxMinor,
      totalMinor,
      subtotalPaise: subtotalMinor,
      taxPaise: taxMinor,
      totalPaise: totalMinor,
      notes: input.notes || null,
      clientSubmissionKey: input.clientSubmissionKey,
      trackingToken,
      expiresAt,
      orderNumber: orderNum,
      version: 1,
    });

    // Insert Order Items
    for (const item of preparedItems) {
      await tx.insert(orderItems).values({
        id: `itm-${nanoid()}`,
        orderId,
        restaurantId: outletId,
        dishId: item.dishId,
        variantId: item.variantId ?? null,
        itemName: item.dishName,
        variantName: item.variantName ?? null,
        selectedOptions: item.selectedOptions,
        unitPriceMinor: item.unitPriceMinor,
        totalMinor: item.totalMinor,
        unitPricePaise: item.unitPriceMinor,
        totalPaise: item.totalMinor,
        quantity: item.quantity,
        notes: item.notes || null,
      });
    }

    // Insert Initial Status Event
    await tx.insert(orderStatusEvents).values({
      id: `evt-${nanoid()}`,
      orderId,
      restaurantId: outletId,
      fromStatus: null,
      toStatus: "pending",
      status: "pending",
      note: "Order submitted by guest",
      actorType: "guest",
      actorId: null,
    });

    // Insert Outbox Event for background processing
    await tx.insert(outboxEvents).values({
      id: `out-${nanoid()}`,
      organizationId: `org-${outletId}`,
      outletId,
      type: "order.created",
      schemaVersion: 1,
      aggregateVersion: 1,
      payload: {
        orderId,
        orderNumber: orderNum,
        totalMinor,
        currency: outlet.currency,
        itemsCount: preparedItems.length,
        fulfillmentMode: input.fulfillmentMode,
      },
      status: "pending",
    });

    return {
      orderId,
      trackingToken,
      orderNumber: orderNum,
      status: "pending" as OrderStatus,
      totalMinor,
      currency: outlet.currency,
      isDuplicate: false,
    };
  });
}

// ─── Guest Order Tracking ─────────────────────────────────────────────────────

export async function getGuestOrderTracking(
  token: string,
  orderId: string,
  trackingToken: string
) {
  const data = await publicProduct(token);
  if (!data) throw new NotFoundError("Menu or restaurant unavailable");

  const db = getDb();
  const orderRow = (
    await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.restaurantId, data.outlet.id),
          eq(orders.trackingToken, trackingToken)
        )
      )
  )[0];

  if (!orderRow) {
    throw new NotFoundError("Order tracking capability not found");
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const events = await db
    .select()
    .from(orderStatusEvents)
    .where(eq(orderStatusEvents.orderId, orderId))
    .orderBy(orderStatusEvents.createdAt);

  return {
    order: {
      id: orderRow.id,
      orderNumber: orderRow.orderNumber,
      status: orderRow.status,
      paymentStatus: orderRow.paymentStatus,
      fulfillmentMode: orderRow.fulfillmentMode,
      currency: orderRow.currency,
      subtotalMinor: orderRow.subtotalMinor,
      taxMinor: orderRow.taxMinor,
      totalMinor: orderRow.totalMinor,
      notes: orderRow.notes,
      rejectionReason: orderRow.rejectionReason,
      createdAt: orderRow.createdAt,
      updatedAt: orderRow.updatedAt,
      point: data.point,
    },
    outlet: {
      name: data.outlet.name,
      currency: data.outlet.currency,
    },
    items: items.map((i) => ({
      id: i.id,
      itemName: i.itemName,
      variantName: i.variantName,
      selectedOptions: i.selectedOptions,
      unitPriceMinor: i.unitPriceMinor,
      totalMinor: i.totalMinor,
      quantity: i.quantity,
      notes: i.notes,
    })),
    events: events.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      createdAt: e.createdAt,
    })),
  };
}

// ─── Merchant Order Management ────────────────────────────────────────────────

export async function listOutletOrders(
  actor: Actor,
  outletId: string,
  statusFilter?: string
) {
  return withOutlet(actor, outletId, "orders.read", async (tx) => {
    let query = tx
      .select()
      .from(orders)
      .where(eq(orders.restaurantId, outletId))
      .orderBy(desc(orders.createdAt))
      .limit(100);

    const rows = await query;

    const filtered = statusFilter
      ? rows.filter((r) => {
          if (statusFilter === "active") {
            return ["pending", "accepted", "preparing", "ready"].includes(r.status);
          }
          if (statusFilter === "completed") {
            return ["served", "collected"].includes(r.status);
          }
          if (statusFilter === "cancelled") {
            return ["rejected", "cancelled", "expired"].includes(r.status);
          }
          return r.status === statusFilter;
        })
      : rows;

    const orderIds = filtered.map((o) => o.id);
    const items =
      orderIds.length > 0
        ? await tx
            .select()
            .from(orderItems)
            .where(sql`${orderItems.orderId} = ANY(${orderIds})`)
        : [];

    return filtered.map((o) => ({
      ...o,
      items: items.filter((i) => i.orderId === o.id),
    }));
  });
}

export async function transitionOutletOrder(
  actor: Actor,
  outletId: string,
  orderId: string,
  raw: unknown
) {
  const input = orderTransitionSchema.parse(raw);

  // Map required permission based on target status
  let requiredPermission: Permission = "orders.accept";
  if (input.targetStatus === "preparing") requiredPermission = "orders.prepare";
  else if (input.targetStatus === "ready" || input.targetStatus === "served" || input.targetStatus === "collected")
    requiredPermission = "orders.complete";
  else if (input.targetStatus === "rejected" || input.targetStatus === "cancelled")
    requiredPermission = "orders.cancel";

  return withOutlet(actor, outletId, requiredPermission, async (tx) => {
    const order = (
      await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.restaurantId, outletId)))
    )[0];

    if (!order) throw new NotFoundError("Order");

    // Check optimistic version concurrency
    if (order.version !== input.expectedVersion) {
      throw new ConflictError(
        "This order was updated by another staff member. Please refresh."
      );
    }

    // State machine validation
    const current = order.status;
    const target = input.targetStatus;

    const validTransitions: Record<string, string[]> = {
      pending: ["accepted", "rejected"],
      accepted: ["preparing", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["served", "collected", "cancelled"],
    };

    const allowedNext = validTransitions[current] || [];
    if (!allowedNext.includes(target)) {
      throw new ValidationError(
        `Invalid status transition from "${current}" to "${target}".`
      );
    }

    const nextVersion = order.version + 1;
    const updateData: Partial<typeof orders.$inferInsert> = {
      status: target,
      version: nextVersion,
      updatedAt: new Date(),
    };

    if (input.paymentStatus) {
      updateData.paymentStatus = input.paymentStatus;
    }

    if (target === "rejected" || target === "cancelled") {
      updateData.rejectionReason = input.reason || null;
    }

    await tx.update(orders).set(updateData).where(eq(orders.id, orderId));

    // Audit status event
    await tx.insert(orderStatusEvents).values({
      id: `evt-${nanoid()}`,
      orderId,
      restaurantId: outletId,
      fromStatus: current,
      toStatus: target,
      status: target,
      note: input.reason || `Status updated to ${target} by staff`,
      actorType: "staff",
      actorId: actor.userId,
    });

    // Outbox event
    await tx.insert(outboxEvents).values({
      id: `out-${nanoid()}`,
      organizationId: `org-${outletId}`,
      outletId,
      type: "order.status_changed",
      schemaVersion: 1,
      aggregateVersion: nextVersion,
      payload: {
        orderId,
        fromStatus: current,
        toStatus: target,
        paymentStatus: input.paymentStatus || order.paymentStatus,
        reason: input.reason || null,
      },
      status: "pending",
    });

    return {
      success: true,
      orderId,
      previousStatus: current,
      currentStatus: target,
      version: nextVersion,
    };
  });
}
