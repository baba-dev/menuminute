import { describe, expect, it } from "vitest";
import { acquireKitchenStream } from "../src/modules/kitchen/stream-lease";
import { isKitchenStreamRevocation } from "../src/modules/kitchen/stream-auth";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "../src/lib/errors";

describe("distributed Kitchen SSE stream leases", () => {
  it("limits concurrent connections per session/outlet and releases seats across requests", async () => {
    const id = crypto.randomUUID();
    const first = await acquireKitchenStream(id, id, id);
    const second = await acquireKitchenStream(id, id, id);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    try {
      expect(await acquireKitchenStream(id, id, id)).toBeNull();
      expect(await first!.renew()).toBe(true);
      await first!.release();
      expect(await first!.renew()).toBe(false);
      const third = await acquireKitchenStream(id, id, id);
      expect(third).not.toBeNull();
      await third!.release();
    } finally {
      await first?.release();
      await second?.release();
    }
  });
  it("separates different sessions for the same authenticated user", async () => {
    const outlet = crypto.randomUUID();
    const user = crypto.randomUUID();
    const leases = await Promise.all(
      Array.from({ length: 3 }, (_, i) => acquireKitchenStream(user, "session-" + i, outlet))
    );
    try {
      expect(leases.every(Boolean)).toBe(true);
    } finally {
      await Promise.all(leases.map(async (lease) => lease?.release()));
    }
  });
});

describe("Kitchen SSE error decisions", () => {
  it("uses revoked only for confirmed authorization failures", () => {
    for (const error of [
      new UnauthorizedError(),
      new ForbiddenError(),
      new NotFoundError("Outlet"),
    ]) {
      expect(isKitchenStreamRevocation(error)).toBe(true);
    }
    expect(isKitchenStreamRevocation(new Error("PostgreSQL timeout"))).toBe(false);
    expect(isKitchenStreamRevocation(new Error("Redis unavailable"))).toBe(false);
  });
});
