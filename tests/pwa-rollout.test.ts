import { describe, expect, it } from "vitest";
import { pwaOperationalAllowed, pwaPushAllowed } from "../src/lib/pwa/rollout";

describe("PWA rollout predicates", () => {
  it("keeps exact allowlists fail-closed and honours explicit all-outlet mode", () => {
    const op = (all: boolean, ids: string[], on = true) =>
      pwaOperationalAllowed(
        {
          PWA_OPERATIONAL_ENABLED: on,
          PWA_OPERATIONAL_ALL_OUTLETS: all,
          PWA_OPERATIONAL_OUTLET_IDS: ids,
        },
        "o1"
      );
    expect(op(false, [])).toBe(false);
    expect(op(false, ["o1"])).toBe(true);
    expect(op(true, [])).toBe(true);
    expect(op(true, [], false)).toBe(false);
    const push = (all: boolean, ids: string[], on = true) =>
      pwaPushAllowed(
        { PWA_PUSH_ENABLED: on, PWA_PUSH_ALL_OUTLETS: all, PWA_PUSH_OUTLET_IDS: ids },
        "o1"
      );
    expect(push(false, ["o2"])).toBe(false);
    expect(push(true, [])).toBe(true);
    expect(push(true, [], false)).toBe(false);
    expect(
      pwaPushAllowed(
        { PWA_PUSH_ENABLED: true, PWA_PUSH_ALL_OUTLETS: true, PWA_PUSH_OUTLET_IDS: [] },
        ""
      )
    ).toBe(false);
  });
});
