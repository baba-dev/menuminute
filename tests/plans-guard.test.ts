import { describe, expect, it } from "vitest";
import { LimitReachedError } from "../src/lib/errors";
import { enforceCap, type PlanStore } from "../src/modules/plans/guard";

type Facts = { ordering: boolean; kitchen: boolean; community: boolean };
const FREE: Facts = { ordering: false, kitchen: false, community: false };

/** In-memory store; `counts` can be mutated by the guarded work to simulate writes. */
function fakeStore(counts: Record<string, number>, facts: Facts | null = FREE) {
  const calls: string[] = [];
  const store: PlanStore = {
    async lock(ids) {
      calls.push(`lock:${ids.join(",")}`);
    },
    async facts() {
      return facts;
    },
    async count(id) {
      return counts[id] ?? 0;
    },
  };
  return { store, calls };
}

describe("enforceCap", () => {
  it("allows growth up to the cap and rejects growth past it", async () => {
    const counts = { o1: 19 };
    const { store } = fakeStore(counts);
    await expect(
      enforceCap(store, ["o1"], "dishes", async () => void (counts.o1 = 20))
    ).resolves.toBeUndefined();
    await expect(
      enforceCap(store, ["o1"], "dishes", async () => void (counts.o1 = 21))
    ).rejects.toMatchObject({ code: "LIMIT_REACHED", limit: 20, upgradeTo: "Ordering" });
  });

  it("rejects a bulk save that jumps over the cap in one step", async () => {
    const counts = { o1: 5 };
    const { store } = fakeStore(counts);
    await expect(
      enforceCap(store, ["o1"], "dishes", async () => void (counts.o1 = 40))
    ).rejects.toBeInstanceOf(LimitReachedError);
  });

  it("never blocks an outlet that is already over its cap from shrinking or editing", async () => {
    const counts = { o1: 50 };
    const { store } = fakeStore(counts);
    await expect(
      enforceCap(store, ["o1"], "dishes", async () => void (counts.o1 = 40))
    ).resolves.toBeUndefined();
    await expect(
      enforceCap(store, ["o1"], "dishes", async () => undefined)
    ).resolves.toBeUndefined();
  });

  it("blocks any growth for an outlet that is already over its cap", async () => {
    const counts = { o1: 50 };
    const { store } = fakeStore(counts);
    await expect(
      enforceCap(store, ["o1"], "dishes", async () => void (counts.o1 = 51))
    ).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });

  it("enforces QR codes with the 2-code Free cap", async () => {
    const counts = { o1: 1 };
    const { store } = fakeStore(counts);
    await enforceCap(store, ["o1"], "qrCodes", async () => void (counts.o1 = 2));
    await expect(
      enforceCap(store, ["o1"], "qrCodes", async () => void (counts.o1 = 3))
    ).rejects.toMatchObject({ resource: "QR codes", limit: 2 });
  });

  it("uses the paid plan's cap and treats Kitchen Pro as implying Ordering", async () => {
    const counts = { o1: 150 };
    const ordering = fakeStore(counts, { ...FREE, ordering: true });
    await enforceCap(ordering.store, ["o1"], "dishes", async () => void (counts.o1 = 200));
    await expect(
      enforceCap(ordering.store, ["o1"], "dishes", async () => void (counts.o1 = 201))
    ).rejects.toMatchObject({ limit: 200, upgradeTo: "Kitchen Pro" });
    const pro = fakeStore(counts, { ordering: false, kitchen: true, community: false });
    await enforceCap(pro.store, ["o1"], "dishes", async () => void (counts.o1 = 2000));
  });

  it("does not cap Community Edition", async () => {
    const counts = { o1: 10 };
    const { store } = fakeStore(counts, { ...FREE, community: true });
    await enforceCap(store, ["o1"], "dishes", async () => void (counts.o1 = 100000));
  });

  it("checks every outlet an assignment touches and locks them in a stable order", async () => {
    const counts = { b: 5, a: 20 };
    const { store, calls } = fakeStore(counts);
    await expect(
      enforceCap(store, ["b", "a", "b"], "dishes", async () => void (counts.a = 25))
    ).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    expect(calls).toEqual(["lock:a,b"]);
  });

  it("leaves unknown or invisible outlets to the underlying command", async () => {
    const { store } = fakeStore({}, null);
    await expect(enforceCap(store, ["ghost"], "dishes", async () => "ok")).resolves.toBe("ok");
  });

  it("propagates the guarded work's own errors untouched", async () => {
    const { store } = fakeStore({ o1: 1 });
    await expect(
      enforceCap(store, ["o1"], "dishes", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
  });
});
