import type { MenuEngineeringQuadrant } from "./contracts";

/**
 * A revenue/popularity segmentation, NOT a contribution-margin matrix.
 * Do not infer profit without verified per-dish costs.
 */
export function classifyMenuDish(
  quantitySold: number,
  revenueMinor: number,
  meanQuantity: number,
  meanRevenueMinor: number
): MenuEngineeringQuadrant {
  if (quantitySold >= meanQuantity && revenueMinor >= meanRevenueMinor) return "star";
  if (quantitySold >= meanQuantity) return "plowhorse";
  if (revenueMinor >= meanRevenueMinor) return "puzzle";
  return "dog";
}
