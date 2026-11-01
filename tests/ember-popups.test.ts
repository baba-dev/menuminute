import { describe, expect, it } from "vitest";
import {
  POPUP_KINDS,
  POPUP_META,
  POPUP_VISIBLE_MAX,
  parsePopupPreference,
  popupsFromDiff,
  pushPopup,
  type EmberPopup,
} from "../src/modules/dashboard/ember-popups";
import type { ClientShellSnapshot } from "../src/modules/dashboard/notification-model";

function snap(
  over: Partial<{ pending: number; preparing: number; ready: number; done: number }> = {},
  paid: { id: string; orderNumber: number }[] | null = [],
  outletId = "o1",
  at = "2027-01-02T09:00:00.000Z"
): ClientShellSnapshot {
  const { pending = 0, preparing = 0, ready = 0, done = 0 } = over;
  return {
    outletId,
    checkedAt: at,
    pulse: {
      state: "ready",
      data: {
        pending,
        preparing,
        ready,
        active: pending + preparing + ready,
        completedToday: done,
      },
    },
    requests: { state: "ready", data: { open: 0, unacknowledged: 0, oldestAt: null } },
    till: { state: "restricted", data: null },
    payments: paid ? { state: "ready", data: { paid } } : { state: "restricted", data: null },
  };
}

describe("popupsFromDiff", () => {
  it("never fires on first load or for another outlet", () => {
    expect(popupsFromDiff(null, snap({ pending: 3 }))).toEqual([]);
    expect(popupsFromDiff(snap(), snap({ pending: 3 }, [], "o2"))).toEqual([]);
  });

  it("collapses a burst to one pop-up per kind", () => {
    const out = popupsFromDiff(
      snap({ pending: 1 }),
      snap({ pending: 4, preparing: 2, ready: 1 }, [], "o1", "2027-01-02T09:00:30.000Z")
    );
    expect(out.map((p) => p.kind).sort()).toEqual(["cooking", "delivery", "order"]);
    expect(out.find((p) => p.kind === "order")?.title).toBe("3 new orders");
  });

  it("is silent when counts fall", () => {
    expect(popupsFromDiff(snap({ pending: 4, ready: 2 }), snap({ pending: 1 }))).toEqual([]);
  });

  it("reports served orders only when nothing new is ready", () => {
    const out = popupsFromDiff(snap({ done: 1 }), snap({ done: 2 }));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "delivery", title: "1 order served or collected" });
  });

  it("announces newly paid orders by number, and ignores already-known ones", () => {
    const before = snap({}, [{ id: "a", orderNumber: 4 }]);
    const after = snap({}, [
      { id: "a", orderNumber: 4 },
      { id: "b", orderNumber: 7 },
    ]);
    const out = popupsFromDiff(before, after);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "payment", title: "Order #7 paid" });
  });

  it("makes no payment pop-up when the payments section is unreadable", () => {
    expect(popupsFromDiff(snap({}, null), snap({}, [{ id: "z", orderNumber: 1 }]))).toEqual([]);
  });

  it("gives every event a distinct id per poll", () => {
    const a = popupsFromDiff(snap(), snap({ pending: 1 }, [], "o1", "t1"));
    const b = popupsFromDiff(snap(), snap({ pending: 1 }, [], "o1", "t2"));
    expect(a[0]!.id).not.toBe(b[0]!.id);
  });
});

describe("pushPopup", () => {
  const p = (id: string): EmberPopup => ({ id, kind: "order", title: id });
  it("shows newest first, de-duplicates and caps the stack", () => {
    let list: EmberPopup[] = [];
    for (const id of ["a", "b", "c", "d"]) list = pushPopup(list, [p(id)]);
    expect(list.map((x) => x.id)).toEqual(["d", "c", "b"]);
    expect(list).toHaveLength(POPUP_VISIBLE_MAX);
    expect(pushPopup(list, [p("c")]).map((x) => x.id)).toEqual(["d", "c", "b"]);
  });
});

describe("colour code", () => {
  it("gives each kind a distinct colour, icon and label", () => {
    for (const key of ["colour", "icon", "label"] as const) {
      expect(new Set(POPUP_KINDS.map((k) => POPUP_META[k][key])).size).toBe(POPUP_KINDS.length);
    }
  });
});

describe("preference parsing", () => {
  it("defaults to everything on and tolerates garbage", () => {
    expect(parsePopupPreference(null).enabled).toBe(true);
    expect(parsePopupPreference("{nope").kinds.payment).toBe(true);
    const p = parsePopupPreference(JSON.stringify({ enabled: false, kinds: { cooking: false } }));
    expect(p.enabled).toBe(false);
    expect(p.kinds.cooking).toBe(false);
    expect(p.kinds.order).toBe(true);
  });
});
