/**
 * Pure logic for the trust section (home-v2 section 5). Each rule mirrors something the product does
 * and cites where; these are illustrative models for a marketing page, not imports of product code,
 * and they claim no certification, uptime or compliance.
 *
 * - Access: src/db/migrations/0001_tenant_security.sql (`app_private.can_outlet`) and
 *   src/modules/tenancy/service.ts (`withOutlet` asks the database on every private write).
 * - Orders: src/modules/orders/service.ts (`submitGuestOrder`: key + request hash, then server-side
 *   total versus the quoted total).
 */

export type PermissionId =
  | "menu.read"
  | "menu.write"
  | "outlet.manage"
  | "orders.read"
  | "orders.accept"
  | "orders.prepare"
  | "orders.complete"
  | "orders.cancel"
  | "billing.manage";

export type OutletId = "outlet-a" | "outlet-b";
export type OutletRole = "manager" | "service" | "kitchen" | "menu_editor";
export type OrgRole = "owner" | "admin" | "member";
export type Membership = "active" | "removed" | "none";

export type Person = {
  id: string;
  name: string;
  title: string;
  membership: Membership;
  orgRole: OrgRole | null;
  grants: Partial<Record<OutletId, OutletRole[]>>;
};

export const OUTLETS: readonly { id: OutletId; name: string }[] = [
  { id: "outlet-a", name: "Spice Route · Outlet A" },
  { id: "outlet-b", name: "Spice Route · Outlet B" },
];

export const PERMISSIONS: readonly { id: PermissionId; label: string }[] = [
  { id: "orders.read", label: "See orders" },
  { id: "orders.accept", label: "Accept an order" },
  { id: "orders.prepare", label: "Mark an order preparing" },
  { id: "orders.complete", label: "Complete an order" },
  { id: "orders.cancel", label: "Cancel an order" },
  { id: "menu.read", label: "See the menu" },
  { id: "menu.write", label: "Edit the menu" },
  { id: "outlet.manage", label: "Change outlet settings" },
  { id: "billing.manage", label: "Manage billing" },
];

/** Example people. Roles are the product's (owner, manager, service, kitchen, menu editor). */
export const PEOPLE: readonly Person[] = [
  { id: "asha", name: "Asha", title: "Owner", membership: "active", orgRole: "owner", grants: {} },
  {
    id: "ben",
    name: "Ben",
    title: "Manager at Outlet A",
    membership: "active",
    orgRole: "member",
    grants: { "outlet-a": ["manager"] },
  },
  {
    id: "chen",
    name: "Chen",
    title: "Service at Outlet A",
    membership: "active",
    orgRole: "member",
    grants: { "outlet-a": ["service"] },
  },
  {
    id: "dev",
    name: "Dev",
    title: "Kitchen at Outlet A",
    membership: "active",
    orgRole: "member",
    grants: { "outlet-a": ["kitchen"] },
  },
  {
    id: "eli",
    name: "Eli",
    title: "Menu editor at Outlet A",
    membership: "active",
    orgRole: "member",
    grants: { "outlet-a": ["menu_editor"] },
  },
  {
    id: "fran",
    name: "Fran",
    title: "Former staff (access removed)",
    membership: "removed",
    orgRole: "member",
    grants: { "outlet-a": ["manager"] },
  },
  {
    id: "gus",
    name: "Gus",
    title: "Signed in, other restaurant",
    membership: "none",
    orgRole: null,
    grants: {},
  },
];

/** Which outlet roles hold each permission (non-owner, non-admin members). Mirrors can_outlet. */
const ROLES_FOR: Record<Exclude<PermissionId, "billing.manage">, readonly OutletRole[] | "any"> = {
  "menu.read": "any",
  "menu.write": ["manager", "menu_editor"],
  "outlet.manage": ["manager"],
  "orders.read": ["manager", "service", "kitchen"],
  "orders.accept": ["manager", "service"],
  "orders.complete": ["manager", "service"],
  "orders.prepare": ["manager", "kitchen"],
  "orders.cancel": ["manager"],
};

/** The product's rule: active member; billing is owner only; owner/admin elsewhere; else grants. */
export function can(person: Person, outlet: OutletId, permission: PermissionId): boolean {
  if (person.membership !== "active") return false;
  if (permission === "billing.manage") return person.orgRole === "owner";
  if (person.orgRole === "owner" || person.orgRole === "admin") return true;
  const roles = person.grants[outlet] ?? [];
  const needed = ROLES_FOR[permission];
  return needed === "any" ? roles.length > 0 : roles.some((role) => needed.includes(role));
}

export type StepResult = "pass" | "fail" | "skipped";
export type AccessCheck = {
  steps: { id: "signed-in" | "member" | "granted"; label: string; result: StepResult }[];
  allowed: boolean;
  reason: string;
};

