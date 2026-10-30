// Run only with an approved isolated staging outlet; k6 is a separate load-generator binary.
// Set BASE_URL, PUBLIC_TOKEN, ORG_ID, OUTLET_ID, SESSION_COOKIE, DISH_ID, QUOTE_MINOR,
// KITCHEN_NONPROD_HOST, KITCHEN_LOAD_AUTHORIZED_NONPROD=YES and KITCHEN_MULTI_SOURCE_VERIFIED=YES for a disposable test fixture.
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { kitchenLoadConfig, kitchenGuestRequest } from "./kitchen-contract.mjs";

const config = kitchenLoadConfig(__ENV);
const { base, duration, token, org, outlet, cookie, dish, quote: quoted } = config;
const errors = new Rate("kitchen_request_errors"),
  throttled = new Rate("kitchen_request_429"),
  guestRequests = new Counter("kitchen_guest_requests"),
  guestCreated = new Counter("kitchen_guest_created"),
  latency = new Trend("kitchen_request_duration", true);

export const options = {
  discardResponseBodies: true,
  scenarios: {
    guest: {
      executor: "constant-arrival-rate",
      rate: 1000,
      timeUnit: "1h",
      duration: duration,
      preAllocatedVUs: 6,
      maxVUs: 35,
      exec: "guest",
    },
    merchant: {
      executor: "constant-vus",
      vus: 3,
      duration: duration,
      exec: "merchant",
    },
    kitchen: {
      executor: "constant-vus",
      vus: 6,
      duration: duration,
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
  throttled.add(response.status === 429);
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
  const payload = kitchenGuestRequest(config, uuid());
  guestRequests.add(1);
  const response = http.post(base + "/api/public-orders", JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", Origin: base },
    timeout: "10s",
  });
  if (response.status === 201) guestCreated.add(1);
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
    runContract: {
      scheduledGuestArrivalRatePerHour: 1000,
      configuredDuration: duration,
      modeledOutlets: 1,
      simulatedMultiSourceEgressVerifiedByOperator: true,
      representative25Owner50OutletLoad: false,
      erpCoexistenceMeasured: false,
    },
    iterationSummary: {
      guestAttempts: data.metrics.kitchen_guest_requests?.values?.count,
      guestCommitted201: data.metrics.kitchen_guest_created?.values?.count,
      allRequestFailureRate: data.metrics.kitchen_request_errors?.values?.rate,
      rateLimit429Rate: data.metrics.kitchen_request_429?.values?.rate,
    },
    latencyMs: {
      p50: data.metrics.kitchen_request_duration?.values?.["p(50)"],
      p95: data.metrics.kitchen_request_duration?.values?.["p(95)"],
      p99: data.metrics.kitchen_request_duration?.values?.["p(99)"],
    },
    warnings: [
      "This does not establish ERP coexistence or production readiness; attach separate host measurements, overflow and recovery evidence.",
      "Station actions, expeditor release, SSE reconnect and payment isolation are tested by PostgreSQL and Playwright fixtures.",
      "A single IP is not a realistic source for 1000 orders/hour; confirm real multi-IP egress and review 429s separately.",
    ],
  };
  return { stdout: JSON.stringify(summary, null, 2) + "\n" };
}
