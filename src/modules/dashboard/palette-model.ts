import type { DashboardNavigation } from "@/modules/menu-product/dashboard-data";
import { resolveNavigation, type NavIcon } from "./nav-model";
import type { PaletteDish, PaletteOrder, PaletteTable, Section } from "./shell-data";

export type PaletteGroupId = "actions" | "dishes" | "orders" | "tables" | "pages" | "ember";

export type PaletteCommand =
  | { kind: "navigate"; href: string }
  | { kind: "toggle-dish"; dish: PaletteDish }
  | { kind: "ember"; prompt: string }
  | { kind: "command"; id: "toggle-sound" | "open-notifications" };

export type PaletteIcon = NavIcon | "plus" | "search" | "sparkles" | "bell" | "volume" | "dish";

export type PaletteEntry = {
  id: string;
  group: PaletteGroupId;
  label: string;
  detail: string;
  icon: PaletteIcon;
  keywords: string[];
  command: PaletteCommand;
  /** Status is always text as well as tone, never colour alone. */
  status?: { tone: "good" | "warn" | "bad" | "neutral"; text: string };
  /** Visible but not runnable, for example a dish whose change is still being saved. */
  disabled?: boolean;
};

export type PaletteIndexData = {
  dishes: Section<PaletteDish[]> | null;
  tables: Section<PaletteTable[]> | null;
  orders: Section<PaletteOrder[]> | null;
};

export type PaletteFlags = {
  capabilities: DashboardNavigation | undefined;
  menuWrite: boolean;
  assistantEnabled: boolean;
};

export const groupLabels: Record<PaletteGroupId, string> = {
  actions: "Actions",
  dishes: "Dishes",
  orders: "Orders",
  tables: "Tables",
  pages: "Go to",
  ember: "Ask Ember",
};

const groupLimit: Record<PaletteGroupId, number> = {
  actions: 6,
  dishes: 6,
  orders: 5,
  tables: 5,
  pages: 7,
  ember: 1,
};

