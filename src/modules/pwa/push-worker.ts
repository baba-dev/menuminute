import type { Pool } from "pg";
import { createVapidHeaders, sendEmptyPush } from "./vapid";

type Lease = {
  id: string;
  endpoint: string;
  lease: string;
  kind: "order.created" | "kitchen.changed";
};

type PushSettings = {
  outletIds: string[];
  keys: { publicKey: string; privateKey: string; subject: string };
};

/**
 * The isolated worker deliberately has WORKER_DATABASE_URL, not DATABASE_URL,
 * APP_URL or AUTH_SECRET. Never import the web env parser into this bundle.
 */
export function parsePushWorkerSettings(source: Readonly<Record<string, string | undefined>>): PushSettings | null {
  const flag = source["PWA_PUSH_ENABLED"] ?? "false";
  if (flag === "false") return null;
  if (flag !== "true") throw new Error("PWA_PUSH_ENABLED must be true or false");
  const outletIds = (source["PWA_PUSH_OUTLET_IDS"] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (
    outletIds.length === 0 ||
    outletIds.length > 50 ||
    new Set(outletIds).size !== outletIds.length ||
    outletIds.some((id) => !/^[A-Za-z0-9_-]{1,128}$/.test(id))
  ) {
    throw new Error("Worker push requires a unique bounded outlet allowlist");
  }
  const keys = {
    publicKey: source["PWA_PUSH_VAPID_PUBLIC_KEY"] ?? "",
    privateKey: source["PWA_PUSH_VAPID_PRIVATE_KEY"] ?? "",
    subject: source["PWA_PUSH_VAPID_SUBJECT"] ?? "",
  };
  // Fail closed at startup instead of accepting invalid key pairs after a queue lease.
  createVapidHeaders(
    "https://web.push.apple.com/vapid-check",
    keys.publicKey,
    keys.privateKey,
    keys.subject
  );
  return { outletIds, keys };
}

/** Independent, bounded durable-push lane; does not steal the order/Kitchen BullMQ slots. */
export function startPushDispatcher(pool: Pool) {
  const settings = parsePushWorkerSettings(process.env);
  if (!settings) return { close: async () => {} };
  const { keys, outletIds } = settings;
  let stopping = false;
  let pending: Promise<void> | undefined;
  const tick = () => {
    if (stopping || pending) return;
    pending = (async () => {
      // The role has no SELECT privilege on subscriptions; the SQL lease function
      // reauthorizes live sessions, memberships and outlet grants at delivery time.
      for (let i = 0; i < 3; i++) {
        const result = await pool.query<{ data: Lease | null }>(
          "select app_private.pwa_push_claim($1::text[]) as data",
          [outletIds]
        );
        const job = result.rows[0]?.data;
        if (!job) break;
        const outcome = await sendEmptyPush(job.endpoint, keys);
        await pool.query("select app_private.pwa_push_finish($1,$2,$3)", [
          job.id,
          job.lease,
          outcome,
        ]);
      }
    })()
      .catch(() => console.error("[pwa-push] Delivery lane unavailable; retrying safely"))
      .finally(() => {
        pending = undefined;
      });
  };
  const timer = setInterval(tick, 4000);
  tick();
  let prunePending: Promise<unknown> | undefined;
  const prune = () => {
    if (stopping || prunePending) return;
    prunePending = pool
      .query("select app_private.pwa_push_prune()")
      .catch(() => console.error("[pwa-push] Retention maintenance unavailable"))
      .finally(() => {
        prunePending = undefined;
      });
  };
  const pruneTimer = setInterval(prune, 6 * 60 * 60 * 1000);
  prune();
  return {
    async close() {
      stopping = true;
      clearInterval(timer);
      clearInterval(pruneTimer);
      await Promise.all([pending, prunePending]);
    },
  };
}
