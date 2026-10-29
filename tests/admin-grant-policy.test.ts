import { describe, expect, it } from "vitest";
import {
  grantEndForPreset,
  grantOverlaps,
  grantPresetDetails,
  grantStatus,
} from "../src/modules/admin/grant-policy";

describe("grant operator rules", () => {
  const start = new Date("2026-10-25T10:00:00.000Z");
  it("calculates all preset windows deterministically", () => {
    expect(grantEndForPreset("trial_7", start)?.toISOString()).toBe("2026-11-01T10:00:00.000Z");
    expect(grantEndForPreset("trial_30", start)?.toISOString()).toBe("2026-11-24T10:00:00.000Z");
    expect(grantEndForPreset("first_user", start)?.toISOString()).toBe("2027-01-23T10:00:00.000Z");
    expect(grantEndForPreset("paid", start)?.toISOString()).toBe("2026-11-24T10:00:00.000Z");
    expect(grantEndForPreset("custom", start)).toBeNull();
    expect(grantEndForPreset("permanent", start)?.toISOString()).toBe("9999-12-31T23:59:59.000Z");
    expect(grantPresetDetails.permanent.description).toContain("revoke");
    expect(grantPresetDetails.paid.description).toContain("Verify payment");
  });
  it("differentiates revoked, expired, scheduled, expiring, and active", () => {
    const now = new Date("2026-10-25T12:00:00.000Z");
    expect(
      grantStatus({ startsAt: "2026-10-01", endsAt: "2026-11-20", revokedAt: null }, now)
    ).toBe("active");
    expect(
      grantStatus({ startsAt: "2026-10-01", endsAt: "2026-10-29", revokedAt: null }, now)
    ).toBe("expiring");
    expect(
      grantStatus({ startsAt: "2026-10-26", endsAt: "2026-11-29", revokedAt: null }, now)
    ).toBe("scheduled");
    expect(
      grantStatus({ startsAt: "2026-10-01", endsAt: "2026-10-24", revokedAt: null }, now)
    ).toBe("expired");
    expect(
      grantStatus({ startsAt: "2026-10-01", endsAt: "2026-11-29", revokedAt: "2026-10-25" }, now)
    ).toBe("revoked");
  });
  it("allows precisely adjacent renewal windows but denies overlap", () => {
    const first = { startsAt: "2026-10-01", endsAt: "2026-11-01", revokedAt: null };
    expect(grantOverlaps({ startsAt: "2026-11-01", endsAt: "2026-12-01" }, first)).toBe(false);
    expect(grantOverlaps({ startsAt: "2026-10-31", endsAt: "2026-12-01" }, first)).toBe(true);
    expect(
      grantOverlaps(
        { startsAt: "2026-10-31", endsAt: "2026-12-01" },
        { ...first, revokedAt: "2026-10-02" }
      )
    ).toBe(false);
  });
});
