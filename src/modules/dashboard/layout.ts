import { z } from "zod";

/** Closed set: the hero is fixed and never part of the stored layout. */
export const dashboardWidgetIds = [
  "kpis",
  "priorities",
  "dispatch",
  "health",
  "floor",
  "serviceRequests",
] as const;
export type DashboardWidgetId = (typeof dashboardWidgetIds)[number];

export const dashboardWidgetLabels: Record<DashboardWidgetId, string> = {
  kpis: "At a glance",
  priorities: "Today’s priorities",
  dispatch: "The Service Dispatch",
  health: "Outlet health",
  floor: "Dining floor",
  serviceRequests: "Guest service",
};

const widgetId = z.enum(dashboardWidgetIds);
const uniqueIds = z
  .array(widgetId)
  .max(dashboardWidgetIds.length)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate widget");

/** Strict wire contract for PUT. Unknown keys and unknown widget ids are rejected. */
export const dashboardLayoutInput = z
  .object({ version: z.literal(1), order: uniqueIds, hidden: uniqueIds, pinned: uniqueIds })
  .strict();
export type DashboardLayout = z.infer<typeof dashboardLayoutInput>;

export const defaultDashboardLayout: DashboardLayout = {
  version: 1,
  order: [...dashboardWidgetIds],
  hidden: [],
  pinned: [],
};

/**
 * Tolerant read: stored JSON is only a hint. Drop unknown/duplicate ids, append widgets
 * added after the layout was saved, and fall back to the default for malformed values.
 */
export function normalizeDashboardLayout(raw: unknown): DashboardLayout {
  if (!raw || typeof raw !== "object") return defaultDashboardLayout;
  const source = raw as Record<string, unknown>;
  const clean = (value: unknown): DashboardWidgetId[] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<DashboardWidgetId>();
    for (const entry of value) {
      const parsed = widgetId.safeParse(entry);
      if (parsed.success) seen.add(parsed.data);
    }
    return [...seen];
  };
  const order = clean(source["order"]);
  for (const id of dashboardWidgetIds) if (!order.includes(id)) order.push(id);
  return {
    version: 1,
    order,
    hidden: clean(source["hidden"]),
    pinned: clean(source["pinned"]),
  };
}

export type ResolvedWidget = { id: DashboardWidgetId; pinned: boolean; hidden: boolean };

/**
 * Display order: pinned widgets first (in layout order), then the rest. Hidden widgets are
 * kept in the list so the editor can restore them; callers skip rendering and data loading.
 */
export function resolveDashboardLayout(layout: DashboardLayout): ResolvedWidget[] {
  const pinned = new Set(layout.pinned);
  const hidden = new Set(layout.hidden);
  const toWidget = (id: DashboardWidgetId): ResolvedWidget => ({
    id,
    pinned: pinned.has(id),
    hidden: hidden.has(id),
  });
  return [
    ...layout.order.filter((id) => pinned.has(id)).map(toWidget),
    ...layout.order.filter((id) => !pinned.has(id)).map(toWidget),
  ];
}

export function isWidgetVisible(layout: DashboardLayout, id: DashboardWidgetId) {
  return !layout.hidden.includes(id);
}

export type LayoutAction =
  | { type: "move"; id: DashboardWidgetId; direction: -1 | 1 }
  | { type: "toggleHidden"; id: DashboardWidgetId }
  | { type: "togglePinned"; id: DashboardWidgetId }
  | { type: "reset" };

/** Pure reducer used by the editor; moving is within the widget's pinned/unpinned group. */
export function applyLayoutAction(layout: DashboardLayout, action: LayoutAction): DashboardLayout {
  if (action.type === "reset") return defaultDashboardLayout;
  const toggle = (list: DashboardWidgetId[], id: DashboardWidgetId) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
  if (action.type === "toggleHidden")
    return { ...layout, hidden: toggle(layout.hidden, action.id) };
  if (action.type === "togglePinned")
    return { ...layout, pinned: toggle(layout.pinned, action.id) };
  const display = resolveDashboardLayout(layout).map((widget) => widget.id);
  const group = layout.pinned.includes(action.id)
    ? display.filter((id) => layout.pinned.includes(id))
    : display.filter((id) => !layout.pinned.includes(id));
  const from = group.indexOf(action.id);
  const to = from + action.direction;
  if (from < 0 || to < 0 || to >= group.length) return layout;
  const swapped = [...group];
  [swapped[from], swapped[to]] = [swapped[to]!, swapped[from]!];
  const others = display.filter((id) => !group.includes(id));
  const nextDisplay = layout.pinned.includes(action.id)
    ? [...swapped, ...others]
    : [...others, ...swapped];
  return { ...layout, order: nextDisplay };
}
