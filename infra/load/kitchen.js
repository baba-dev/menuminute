// Run only with an approved isolated staging outlet; k6 is a separate load-generator binary.
// Set BASE_URL, PUBLIC_TOKEN, ORG_ID, OUTLET_ID, SESSION_COOKIE, DISH_ID, QUOTE_MINOR,
// KITCHEN_NONPROD_HOST and KITCHEN_LOAD_AUTHORIZED_NONPROD=YES for a disposable test fixture.
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const base = __ENV.BASE_URL || "";
// Parse the literal hostname instead of substring-filtering a URL; reject userinfo.
const match = base.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
const authority = match?.[1] || "";
const hostname = authority.replace(/:\d+$/, "").toLowerCase();
const declared = (__ENV.KITCHEN_NONPROD_HOST || "").toLowerCase();
if (
  __ENV.KITCHEN_LOAD_AUTHORIZED_NONPROD !== "YES" ||
  !authority ||
  authority.includes("@") ||
  !hostname ||
  !declared ||
  hostname !== declared ||
  hostname === "bababuilds.com" ||
  hostname.endsWith(".bababuilds.com")
)
  throw new Error(
    "Explicit exact nonproduction hostname and operator authorization required. Never send synthetic guest orders to production."
  );
const token = __ENV.PUBLIC_TOKEN || "",
  org = __ENV.ORG_ID || "",
  outlet = __ENV.OUTLET_ID || "";
const cookie = __ENV.SESSION_COOKIE || "";
const dish = __ENV.DISH_ID || "";
const quoted = Number(__ENV.QUOTE_MINOR);
if (!token || !org || !outlet || !cookie || !dish || !Number.isSafeInteger(quoted) || quoted < 0)
  throw new Error("A verified isolated outlet, guest menu, and private test session are required");
const errors = new Rate("kitchen_request_errors"),
  latency = new Trend("kitchen_request_duration", true);

export const options = {
  discardResponseBodies: true,
  scenarios: {
    guest: {
      executor: "constant-arrival-rate",
      rate: 1000,
      timeUnit: "1h",
      duration: __ENV.DURATION || "10m",
      preAllocatedVUs: 6,
      maxVUs: 35,
      exec: "guest",
    },
    merchant: {
      executor: "constant-vus",
      vus: 3,
      duration: __ENV.DURATION || "10m",
      exec: "merchant",
    },
    kitchen: {
      executor: "constant-vus",
      vus: 6,
      duration: __ENV.DURATION || "10m",
      exec: "kitchen",
    },
  },
  // Exploratory thresholds only; real business SLO is a separate signed decision.
  thresholds: { kitchen_request_errors: ["rate<0.01"] },
};
const merchantUrl =
  base + "/api/organizations/" + encodeURIComponent(org) + "/outlets/" + encodeURIComponent(outlet);

function uuid() {
  const value = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return value.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 3) | 8).toString(16);
  });
}
function record(response, success) {
  errors.add(!success);
  latency.add(response.timings.duration);
  check(response, { "expected successful response": () => success });
}
function staff(path) {
  return http.get(merchantUrl + path, {
    headers: { Cookie: cookie, "cache-control": "no-cache" },
    timeout: "10s",
  });
}
export function guest() {
  const payload = {
    token,
    clientSubmissionKey: uuid(),
    quotedTotalMinor: quoted,
    fulfillmentMode: "pickup",
    items: [{ dishId: dish, quantity: 1, selectedAddOns: [] }],
  };
  const response = http.post(base + "/api/public-orders", JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", Origin: base },
    timeout: "10s",
  });
  record(response, response.status === 201);
}
export function merchant() {
  const response = staff("/orders?status=active");
  record(response, response.status === 200);
  sleep(0.5);
}
export function kitchen() {
  const board = staff("/kitchen");
  record(board, board.status === 200);
  const expo = staff("/kitchen/expo");
  record(expo, expo.status === 200);
  sleep(0.5);
}
export function handleSummary(data) {
  const summary = {
    scenario: "Kitchen Pro non-production synthetic load",
    iterationSummary: {
      guest: data.metrics.iterations?.values?.count,
      failed: data.metrics.kitchen_request_errors?.values?.rate,
    },
    latencyMs: {
      p50: data.metrics.kitchen_request_duration?.values?.["p(50)"],
      p95: data.metrics.kitchen_request_duration?.values?.["p(95)"],
      p99: data.metrics.kitchen_request_duration?.values?.["p(99)"],
    },
    warnings: [
      "This does not establish ERP coexistence or production readiness; attach separate host measurements, overflow and recovery evidence.",
      "Station actions, expeditor release, SSE reconnect and payment isolation are tested by PostgreSQL and Playwright fixtures.",
    ],
  };
  return { stdout: JSON.stringify(summary, null, 2) + "\n" };
}
