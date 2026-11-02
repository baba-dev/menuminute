import type { Pool, PoolClient } from "pg";
import { DEMO_IDS } from "../../src/modules/demo/ids";

/**
 * Test isolation for the shared test database.
 *
 * `app_private.reset_demo_outlet` deletes the demo outlet's outbox events but deliberately preserves
 * `consumer_receipts`, whose FK to `outbox_events` then blocks the delete if any receipt exists. Other test
 * files claim outbox events globally (`claimEvents`/`dispatchOnce`) and can therefore leave receipts on demo
 * events, so whether a demo test passes depends on which files share its database (for example, when the
 * suite is sharded). Clear only the demo tenant's receipts before a demo test (re)provisions it.
 * This does not change production behavior; see the follow-up on the reset function itself.
 */
export async function clearDemoConsumerReceipts(db: Pool | PoolClient): Promise<void> {
  await db.query(
    `delete from consumer_receipts where event_id in
       (select id from outbox_events where outlet_id=$1 or organization_id=$2)`,
    [DEMO_IDS.outletId, DEMO_IDS.organizationId]
  );
}
