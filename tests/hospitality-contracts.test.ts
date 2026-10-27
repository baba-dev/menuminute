import { describe, it, expect } from "vitest";
import {
  serviceSignalSchema,
  setKitchenAvailabilitySchema,
  actionSchema,
} from "../src/modules/hospitality/service";
describe("Hospitality command schemas", () => {
  it("rejects unrecognized signals and foreign fields", () => {
    expect(
      serviceSignalSchema.safeParse({
        token: "a".repeat(20),
        trackingToken: "b".repeat(20),
        signal: "dangerous",
      }).success
    ).toBe(false);
    expect(
      serviceSignalSchema.safeParse({
        token: "a".repeat(20),
        trackingToken: "b".repeat(20),
        signal: "call_server",
        admin: true,
      }).success
    ).toBe(false);
  });
  it("rejects invalid dish identities or missing boolean status", () => {
    expect(
      setKitchenAvailabilitySchema.safeParse({
        menuId: "menu-id",
        dishId: "",
        soldOut: true,
      }).success
    ).toBe(false);
    expect(
      setKitchenAvailabilitySchema.safeParse({
        menuId: "menu-id",
        dishId: "dish-id",
        soldOut: "true",
      }).success
    ).toBe(false);
  });
  it("permits only acknowledgement or resolution actions", () => {
    expect(
      actionSchema.safeParse({ requestId: crypto.randomUUID(), action: "reset" }).success
    ).toBe(false);
  });
});
