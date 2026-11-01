// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  CHAPTERS,
  cameraFraction,
  cameraStyle,
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
  staggerStyle,
  scrollProgress,
} from "@/components/marketing/dashboard-build/dashboard-build-timeline";

const stage = () => {
  const root = document.createElement("div");
  for (const piece of PIECES) {
    const el = document.createElement("div");
    el.dataset["piece"] = piece.id;
    if (piece.id === "kpi-3") el.innerHTML = '<span data-count-to="236">0</span>';
    if (piece.id === "health")
      el.innerHTML =
        '<span data-count-to="4">0</span><progress max="4" value="0" data-progress-to="4"></progress><span data-count-to="100">0</span>';
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

  it("staggers inner items in order, finishing inside the piece's range", () => {
    const sidebar = pieceById("sidebar");
    const mid = (sidebar.start + sidebar.end) / 2;
    const first = Number(staggerStyle(mid, sidebar, 0, 10).opacity);
    const last = Number(staggerStyle(mid, sidebar, 9, 10).opacity);
    expect(first).toBeGreaterThan(last);
    expect(staggerStyle(0, sidebar, 5, 10).opacity).toBe("0");
    for (let i = 0; i < 10; i++) {
      expect(staggerStyle(sidebar.end, sidebar, i, 10)).toEqual({
        transform: "none",
        opacity: "1",
      });
    }
  });

  it("pans the camera down the tall page and back up", () => {
    expect(cameraFraction(0)).toBe(0);
    expect(cameraFraction(0.3)).toBe(0);
    expect(cameraFraction(HOLD_START)).toBe(1);
    expect(cameraFraction(1)).toBe(1);
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const value = cameraFraction(i / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(cameraStyle(0, 800)).toEqual({ transform: "none" });
    expect(cameraStyle(1, 800)).toEqual({ transform: "translate3d(0, -800px, 0)" });
    expect(cameraStyle(1, 0)).toEqual({ transform: "none" });
    expect(cameraStyle(0.58, -50)).toEqual({ transform: "none" });
  });

  it("drives every counter and progress bar in a piece, and reverses them", () => {
    const root = stage();
    root.dataset["travel"] = "700";
    renderDashboardBuild(root, 1);
    const health = root.querySelector('[data-piece="health"]')!;
    expect([...health.querySelectorAll("[data-count-to]")].map((e) => e.textContent)).toEqual([
      "4",
      "100",
    ]);
    expect(health.querySelector("progress")?.value).toBe(4);
    renderDashboardBuild(root, 0);
    expect(health.querySelector("progress")?.value).toBe(0);
    expect(health.querySelector("[data-count-to]")?.textContent).toBe("0");
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
