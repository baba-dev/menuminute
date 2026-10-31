import { DEMO_IDS, demoModeEnabled } from "./ids";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const outletScope = `^/api/organizations/${DEMO_IDS.organizationId}/outlets/${DEMO_IDS.outletId}`;

/**
 * Mutations the shared demo account may perform. This is an ALLOWLIST: anything else is denied, so a
 * newly added route is blocked for the demo until it is deliberately listed here. Every allowed
 * mutation must be undone by app_private.reset_demo_outlet (menu document, translations, orders,
 * kitchen work, service requests, Ember conversations). Account, billing, team, uploads, QR, POS,
 * legacy menu tables, outlet profile, AI autofill and menu import are intentionally absent.
 */
const ALLOWED: ReadonlyArray<readonly [method: string, pattern: RegExp]> = [
  ["PATCH", new RegExp(`^/api/catalog/${DEMO_IDS.menuId}$`)],
  ["PUT", new RegExp(`^/api/catalog/${DEMO_IDS.menuId}/translations$`)],
  ["POST", /^\/api\/context$/],
  ["POST", /^\/api\/assistant\/conversations$/],
  ["POST", /^\/api\/assistant\/conversations\/[^/]+\/turns$/],
  ["POST", new RegExp(`${outletScope}/orders/[^/]+/transition$`)],
  ["POST", new RegExp(`${outletScope}/service-requests$`)],
  ["POST", new RegExp(`${outletScope}/menu/quick-availability$`)],
  ["POST", new RegExp(`${outletScope}/kitchen/(work|release|reassign)$`)],
];

export function isDemoActor(userId: string, enabled: boolean = demoModeEnabled()): boolean {
  return enabled && userId === DEMO_IDS.userId;
}

export function demoRequestAllowed(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  if (SAFE_METHODS.has(m)) return true;
  return ALLOWED.some(([allowedMethod, pattern]) => allowedMethod === m && pattern.test(pathname));
}

/** Better Auth endpoints a demo session may still call (everything else, such as password, email,
 * two-factor and account deletion, is refused). */
const AUTH_ALLOWED = new Set(["/sign-out", "/sign-in/email", "/sign-up/email"]);
export function demoAuthPathAllowed(pathname: string): boolean {
  return AUTH_ALLOWED.has(pathname.replace(/^\/api\/auth/, ""));
}
