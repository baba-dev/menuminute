// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDES } from "@/content/docs/guides";
import { getArticleBySlug } from "@/content/help";
import {
  IMPORT_CARDS,
  IMPORT_NOTE,
  SOURCE_LINES,
} from "@/components/marketing/pdf-to-menu/pdf-to-menu-fixture";
import {
  blockers,
  canConfirm,
  canPublish,
  confirmedCount,
  parsePrice,
  publish,
  seedRows,
  setPrice,
  statusOf,
  stepOf,
  toggleConfirm,
} from "@/components/marketing/pdf-to-menu/pdf-to-menu-logic";

const byId = (rows: ReturnType<typeof seedRows>, id: string) => rows.find((r) => r.id === id)!;

function confirmAll(rows: ReturnType<typeof seedRows>) {
  let next = setPrice(rows, "r4", "359");
  for (const row of next) next = toggleConfirm(next, row.id);
  return next;
}

describe("pdf-to-menu logic", () => {
  it("parses only whole-number prices", () => {
    expect(parsePrice("399")).toBe(399);
    expect(parsePrice(" 12 ")).toBe(12);
    for (const bad of ["", "abc", "-5", "3.5", "1e3", "123456", "4O9", "3▒9"]) {
      expect(parsePrice(bad), bad).toBeNull();
    }
  });

  it("seeds a draft with one unclear and one unreadable price, as the source shows", () => {
    const rows = seedRows();
    expect(rows).toHaveLength(SOURCE_LINES.length);
    expect(byId(rows, "r3").flag).toBe("needs_attention");
    expect(byId(rows, "r4").flag).toBe("unreadable");
    expect(byId(rows, "r4").price).toBeNull();
    expect(rows.every((row) => !row.confirmed)).toBe(true);
  });

  it("cannot confirm a dish whose price is unreadable until one is entered", () => {
    let rows = seedRows();
    expect(canConfirm(byId(rows, "r4"))).toBe(false);
    rows = toggleConfirm(rows, "r4");
    expect(byId(rows, "r4").confirmed).toBe(false);
    rows = setPrice(rows, "r4", "359");
    expect(canConfirm(byId(rows, "r4"))).toBe(true);
    rows = toggleConfirm(rows, "r4");
    expect(byId(rows, "r4").confirmed).toBe(true);
  });

  it("re-opens review when a confirmed price is edited, and clearing it blocks again", () => {
    let rows = toggleConfirm(seedRows(), "r3");
    expect(byId(rows, "r3").confirmed).toBe(true);
    rows = setPrice(rows, "r3", "419");
    expect(byId(rows, "r3").confirmed).toBe(false);
    expect(byId(rows, "r3").edited).toBe(true);
    rows = setPrice(rows, "r3", "");
    expect(byId(rows, "r3").price).toBeNull();
    expect(canConfirm(byId(rows, "r3"))).toBe(false);
  });

  it("never publishes until every dish is confirmed against its source", () => {
    let rows = seedRows();
    expect(canPublish(rows)).toBe(false);
    expect(publish("review", rows)).toBe("review");
    rows = confirmAll(rows);
    expect(confirmedCount(rows)).toBe(rows.length);
    expect(canPublish(rows)).toBe(true);
    expect(publish("review", rows)).toBe("published");
    // The scanner cannot publish from any other phase.
    expect(publish("scanning", rows)).toBe("scanning");
    expect(publish("idle", rows)).toBe("idle");
    expect(canPublish([])).toBe(false);
  });

  it("explains what still blocks publishing", () => {
    const rows = seedRows();
    expect(blockers(rows).join(" ")).toMatch(/Enter the price for Amritsari Fish/);
    expect(blockers(rows).join(" ")).toMatch(/Confirm 3 more dishes/);
    expect(blockers(confirmAll(rows))).toEqual([]);
  });

  it("labels every row status with a word", () => {
    const rows = seedRows();
    expect(statusOf(byId(rows, "r1")).label).toBe("To confirm");
    expect(statusOf(byId(rows, "r3")).label).toBe("Needs attention");
    expect(statusOf(byId(rows, "r4")).label).toBe("Price unreadable");
    expect(statusOf(byId(toggleConfirm(rows, "r1"), "r1")).label).toBe("Confirmed");
    expect(statusOf(byId(setPrice(rows, "r3", "409"), "r3")).label).toBe("To confirm");
  });

  it("maps phases to steps", () => {
    expect([stepOf("idle"), stepOf("scanning"), stepOf("review"), stepOf("published")]).toEqual([
      1, 1, 2, 3,
    ]);
  });

  it("does not mutate its input", () => {
    const rows = seedRows();
    const snapshot = JSON.stringify(rows);
    setPrice(rows, "r4", "1");
    toggleConfirm(rows, "r1");
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
});

describe("pdf-to-menu copy", () => {
  it("links every card to a real help, docs or public page", () => {
    for (const card of IMPORT_CARDS) {
      if (card.href.startsWith("/help/owner/")) {
        expect(getArticleBySlug(card.href.split("/").pop()!), card.href).toBeDefined();
      } else if (card.href.startsWith("/docs/")) {
        expect(
          GUIDES.some((guide) => guide.slug === card.href.split("/").pop()),
          card.href
        ).toBe(true);
      } else {
        const route = card.href.replace(/^\//, "");
        expect(existsSync(join(process.cwd(), "src/app", route, "page.tsx")), card.href).toBe(true);
      }
    }
  });

  it("is honest: scripted sample, enabled per outlet, no verified-dish or autonomous claims", () => {
    const text = `${IMPORT_NOTE} ${IMPORT_CARDS.map((c) => `${c.title} ${c.body}`).join(" ")}`;
    expect(IMPORT_NOTE).toMatch(/no file is uploaded or processed/i);
    expect(text).toMatch(/separately enabled and approved/i);
    expect(text).toMatch(/only you publish/i);
    expect(text).not.toMatch(/100%|perfect|instant(ly)? publish|auto-?publish|guarantee/i);
  });
});