export function normalize(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

export type ParsedQuery = {
  raw: string;
  text: string;
  tokens: string[];
  /** A bare number, "#42" or "order 42": look up an order. */
  orderNumber: string | null;
  /** The user is asking a question: Ember should be offered first. */
  askEmber: boolean;
};

const QUESTION_START =
  /^(how|what|why|when|which|who|show|tell|list|summari[sz]e|compare|is|are|do|does|can|should)\b/;

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim().slice(0, 200);
  const explicit = trimmed.startsWith("?");
  const text = normalize(explicit ? trimmed.slice(1) : trimmed);
  const tokens = text.split(" ").filter(Boolean);
  const numeric = text.match(/^(?:#|order\s*#?\s*|no\.?\s*)?(\d{1,9})$/);
  return {
    raw: trimmed,
    text,
    tokens,
    orderNumber: numeric ? String(Number(numeric[1])) : null,
    askEmber: explicit || (tokens.length >= 4 && QUESTION_START.test(text)) || tokens.length >= 6,
  };
}

/** 0 means "does not match". Every token must match somewhere (AND), which keeps results precise. */
export function scoreEntry(entry: PaletteEntry, tokens: string[]): number {
  if (!tokens.length) return 1;
  const label = normalize(entry.label);
  const labelWords = label.split(" ");
  const keywords = entry.keywords.map(normalize);
  const detail = normalize(entry.detail);
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    if (label.startsWith(token)) best = 100;
    else if (labelWords.some((word) => word.startsWith(token))) best = 80;
    else if (label.includes(token)) best = 55;
    if (best < 45 && keywords.some((k) => k.split(" ").some((w) => w.startsWith(token)))) best = 45;
    if (best < 30 && keywords.some((k) => k.includes(token))) best = 30;
    if (best < 20 && detail.includes(token)) best = 20;
    if (best === 0) return 0;
    total += best;
  }
  const whole = tokens.join(" ");
  return total / tokens.length + (label.startsWith(whole) ? 20 : 0);
}

/** Destinations and verbs that need no server data. Only what the user may actually do. */
export function buildStaticEntries(flags: PaletteFlags): PaletteEntry[] {
  const { capabilities, menuWrite } = flags;
  const nav = resolveNavigation(capabilities);
  const available = (id: string) => nav.find((item) => item.id === id)?.nav.state === "available";
  const entries: PaletteEntry[] = [];

  for (const item of nav) {
    if (item.nav.state !== "available") continue;
    entries.push({
      id: "page:" + item.id,
      group: "pages",
      label: item.nav.label,
      detail: item.id === "overview" ? "Home" : "Page",
      icon: item.icon,
      keywords: item.keywords,
      command: { kind: "navigate", href: item.href },
    });
  }
  const page = (id: string, label: string, href: string, icon: PaletteIcon, keywords: string[]) =>
    entries.push({
      id: "page:" + id,
      group: "pages",
      label,
      detail: "Page",
      icon,
      keywords,
      command: { kind: "navigate", href },
    });
  if (available("reports"))
    page("z-report", "Z-report", "/dashboard/reports/z-report", "reports", [
      "end of day",
      "close day",
      "daily report",
    ]);
  page("pos-ledger", "POS ledger", "/dashboard/pos/ledger", "pos", [
    "receipts",
    "sales history",
    "refunds",
  ]);
  page("account", "Account & security", "/account", "settings", [
    "password",
    "two factor",
    "devices",
    "profile",
  ]);
  page("help-guides", "Help & Guides", "/help/owner", "search", [
    "help",
    "docs",
    "documentation",
    "support",
    "how to",
    "guide",
    "faq",
    "tutorial",
  ]);

  const action = (
    id: string,
    label: string,
    href: string,
    icon: PaletteIcon,
    keywords: string[],
    detail = "Action"
  ) =>
    entries.push({
      id: "action:" + id,
      group: "actions",
      label,
      detail,
      icon,
      keywords,
      command: { kind: "navigate", href },
    });
  action("open-till", "Open till", "/dashboard/pos", "pos", [
    "register",
    "start shift",
    "cash",
    "new sale",
  ]);
  action("new-order", "New order", "/dashboard/pos", "plus", ["take order", "sale", "walk in"]);
  action("close-till", "Close the till", "/dashboard/pos/closing", "pos", [
    "end shift",
    "count cash",
    "closing desk",
  ]);
  if (menuWrite) {
    action("add-dish", "Add a dish", "/dashboard/menu", "plus", ["new dish", "create dish"]);
    action("import-menu", "Import a menu", "/dashboard/menu/import", "menu", [
      "upload",
      "photo menu",
      "scan menu",
    ]);
    action("new-qr", "Create a QR code", "/dashboard/qr-codes", "qr", ["new qr", "table tent"]);
  }
  entries.push(
    {
      id: "action:sound",
      group: "actions",
      label: "Turn order sound on or off",
      detail: "Setting",
      icon: "volume",
      keywords: ["mute", "chime", "alerts", "notification sound", "snooze"],
      command: { kind: "command", id: "toggle-sound" },
    },
    {
      id: "action:notifications",
      group: "actions",
      label: "Open notifications",
      detail: "Action",
      icon: "bell",
      keywords: ["alerts", "bell", "inbox"],
      command: { kind: "command", id: "open-notifications" },
    }
  );
  return entries;
}

const statusLabel: Record<string, string> = {
  pending: "Awaiting acceptance",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
};

/** Entries built from the fetched index. A restricted or failed source simply yields none. */
export function buildDynamicEntries(index: PaletteIndexData, flags: PaletteFlags): PaletteEntry[] {
  const entries: PaletteEntry[] = [];
  const canToggle = flags.menuWrite || flags.capabilities?.kitchenRead === true;
  if (index.dishes?.state === "ready") {
    for (const dish of index.dishes.data) {
      entries.push({
        id: "dish:" + dish.menuId + ":" + dish.id,
        group: "dishes",
        label: canToggle
          ? dish.soldOut
            ? "Restore " + dish.name
            : "Mark " + dish.name + " sold out"
          : dish.name,
        detail: dish.category,
        icon: "dish",
        keywords: canToggle ? [dish.name, "availability", "86", "stock"] : [dish.name],
        status: dish.soldOut
          ? { tone: "bad", text: "Sold out" }
          : { tone: "good", text: "Available" },
        command: canToggle
          ? { kind: "toggle-dish", dish }
          : { kind: "navigate", href: "/dashboard/menu" },
      });
    }
  }
  if (index.tables?.state === "ready") {
    for (const table of index.tables.data) {
      const name = table.label?.trim() || "Table " + table.tableNumber;
      entries.push({
        id: "table:" + table.id,
        group: "tables",
        label: name,
        detail: table.activeOrders + " active · " + table.unpaidOrders + " unpaid",
        icon: "floor",
        keywords: ["table " + table.tableNumber, "t" + table.tableNumber, table.tableNumber],
        status:
          table.unpaidOrders > 0
            ? { tone: "warn", text: "Unpaid" }
            : table.activeOrders > 0
              ? { tone: "neutral", text: "In service" }
              : { tone: "good", text: "Clear" },
        command: {
          kind: "navigate",
          href: "/dashboard/floor?table=" + encodeURIComponent(table.id),
        },
      });
    }
  }
  if (index.orders?.state === "ready") {
    for (const order of index.orders.data) {
      entries.push({
        id: "order:" + order.id,
        group: "orders",
        label: "Order #" + order.orderNumber,
        detail: [order.servicePoint ?? order.fulfillmentMode.replace("_", " "), order.paymentStatus]
          .filter(Boolean)
          .join(" · "),
        icon: "orders",
        keywords: [
          String(order.orderNumber),
          "#" + order.orderNumber,
          "order " + order.orderNumber,
        ],
        status: {
          tone: order.status === "pending" ? "warn" : order.status === "ready" ? "good" : "neutral",
          text: statusLabel[order.status] ?? order.status,
        },
        command: { kind: "navigate", href: "/dashboard/orders?q=" + order.orderNumber },
      });
    }
  }
  return entries;
}

export type PaletteSection = { group: PaletteGroupId; label: string; entries: PaletteEntry[] };

/**
 * One call produces the grouped, ranked, capped result list for a query.
 * - Empty query: suggested actions and pages only (no dynamic data is shown unprompted).
 * - A number or "#42": orders first, with a history fallback when no active order matches.
 * - A question: "Ask Ember" first when the assistant is enabled; otherwise it is offered last.
 */
export function searchPalette(
  rawQuery: string,
  statics: PaletteEntry[],
  dynamics: PaletteEntry[],
  flags: Pick<PaletteFlags, "assistantEnabled">
): PaletteSection[] {
  const query = parseQuery(rawQuery);
  const pool = query.text ? [...statics, ...dynamics] : statics;
  const byGroup = new Map<PaletteGroupId, { entry: PaletteEntry; score: number }[]>();
  for (const entry of pool) {
    let score: number;
    if (query.orderNumber && entry.group === "orders") {
      // Orders match on their number alone: an exact number outranks a prefix.
      const number = entry.keywords[0] ?? "";
      score = number === query.orderNumber ? 200 : number.startsWith(query.orderNumber) ? 120 : 0;
    } else {
      score = scoreEntry(entry, query.tokens);
    }
    if (score <= 0) continue;
    const bucket = byGroup.get(entry.group) ?? [];
    bucket.push({ entry, score });
    byGroup.set(entry.group, bucket);
  }

  const sections = new Map<PaletteGroupId, PaletteEntry[]>();
  for (const [group, rows] of byGroup) {
    rows.sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label));
    sections.set(
      group,
      rows.slice(0, groupLimit[group]).map((row) => row.entry)
    );
  }

  if (query.orderNumber && !(sections.get("orders") ?? []).some((e) => e.id.startsWith("order:"))) {
    sections.set("orders", [
      {
        id: "orders:history:" + query.orderNumber,
        group: "orders",
        label: "Search orders for #" + query.orderNumber,
        detail: "Includes completed and cancelled orders",
        icon: "search",
        keywords: [],
        command: {
          kind: "navigate",
          href: "/dashboard/orders?q=" + query.orderNumber + "&tab=history",
        },
      },
      ...(sections.get("orders") ?? []),
    ]);
  }

  if (flags.assistantEnabled && query.text.length >= 3 && query.tokens.length >= 2) {
    const prompt = query.raw.replace(/^\?\s*/, "").slice(0, 500);
    sections.set("ember", [
      {
        id: "ember:ask",
        group: "ember",
        label: "Ask Ember: " + prompt,
        detail: "Opens the assistant with this question. Nothing is sent until you press Send.",
        icon: "sparkles",
        keywords: [],
        command: { kind: "ember", prompt },
      },
    ]);
  }

  const order: PaletteGroupId[] = query.orderNumber
    ? ["orders", "tables", "actions", "dishes", "pages", "ember"]
    : query.askEmber
      ? ["ember", "actions", "dishes", "orders", "tables", "pages"]
      : ["actions", "dishes", "orders", "tables", "pages", "ember"];
  return order
    .map((group) => ({ group, label: groupLabels[group], entries: sections.get(group) ?? [] }))
    .filter((section) => section.entries.length > 0);
}

