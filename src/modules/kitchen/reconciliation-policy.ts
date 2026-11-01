/** Keep SSE authoritative for immediate changes and periodic HTTP as a
 * safety net for missing events, reconnects, and authorization revocation.
 */
export function shouldReconcileKitchen(
  healthyStream: boolean,
  msSinceLastFullReconciliation: number
): boolean {
  return !healthyStream || msSinceLastFullReconciliation >= 30_000;
}
