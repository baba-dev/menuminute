import { describe, expect, it } from "vitest";
import { reservePlayPurchaseCall } from "../src/modules/billing/play-rate-limit";

describe("Play purchase endpoint rate limit (real Redis)", () => {
  it("allows a burst per account then rejects, independently per kind and account", async () => {
    const actor = "actor-" + crypto.randomUUID();
    const org = "org-" + crypto.randomUUID();
    for (let i = 0; i < 30; i += 1) await reservePlayPurchaseCall("verify", actor, org);
    await expect(reservePlayPurchaseCall("verify", actor, org)).rejects.toMatchObject({
      statusCode: 429,
    });
    // A different kind and a different account are unaffected.
    await reservePlayPurchaseCall("intent", actor, org);
    await reservePlayPurchaseCall(
      "verify",
      "actor-" + crypto.randomUUID(),
      "org-" + crypto.randomUUID()
    );
  });
});
