import type { ClientShellSnapshot } from "./notification-model";

const STATES = new Set(["ready", "restricted", "unavailable"]);
const num = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => !!value && typeof value === "object";

function section<T>(value: unknown, read: (data: Raw) => T | null) {
  if (!isObject(value) || typeof value["state"] !== "string" || !STATES.has(value["state"]))
    return null;
  if (value["state"] !== "ready") return { state: value["state"], data: null } as const;
  if (!isObject(value["data"])) return null;
  const data = read(value["data"]);
  return data === null ? null : ({ state: "ready", data } as const);
}

/**
 * Validates the shell response before it is trusted. Returns null for anything that is not
 * exactly the expected shape for this outlet, so a malformed or cross-outlet response is
 * treated as a failed refresh instead of corrupting the alerts.
 */
export function parseShellSnapshot(body: unknown, outletId: string): ClientShellSnapshot | null {
  if (!isObject(body) || body["outletId"] !== outletId || typeof body["checkedAt"] !== "string")
    return null;
  const pulse = section(body["pulse"], (d) =>
    ["pending", "preparing", "ready", "active", "completedToday"].every((k) => num(d[k]))
      ? {
          pending: d["pending"] as number,
          preparing: d["preparing"] as number,
          ready: d["ready"] as number,
          active: d["active"] as number,
          completedToday: d["completedToday"] as number,
        }
      : null
  );
  const requests = section(body["requests"], (d) =>
    num(d["open"]) &&
    num(d["unacknowledged"]) &&
    (d["oldestAt"] === null || typeof d["oldestAt"] === "string")
      ? {
          open: d["open"],
          unacknowledged: d["unacknowledged"],
          oldestAt: d["oldestAt"] as string | null,
        }
      : null
  );
  const till = section(body["till"], (d) =>
    typeof d["open"] === "boolean" &&
    num(d["registers"]) &&
    typeof d["currency"] === "string" &&
    (d["expectedMinor"] === null || typeof d["expectedMinor"] === "string") &&
    (d["openedAt"] === null || typeof d["openedAt"] === "string")
      ? {
          open: d["open"],
          registers: d["registers"],
          currency: d["currency"],
          expectedMinor: d["expectedMinor"] as string | null,
          openedAt: d["openedAt"] as string | null,
        }
      : null
  );
  if (!pulse || !requests || !till) return null;
  return {
    outletId,
    checkedAt: body["checkedAt"],
    pulse,
    requests,
    till,
  } as ClientShellSnapshot;
}
