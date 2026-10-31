/** Fixed identities of the single public demo tenant. Never derive these from request input. */
export const DEMO_IDS = {
  userId: "demo-owner",
  userEmail: "demo-owner@demo.menuminute.invalid",
  organizationId: "org-demo-outlet",
  outletId: "demo-outlet",
  menuId: "menu-demo-outlet",
  publicId: "demo-spice-route-kitchen-v2",
} as const;

export const DEMO_RESET_INTERVAL_MS = 30 * 60 * 1000;

/** True when the kill switch is on. Defaults to off: no demo behavior exists unless explicitly enabled.
 * Kept dependency-free so request guards never bundle the demo dataset. */
export function demoModeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env["DEMO_MODE_ENABLED"] === "true";
}
