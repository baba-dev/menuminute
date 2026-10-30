// Pure validated contract for the opt-in k6 Kitchen acceptance fixture.
// This helper performs no requests, cannot access credentials on its own,
// and is also exercised by Node's offline tests in the required CI lint lane.
const SHA_HOST = /^https?:\/\/([A-Za-z0-9.-]+)(?::\d{1,5})?$/i;

export function kitchenLoadConfig(env) {
  const rawBase = env.BASE_URL ?? "";
  const baseMatch = SHA_HOST.exec(rawBase);
  const host = baseMatch?.[1]?.toLowerCase() ?? "";
  const declared = (env.KITCHEN_NONPROD_HOST ?? "").toLowerCase();
  const isolatedHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    ["test", "invalid", "internal", "localhost"].some((suffix) => host.endsWith("." + suffix));
  if (
    env.KITCHEN_LOAD_AUTHORIZED_NONPROD !== "YES" ||
    !baseMatch ||
    !host ||
    !declared ||
    !isolatedHost ||
    host !== declared ||
    host === "bababuilds.com" ||
    host.endsWith(".bababuilds.com") ||
    host.includes("..")
  ) {
    throw new Error("Exact approved non-production origin and operator authorization required");
  }
  // The live order endpoint limits source IPs. A single k6 egress IP
  // cannot validate 1000 orders/hour; it measures rate-limit rejections.
  if (env.KITCHEN_MULTI_SOURCE_VERIFIED !== "YES")
    throw new Error("Multiple genuine isolated source IPs must be verified before load");
  const duration = env.DURATION || "10m";
  if (!/^(?:[1-9]|1[0-5])m$/.test(duration))
    throw new Error("Only controlled 1–15 minute non-production windows are allowed");
  const token = env.PUBLIC_TOKEN ?? "";
  const org = env.ORG_ID ?? "";
  const outlet = env.OUTLET_ID ?? "";
  const cookie = env.SESSION_COOKIE ?? "";
  const dish = env.DISH_ID ?? "";
  const rawQuote = env.QUOTE_MINOR ?? "";
  const quote = Number(rawQuote);
  if (
    !token ||
    !org ||
    !outlet ||
    !cookie ||
    !dish ||
    !/^(?:0|[1-9][0-9]*)$/.test(rawQuote) ||
    !Number.isSafeInteger(quote) ||
    quote < 0 ||
    quote > 2147483647
  )
    throw new Error("Approved isolated outlet, scope, session, dish and exact quote required");
  return { base: rawBase, duration, token, org, outlet, cookie, dish, quote };
}

export function kitchenGuestRequest(config, key) {
  if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(key))
    throw new Error("Client submission must be a fresh v4 UUID");
  // The production order contract requires requestedFulfillmentAt for pickup.
  // Choose valid unscheduled dine-in instead of silently testing 422s.
  return {
    token: config.token,
    clientSubmissionKey: key,
    quotedTotalMinor: config.quote,
    fulfillmentMode: "dine_in",
    items: [{ dishId: config.dish, quantity: 1, selectedAddOns: [] }],
  };
}
