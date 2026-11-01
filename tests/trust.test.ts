// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDES } from "@/content/docs/guides";
import { getArticleBySlug } from "@/content/help";
import { LEGAL_LINKS, TRUST_CARDS, TRUST_NOTE } from "@/components/marketing/trust/trust-fixture";
import {
  HISTORY,
  PEOPLE,
  PERMISSIONS,
  can,
  checkAccess,
  initialSubmitState,
  ordersCreated,
  serverTotal,
  submitOrder,
  tryDeleteOrder,
  type Person,
  type PermissionId,
} from "@/components/marketing/trust/trust-logic";

const person = (id: string) => PEOPLE.find((p) => p.id === id)!;
const allowedAt = (p: Person, outlet: "outlet-a" | "outlet-b") =>
  PERMISSIONS.filter((x) => can(p, outlet, x.id)).map((x) => x.id);

describe("trust: access rule mirrors app_private.can_outlet", () => {
  it("owner can do everything everywhere, including billing", () => {
    for (const outlet of ["outlet-a", "outlet-b"] as const) {
      expect(allowedAt(person("asha"), outlet)).toHaveLength(PERMISSIONS.length);
    }
  });

  it("manager can do everything at their outlet except billing, and nothing elsewhere", () => {
    const expected = PERMISSIONS.map((x) => x.id).filter((id) => id !== "billing.manage");
    expect(allowedAt(person("ben"), "outlet-a").sort()).toEqual([...expected].sort());
    expect(allowedAt(person("ben"), "outlet-b")).toEqual([]);
  });

  it("service accepts and completes but does not prepare, edit the menu or cancel", () => {
    expect(allowedAt(person("chen"), "outlet-a").sort()).toEqual(
      ["menu.read", "orders.accept", "orders.complete", "orders.read"].sort()
    );
  });

  it("kitchen prepares and reads orders but does not accept", () => {
    expect(allowedAt(person("dev"), "outlet-a").sort()).toEqual(
      ["menu.read", "orders.prepare", "orders.read"].sort()
    );
  });

  it("menu editor edits the menu but cannot see orders", () => {
    expect(allowedAt(person("eli"), "outlet-a").sort()).toEqual(["menu.read", "menu.write"]);
  });

  it("removed staff and people from other restaurants are refused everything", () => {
    for (const id of ["fran", "gus"]) {
      expect(allowedAt(person(id), "outlet-a")).toEqual([]);
    }
    expect(checkAccess(person("fran"), "outlet-a", "orders.accept").reason).toMatch(/removed/);
    expect(checkAccess(person("gus"), "outlet-a", "orders.accept").reason).toMatch(/not a member/);
  });

  it("billing is owner only, even for an admin", () => {
    const admin: Person = { ...person("ben"), orgRole: "admin", grants: {} };
    expect(can(admin, "outlet-a", "billing.manage")).toBe(false);
    expect(can(admin, "outlet-a", "orders.cancel")).toBe(true);
  });

  it("reports each check, skipping the grant check when membership fails", () => {
    const blocked = checkAccess(person("gus"), "outlet-a", "orders.read");
    expect(blocked.allowed).toBe(false);
    expect(blocked.steps.map((s) => s.result)).toEqual(["pass", "fail", "skipped"]);
    const allowed = checkAccess(person("chen"), "outlet-a", "orders.accept");
    expect(allowed.steps.map((s) => s.result)).toEqual(["pass", "pass", "pass"]);
    expect(checkAccess(person("chen"), "outlet-b", "orders.accept").reason).toMatch(/no access/);
    const every: PermissionId[] = PERMISSIONS.map((x) => x.id);
    expect(new Set(every).size).toBe(9);
  });
});

describe("trust: order submission mirrors submitGuestOrder", () => {
  const ok = (quantity: number) => ({ quantity, quotedTotalMinor: serverTotal(quantity) });

  it("creates an order when the quote matches the server's price", () => {
    const { state, outcome } = submitOrder(initialSubmitState(), "k1", ok(1));
    expect(outcome).toMatchObject({ kind: "created", status: 201, orderNo: 1042 });
    expect(ordersCreated(state)).toBe(1);
  });

  it("returns the same order for the same key and cart (idempotent)", () => {
    const first = submitOrder(initialSubmitState(), "k1", ok(1));
    const again = submitOrder(first.state, "k1", ok(1));
    expect(again.outcome).toMatchObject({ kind: "duplicate", status: 200, orderNo: 1042 });
    expect(ordersCreated(again.state)).toBe(1);
  });

  it("refuses the same key with a different cart", () => {
    const first = submitOrder(initialSubmitState(), "k1", ok(1));
    const changed = submitOrder(first.state, "k1", ok(2));
    expect(changed.outcome).toMatchObject({ kind: "key-conflict", status: 409 });
    expect(changed.outcome.message).toBe("Submission key reused with a different cart.");
    expect(ordersCreated(changed.state)).toBe(1);
  });

  it("refuses a tampered total and creates nothing", () => {
    const { state, outcome } = submitOrder(initialSubmitState(), "k1", {
      quantity: 1,
      quotedTotalMinor: 100,
    });
    expect(outcome).toMatchObject({ kind: "price-conflict", status: 409 });
    expect(outcome.message).toBe("Your cart price has changed. Please review the updated menu.");
    expect(ordersCreated(state)).toBe(0);
  });

  it("a new key makes a new order with the next number", () => {
    const first = submitOrder(initialSubmitState(), "k1", ok(1));
    const second = submitOrder(first.state, "k2", ok(1));
    expect(second.outcome).toMatchObject({ kind: "created", orderNo: 1043 });
    expect(ordersCreated(second.state)).toBe(2);
  });

  it("does not mutate the previous state", () => {
    const start = initialSubmitState();
    const snapshot = JSON.stringify(start);
    submitOrder(start, "k1", ok(1));
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});

describe("trust: history and copy", () => {
  it("refuses to delete an order that has history", () => {
    expect(tryDeleteOrder(HISTORY).deleted).toBe(false);
    expect(tryDeleteOrder(HISTORY).message).toMatch(/Refused/);
    expect(tryDeleteOrder([]).deleted).toBe(true);
    expect(new Set(HISTORY.map((e) => e.actor))).toEqual(new Set(["guest", "staff"]));
  });

  it("links every card and legal link to an existing page", () => {
    for (const { href } of [...TRUST_CARDS, ...LEGAL_LINKS]) {
      if (href.startsWith("/help/owner/")) {
        expect(getArticleBySlug(href.split("/").pop()!), href).toBeDefined();
      } else if (href.startsWith("/docs/")) {
        expect(
          GUIDES.some((g) => g.slug === href.split("/").pop()),
          href
        ).toBe(true);
      } else {
        const route = href.replace(/^\//, "");
        expect(existsSync(join(process.cwd(), "src/app", route, "page.tsx")), href).toBe(true);
      }
    }
  });

  it("claims no certification, uptime, encryption or compliance", () => {
    const text = TRUST_CARDS.map((card) => `${card.title} ${card.body}`).join(" ");
    expect(text).not.toMatch(
      /SOC ?2|ISO ?27001|GDPR|HIPAA|PCI|99\.9|uptime|encrypt|bank-grade|military|unhackable|100%/i
    );
    expect(TRUST_NOTE).toMatch(/no certifications, uptime figures or compliance/i);
  });
});
