import test from "node:test";
import assert from "node:assert/strict";
import { kitchenLoadConfig, kitchenGuestRequest } from "./kitchen-contract.mjs";

const env = {
  BASE_URL: "https://kitchen-ci.test:8443",
  KITCHEN_NONPROD_HOST: "kitchen-ci.test",
  KITCHEN_LOAD_AUTHORIZED_NONPROD: "YES",
  KITCHEN_MULTI_SOURCE_VERIFIED: "YES",
  PUBLIC_TOKEN: "test-public-token",
  ORG_ID: "org-test",
  OUTLET_ID: "outlet-test",
  SESSION_COOKIE: "test=only",
  DISH_ID: "test-paneer",
  QUOTE_MINOR: "12000",
  DURATION: "10m",
};
const key = ["3fa85f64", "5717", "4562", "b3fc", "2c963f66afa6"].join("-");

test("accepts a bounded isolated fixture and generates a schema-valid unscheduled guest order", () => {
  const config = kitchenLoadConfig(env);
  assert.equal(config.duration, "10m");
  assert.deepEqual(kitchenGuestRequest(config, key), {
    token: env.PUBLIC_TOKEN,
    clientSubmissionKey: key,
    quotedTotalMinor: 12000,
    fulfillmentMode: "dine_in",
    items: [{ dishId: env.DISH_ID, quantity: 1, selectedAddOns: [] }],
  });
});

test("refuses production, arbitrary origin paths, unapproved egress, excessive duration and bad money", () => {
  const overrides = [
    { BASE_URL: "https://food.bababuilds.com", KITCHEN_NONPROD_HOST: "food.bababuilds.com" },
    { BASE_URL: "https://food.bababuilds.com.", KITCHEN_NONPROD_HOST: "food.bababuilds.com." },
    { BASE_URL: "https://prod.example.net", KITCHEN_NONPROD_HOST: "prod.example.net" },
    { BASE_URL: "https://192.0.2.42", KITCHEN_NONPROD_HOST: "192.0.2.42" },
    { BASE_URL: "https://kitchen-ci.test/extra" },
    { BASE_URL: "https://user@kitchen-ci.test" },
    { BASE_URL: "https://kitchen-ci.test", KITCHEN_NONPROD_HOST: "other.test" },
    { KITCHEN_LOAD_AUTHORIZED_NONPROD: "" },
    { KITCHEN_MULTI_SOURCE_VERIFIED: "" },
    { DURATION: "30m" },
    { QUOTE_MINOR: "-100" },
    { QUOTE_MINOR: "" },
    { QUOTE_MINOR: "0012000" },
    { QUOTE_MINOR: "1e4" },
    { QUOTE_MINOR: "1.2" },
    { QUOTE_MINOR: "2147483648" },
    { PUBLIC_TOKEN: "" },
  ];
  for (const override of overrides)
    assert.throws(
      () => kitchenLoadConfig({ ...env, ...override }),
      undefined,
      JSON.stringify(override)
    );
});

test("refuses an invalid or reused non-v4 client submission key format", () => {
  const config = kitchenLoadConfig(env);
  for (const bad of ["", "not-an-order-key", key.replace("-4", "-1")])
    assert.throws(() => kitchenGuestRequest(config, bad), /fresh v4 UUID/);
});