const SECTION_STATES = new Set(["ready", "restricted", "unavailable"]);
const str = (value: unknown): value is string => typeof value === "string" && value.length > 0;
type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => !!value && typeof value === "object";

function parseSection<T>(value: unknown, item: (row: Raw) => T | null): Section<T[]> | null {
  if (!isObject(value) || typeof value["state"] !== "string" || !SECTION_STATES.has(value["state"]))
    return null;
  if (value["state"] !== "ready") return { state: value["state"] as "restricted", data: null };
  if (!Array.isArray(value["data"])) return null;
  const rows: T[] = [];
  for (const row of value["data"]) {
    const parsed = isObject(row) ? item(row) : null;
    if (parsed) rows.push(parsed);
  }
  return { state: "ready", data: rows };
}

/**
 * Validates the palette index before it is trusted. A section with an unexpected shape is
 * dropped (treated as unavailable); individual malformed rows are skipped. Returns null if the
 * response is for another outlet.
 */
export function parsePaletteIndex(body: unknown, outletId: string): PaletteIndexData | null {
  if (!isObject(body) || body["outletId"] !== outletId) return null;
  const unavailable = { state: "unavailable", data: null } as const;
  return {
    dishes:
      parseSection(body["dishes"], (r) =>
        str(r["id"]) && str(r["menuId"]) && str(r["name"]) && typeof r["soldOut"] === "boolean"
          ? {
              id: r["id"],
              menuId: r["menuId"],
              name: r["name"],
              category: typeof r["category"] === "string" ? r["category"] : "",
              soldOut: r["soldOut"],
            }
          : null
      ) ?? unavailable,
    tables:
      parseSection(body["tables"], (r) =>
        str(r["id"]) &&
        str(r["tableNumber"]) &&
        typeof r["activeOrders"] === "number" &&
        typeof r["unpaidOrders"] === "number"
          ? {
              id: r["id"],
              tableNumber: r["tableNumber"],
              label: typeof r["label"] === "string" ? r["label"] : null,
              activeOrders: r["activeOrders"],
              unpaidOrders: r["unpaidOrders"],
            }
          : null
      ) ?? unavailable,
    orders:
      parseSection(body["orders"], (r) =>
        str(r["id"]) &&
        typeof r["orderNumber"] === "number" &&
        Number.isFinite(r["orderNumber"]) &&
        str(r["status"]) &&
        typeof r["fulfillmentMode"] === "string" &&
        typeof r["paymentStatus"] === "string"
          ? {
              id: r["id"],
              orderNumber: r["orderNumber"],
              status: r["status"],
              servicePoint: typeof r["servicePoint"] === "string" ? r["servicePoint"] : null,
              fulfillmentMode: r["fulfillmentMode"],
              paymentStatus: r["paymentStatus"],
            }
          : null
      ) ?? unavailable,
  };
}
