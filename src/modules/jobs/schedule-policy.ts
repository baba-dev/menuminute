/** Keep the order-expiry and durable outbox SLA unchanged.
 * Media upload repair is independently scheduled to avoid 1Hz idle SQL.
 */
export const OUTBOX_DISPATCH_INTERVAL_MS = 1_000;
export const MEDIA_RECONCILE_INTERVAL_MS = 5_000;
/** Plan overflow (hide dishes beyond a downgraded plan's cap) is a slow sweep, not an event. */
export const PLAN_OVERFLOW_INTERVAL_MS = 15 * 60 * 1000;
