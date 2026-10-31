import type { Pool } from "pg";
import { env } from "@/lib/config/env";
import { sendEmptyPush } from "./vapid";

type Lease = {
  id: string;
  endpoint: string;
  lease: string;
  kind: "order.created" | "kitchen.changed";
};

/** Independent, bounded durable-push lane; does not steal the order/Kitchen BullMQ slots. */
export function startPushDispatcher(pool: Pool) {
  if (!env.PWA_PUSH_ENABLED) return { close: async () => {} };
  const keys = {
    publicKey: env.PWA_PUSH_VAPID_PUBLIC_KEY!,
    privateKey: env.PWA_PUSH_VAPID_PRIVATE_KEY!,
    subject: env.PWA_PUSH_VAPID_SUBJECT!,
  };
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
          [env.PWA_PUSH_OUTLET_IDS]
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
