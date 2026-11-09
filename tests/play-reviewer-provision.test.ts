import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PLAY_REVIEW,
  PLAY_REVIEW_TABLES,
  buildPlayReviewMenu,
  buildPlayReviewOrders,
} from "@/modules/play-review/fixture";

describe("The Droid Pie dedicated Google Play reviewer tenant", () => {
  it("is distinct from the shared/resetting public demo", () => {
    expect(PLAY_REVIEW.userName).toBe("Reviewer Account");
    expect(PLAY_REVIEW.outletName).toBe("The Droid Pie");
    expect(PLAY_REVIEW.userId).not.toBe("demo-owner");
    expect(PLAY_REVIEW.outletId).not.toBe("demo-outlet");
    expect(PLAY_REVIEW.organizationId).not.toBe("org-demo-outlet");
    expect(PLAY_REVIEW_TABLES).toHaveLength(10);
  });

  it("publishes a realistic multi-category menu with pizza and variants", () => {
    const menu = buildPlayReviewMenu();
    const dishes = menu.categories.flatMap((category) => category.items);
    expect(menu.name).toBe("The Droid Pie");
    expect(menu.currency).toBe("INR");
    expect(menu.categories.length).toBeGreaterThanOrEqual(5);
    expect(dishes.length).toBeGreaterThan(30);
    expect(dishes.some((dish) => /pizza/i.test(dish.name))).toBe(true);
    expect(dishes.some((dish) => dish.variants.length > 0)).toBe(true);
    expect(new Set(dishes.map((dish) => dish.id)).size).toBe(dishes.length);
  });

  it("seeds historical order history and a usable live kitchen board", () => {
    const orders = buildPlayReviewOrders(new Date("2026-11-10T10:00:00.000Z"));
    expect(orders.length).toBeGreaterThan(50);
    expect(orders.some((order) => order.live && order.status === "pending")).toBe(true);
    expect(orders.some((order) => order.live && order.status === "preparing")).toBe(true);
    expect(orders.some((order) => !order.live && order.status === "served")).toBe(true);
    expect(orders.every((order) => order.id.startsWith("play-review-"))).toBe(true);
    expect(new Set(orders.map((order) => order.id)).size).toBe(orders.length);
  });

  it("does not disclose secrets or run automatically from a browser or GitHub deploy", () => {
    const code = readFileSync(path.resolve("scripts/play-reviewer-provision.ts"), "utf8");
    const provisioner = readFileSync(path.resolve("src/modules/play-review/provision.ts"), "utf8");
    const deployment = readFileSync(path.resolve(".github/workflows/deploy-vps.yml"), "utf8");
    expect(code).toContain('process.env["ALLOW_PLAY_REVIEW_PROVISION"] !== "true"');
    expect(code).toContain('process.env["PLAY_REVIEWER_PASSWORD"]');
    expect(code).toContain('process.env["MIGRATION_DATABASE_URL"]');
    expect(code).not.toContain("console.log(password");
    expect(provisioner).toContain("pg_advisory_xact_lock");
    expect(provisioner).toContain("operator,reason,request_key");
    expect(provisioner).toContain("ROLLBACK");
    expect(provisioner).toContain("ON CONFLICT(id) DO NOTHING");
    expect(deployment).not.toContain("play-reviewer-provision.mjs");
  });
});