export function checkAccess(
  person: Person,
  outlet: OutletId,
  permission: PermissionId
): AccessCheck {
  const label =
    PERMISSIONS.find((item) => item.id === permission)?.label.toLowerCase() ?? permission;
  const outletName = OUTLETS.find((item) => item.id === outlet)?.name ?? outlet;
  const member = person.membership === "active";
  const allowed = can(person, outlet, permission);
  const granted: StepResult = !member ? "skipped" : allowed ? "pass" : "fail";
  const reason = allowed
    ? `${person.name} may ${label} at ${outletName}.`
    : !member
      ? person.membership === "removed"
        ? `${person.name}'s access was removed, so the request is refused.`
        : `${person.name} is not a member of this restaurant, so the request is refused.`
      : permission === "billing.manage"
        ? "Billing is for the owner only."
        : (person.grants[outlet]?.length ?? 0) === 0
          ? `${person.name} has no access at ${outletName}.`
          : `${person.name}'s role here does not include permission to ${label}.`;
  return {
    steps: [
      { id: "signed-in", label: "Signed in", result: "pass" },
      { id: "member", label: "Active member of this restaurant", result: member ? "pass" : "fail" },
      { id: "granted", label: "Allowed this action at this outlet", result: granted },
    ],
    allowed,
    reason,
  };
}

// ---- Checkout: server prices and one key per order ---------------------------------------------

export const SAMPLE_UNIT_MINOR = 39900; // Butter Chicken, the demo outlet's unit price
export const FIRST_ORDER_NUMBER = 1042;

export type Cart = { quantity: number; quotedTotalMinor: number };
export type Submissions = Record<string, { hash: string; orderNo: number }>;
export type SubmitState = { subs: Submissions; nextOrderNo: number };
export type Outcome = {
  kind: "created" | "duplicate" | "key-conflict" | "price-conflict";
  status: 200 | 201 | 409;
  message: string;
  orderNo?: number;
};

export const initialSubmitState = (): SubmitState => ({
  subs: {},
  nextOrderNo: FIRST_ORDER_NUMBER,
});

/** Stands in for the product's SHA-256 over the whole request. */
export const hashCart = (cart: Cart) => `${cart.quantity}:${cart.quotedTotalMinor}`;
export const serverTotal = (quantity: number) => quantity * SAMPLE_UNIT_MINOR;

/** Mirrors submitGuestOrder: look the key up first, then compare the quoted total to the server's. */
export function submitOrder(
  state: SubmitState,
  key: string,
  cart: Cart
): { state: SubmitState; outcome: Outcome } {
  const hash = hashCart(cart);
  const existing = state.subs[key];
  if (existing) {
    return existing.hash === hash
      ? {
          state,
          outcome: {
            kind: "duplicate",
            status: 200,
            orderNo: existing.orderNo,
            message: `Same order returned (#${existing.orderNo}). No second order was created.`,
          },
        }
      : {
          state,
          outcome: {
            kind: "key-conflict",
            status: 409,
            message: "Submission key reused with a different cart.",
          },
        };
  }
  if (cart.quotedTotalMinor !== serverTotal(cart.quantity)) {
    return {
      state,
      outcome: {
        kind: "price-conflict",
        status: 409,
        message: "Your cart price has changed. Please review the updated menu.",
      },
    };
  }
  const orderNo = state.nextOrderNo;
  return {
    state: {
      subs: { ...state.subs, [key]: { hash, orderNo } },
      nextOrderNo: orderNo + 1,
    },
    outcome: { kind: "created", status: 201, orderNo, message: `Order #${orderNo} created.` },
  };
}

export const ordersCreated = (state: SubmitState) => Object.keys(state.subs).length;

// ---- History -----------------------------------------------------------------------------------

export type HistoryEvent = {
  id: string;
  from: string | null;
  to: string;
  actor: "guest" | "staff" | "system";
};

/** The Table 11 order's status history (the actor types the product records). */
export const HISTORY: readonly HistoryEvent[] = [
  { id: "e1", from: null, to: "Pending", actor: "guest" },
  { id: "e2", from: "Pending", to: "Accepted", actor: "staff" },
  { id: "e3", from: "Accepted", to: "Preparing", actor: "staff" },
  { id: "e4", from: "Preparing", to: "Ready", actor: "staff" },
  { id: "e5", from: "Ready", to: "Served", actor: "staff" },
];

/** An order with recorded history is refused deletion (order_status_events references it with restrict). */
export function tryDeleteOrder(events: readonly HistoryEvent[]): {
  deleted: boolean;
  message: string;
} {
  return events.length > 0
    ? {
        deleted: false,
        message: "Refused: this order has a history, and the database will not delete it.",
      }
    : { deleted: true, message: "Deleted." };
}
