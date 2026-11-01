// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  HOLD_START,
  PIECES,
  chapterAt,
  countValue,
  dampProgress,
  isInteractive,
  pieceById,
  pieceStyle,
  rangeProgress,
  renderDashboardBuild,
  scrollProgress,
} from "@/components/marketing/dashboard-build/dashboard-build-timeline";

const stage = () => {
  const root = document.createElement("div");
  for (const piece of PIECES) {
    const el = document.createElement("div");
    el.dataset["piece"] = piece.id;
    if (piece.id === "kpi-3") el.innerHTML = '<span data-count-to="236">0</span>';
    root.append(el);
  }
  return root;
};
const snapshot = (root: HTMLElement) =>
  [
    root.style.transform,
    ...[...root.children].map((c) => (c as HTMLElement).style.cssText + c.textContent),
  ].join("|");

describe("dashboard build timeline", () => {
  it("has valid, ordered piece ranges that all finish before the hold", () => {
    for (const piece of PIECES) {
      expect(piece.start).toBeGreaterThanOrEqual(0);
      expect(piece.end).toBeGreaterThan(piece.start);
      expect(piece.end).toBeLessThanOrEqual(HOLD_START + 1e-9);
    }
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length);
  });

  it("is fully exploded at 0 and fully assembled from the hold onward", () => {
    for (const piece of PIECES) {
      expect(pieceStyle(0, piece).opacity).toBe("0");
      expect(pieceStyle(HOLD_START, piece)).toEqual({ transform: "none", opacity: "1" });
      expect(pieceStyle(1, piece)).toEqual({ transform: "none", opacity: "1" });
    }
  });

  it("eases monotonically with zero overshoot", () => {
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const value = rangeProgress(i / 100, 0.2, 0.6);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(1);
      previous = value;
    }
  });

  it("renders identically whichever direction the user arrived from", () => {
    const down = stage();
    const up = stage();
    for (let i = 0; i <= 50; i++) renderDashboardBuild(down, i / 100);
    for (let i = 100; i >= 50; i--) renderDashboardBuild(up, i / 100);
    expect(snapshot(down)).toBe(snapshot(up));
  });

  it("counts up and back down with the scroll", () => {
    const kpi = pieceById("kpi-3");
    expect(countValue(0, kpi, 236)).toBe(0);
    expect(countValue(1, kpi, 236)).toBe(236);
    const mid = countValue((kpi.start + kpi.end) / 2 + 0.01, kpi, 236);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(236);
    const root = stage();
    renderDashboardBuild(root, 1);
    expect(root.querySelector("[data-count-to]")?.textContent).toBe("236");
    renderDashboardBuild(root, 0);
    expect(root.querySelector("[data-count-to]")?.textContent).toBe("0");
  });

  it("maps pinned-section geometry to progress", () => {
    expect(scrollProgress(0, 4000, 1000)).toBe(0);
    expect(scrollProgress(-1500, 4000, 1000)).toBe(0.5);
    expect(scrollProgress(-3000, 4000, 1000)).toBe(1);
    expect(scrollProgress(500, 4000, 1000)).toBe(0);
    expect(scrollProgress(-9000, 4000, 1000)).toBe(1);
    expect(scrollProgress(0, 800, 1000)).toBe(1);
  });

  it("damps toward the target without overshoot and eventually snaps", () => {
    let value = 0;
    for (let i = 0; i < 200; i++) {
      value = dampProgress(value, 1, 16);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(value).toBe(1);
    expect(dampProgress(1, 0, 16)).toBeLessThan(1);
  });

  it("only allows interaction near completion and tracks chapters", () => {
    expect(isInteractive(0.5)).toBe(false);
    expect(isInteractive(0.95)).toBe(true);
    expect(chapterAt(0).id).toBe(CHAPTERS[0]!.id);
    expect(chapterAt(1).id).toBe(CHAPTERS[CHAPTERS.length - 1]!.id);
  });
});
