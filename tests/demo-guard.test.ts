import { describe, expect, it } from "vitest";
import { demoAuthPathAllowed, demoRequestAllowed, isDemoActor } from "../src/modules/demo/guard";
import { DEMO_IDS } from "../src/modules/demo/ids";

const org = DEMO_IDS.organizationId;
const outlet = DEMO_IDS.outletId;
const scoped = (rest: string) => `/api/organizations/${org}/outlets/${outlet}/${rest}`;

describe("public demo request guard (allowlist)", () => {
  it("only recognises the fixed demo user, and only while the kill switch is on", () => {
    expect(isDemoActor(DEMO_IDS.userId, true)).toBe(true);
    expect(isDemoActor(DEMO_IDS.userId, false)).toBe(false);
    expect(isDemoActor("some-real-user", true)).toBe(false);
    expect(isDemoActor("", true)).toBe(false);
  });
  it("always allows reads", () => {
    for (const m of ["GET", "HEAD", "OPTIONS"])
      expect(demoRequestAllowed(m, "/api/anything")).toBe(true);
  });
  it("allows resettable showcase mutations on the demo outlet", () => {
    expect(demoRequestAllowed("PATCH", "/api/catalog/menu-demo-outlet")).toBe(true);
    expect(demoRequestAllowed("PUT", "/api/catalog/menu-demo-outlet/translations")).toBe(true);
    expect(demoRequestAllowed("POST", "/api/assistant/conversations")).toBe(true);
    expect(demoRequestAllowed("POST", "/api/assistant/conversations/c1/turns")).toBe(true);
    expect(demoRequestAllowed("POST", scoped("orders/o1/transition"))).toBe(true);
    expect(demoRequestAllowed("POST", scoped("kitchen/work"))).toBe(true);
    expect(demoRequestAllowed("POST", scoped("service-requests"))).toBe(true);
    expect(demoRequestAllowed("POST", scoped("menu/quick-availability"))).toBe(true);
  });
  it("denies account, billing, team, upload, QR, POS, profile, AI-autofill and import mutations", () => {
    const denied: Array<[string, string]> = [
      ["POST", `/api/organizations/${org}/billing/checkout`],
      ["POST", `/api/organizations/${org}/billing/s1/cancel`],
      ["POST", `/api/organizations/${org}/invitations`],
      ["DELETE", `/api/organizations/${org}/invitations`],
      ["PATCH", `/api/organizations/${org}`],
      ["POST", "/api/organizations"],
      ["POST", "/api/invitations/token"],
      ["POST", "/api/media"],
      ["PATCH", "/api/media/m1"],
      ["POST", "/api/qr"],
      ["POST", "/api/onboarding"],
      ["POST", "/api/security/step-up"],
      ["POST", "/api/security/devices"],
      ["PUT", "/api/account/dashboard-layout"],
      ["POST", "/api/catalog"],
      ["POST", "/api/catalog/dish-autofill"],
      ["POST", "/api/menu/items"],
      ["PATCH", "/api/menu/items/i1"],
      ["POST", "/api/menu-imports"],
      ["POST", "/api/menu-imports/i1/process"],
      ["POST", "/api/assistant/actions"],
      ["POST", "/api/assistant/actions/p1"],
      ["POST", scoped("kitchen/admin")],
      ["POST", scoped("orders/o1/payment")],
      ["POST", scoped("pos")],
      ["POST", scoped("pos/finance")],
      ["POST", scoped("pos/settings")],
      ["PATCH", scoped("profile")],
      ["POST", "/api/admin/logs/export"],
    ];
    for (const [method, path] of denied)
      expect(demoRequestAllowed(method, path), `${method} ${path}`).toBe(false);
  });
  it("pins outlet-scoped permissions to the demo organization and outlet", () => {
    expect(
      demoRequestAllowed(
        "POST",
        "/api/organizations/org-real/outlets/real-outlet/orders/o1/transition"
      )
    ).toBe(false);
    expect(
      demoRequestAllowed("POST", `/api/organizations/${org}/outlets/other/orders/o1/transition`)
    ).toBe(false);
    expect(demoRequestAllowed("POST", scoped("orders/o1/transition/../payment"))).toBe(false);
  });
  it("does not allow method or path-prefix tricks", () => {
    expect(demoRequestAllowed("DELETE", "/api/catalog/menu-demo-outlet")).toBe(false);
    expect(demoRequestAllowed("patch", "/api/catalog/menu-demo-outlet")).toBe(true);
    expect(demoRequestAllowed("PATCH", "/api/catalog/menu-demo-outlet/extra")).toBe(false);
    expect(demoRequestAllowed("POST", "/api/context/x")).toBe(false);
  });
  it("limits Better Auth for demo sessions to sign-in/out", () => {
    for (const ok of ["/api/auth/sign-out", "/api/auth/sign-in/email", "/api/auth/sign-up/email"])
      expect(demoAuthPathAllowed(ok), ok).toBe(true);
    for (const bad of [
      "/api/auth/change-password",
      "/api/auth/change-email",
      "/api/auth/delete-user",
      "/api/auth/update-user",
      "/api/auth/two-factor/enable",
      "/api/auth/revoke-sessions",
      "/api/auth/set-password",
      "/api/auth/request-password-reset",
    ])
      expect(demoAuthPathAllowed(bad), bad).toBe(false);
  });
});
