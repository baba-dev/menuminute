import { describe, expect, it } from "vitest";
import {
  MEDIA_RECONCILE_INTERVAL_MS,
  OUTBOX_DISPATCH_INTERVAL_MS,
} from "@/modules/jobs/schedule-policy";

describe("production worker performance safeguards", () => {
  it("preserves the one-second outbox and pending-order expiry cadence", () => {
    expect(OUTBOX_DISPATCH_INTERVAL_MS).toBe(1_000);
  });
  it("reduces idle media reconciliation queries without deferring repair excessively", () => {
    expect(MEDIA_RECONCILE_INTERVAL_MS).toBe(5_000);
    expect(3_600_000 / MEDIA_RECONCILE_INTERVAL_MS).toBe(720);
    expect(MEDIA_RECONCILE_INTERVAL_MS).toBeLessThanOrEqual(5_000);
  });
});
