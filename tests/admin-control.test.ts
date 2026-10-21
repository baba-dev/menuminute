import { describe, it, expect, vi } from "vitest";
import { SUPERADMIN_EMAIL } from "../src/lib/admin-guard";
import { setOrganizationActive } from "../src/modules/admin/tenancy.service";
import {
  issueEntitlementGrant,
  revokeEntitlementGrant,
  listSubscriptionPlans,
} from "../src/modules/admin/payments.service";
import { setUserSuperAdmin, listUsers } from "../src/modules/admin/users.service";
import { ValidationError, ForbiddenError } from "../src/lib/errors";

describe("Admin Control Plane — Business Invariants & Security Guardrails", () => {
  it("enforces admin@bababuilds.com as the canonical root superadmin email", () => {
    expect(SUPERADMIN_EMAIL).toBe("admin@bababuilds.com");
  });

  it("prevents self-demotion from superadmin role", async () => {
    const actor = {
      id: "admin-actor-1",
      email: "admin@bababuilds.com",
      name: "Root Admin",
      twoFactorEnabled: true,
    };

    await expect(setUserSuperAdmin(actor, "admin-actor-1", false)).rejects.toThrow(ForbiddenError);
  });

  it("rejects organization suspension without a valid justification reason (min 5 chars)", async () => {
    const actor = {
      id: "admin-actor-1",
      email: "admin@bababuilds.com",
      name: "Root Admin",
      twoFactorEnabled: true,
    };

    await expect(setOrganizationActive(actor, "org-1", false, "bad")).rejects.toThrow(
      ValidationError
    );

    await expect(setOrganizationActive(actor, "org-1", false, "   ")).rejects.toThrow(
      ValidationError
    );
  });

  it("rejects entitlement grants with invalid or negative date windows", async () => {
    const actor = {
      id: "admin-actor-1",
      email: "admin@bababuilds.com",
      name: "Root Admin",
      twoFactorEnabled: true,
    };

    const startsAt = "2026-11-15T00:00:00.000Z";
    const endsAt = "2026-11-10T00:00:00.000Z"; // end before start

    await expect(
      issueEntitlementGrant(actor, {
        organizationId: "org-1",
        capability: "ordering.new",
        billingCurrency: "INR",
        startsAt,
        endsAt,
        reason: "Valid justification reason here",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects entitlement grants with insufficient justification reasons", async () => {
    const actor = {
      id: "admin-actor-1",
      email: "admin@bababuilds.com",
      name: "Root Admin",
      twoFactorEnabled: true,
    };

    await expect(
      issueEntitlementGrant(actor, {
        organizationId: "org-1",
        capability: "ordering.new",
        billingCurrency: "USD",
        startsAt: "2026-11-01T00:00:00.000Z",
        endsAt: "2026-11-30T00:00:00.000Z",
        reason: "no",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects entitlement revocation with insufficient justification reason", async () => {
    const actor = {
      id: "admin-actor-1",
      email: "admin@bababuilds.com",
      name: "Root Admin",
      twoFactorEnabled: true,
    };

    await expect(revokeEntitlementGrant(actor, "grant-1", "rev")).rejects.toThrow(ValidationError);
  });
});
