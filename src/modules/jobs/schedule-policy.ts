/** Keep the order-expiry and durable outbox SLA unchanged.
 * Media upload repair is independently scheduled to avoid 1Hz idle SQL.
 */
export const OUTBOX_DISPATCH_INTERVAL_MS = 1_000;
export const MEDIA_RECONCILE_INTERVAL_MS = 5_000;
