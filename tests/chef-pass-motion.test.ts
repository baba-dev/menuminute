// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  CHEF_PASS_DURATION_MS,
  chefPassStage,
  renderChefPass,
} from "@/components/marketing/chef-pass/chef-pass-motion";
import { DARK_DESKTOP } from "@/components/marketing/chef-pass/chef-pass-art";

const scene = () =>
  new DOMParser().parseFromString(DARK_DESKTOP, "image/svg+xml")
    .documentElement as unknown as SVGSVGElement;
const label = (svg: SVGSVGElement, name: string) =>
  svg.querySelector(`[id="cpd-${name}"]`)?.textContent;

describe("The Chef's Pass fixture is operationally honest", () => {
  it("retains the approved 8.5-second narrative", () => {
    expect(CHEF_PASS_DURATION_MS).toBe(8500);
    expect([0, 1000, 3700, 7080, 8040, 8500].map(chefPassStage)).toEqual([0, 1, 2, 3, 4, 4]);
  });
  it("finishes Drinks first without releasing an incomplete order", () => {
    const svg = scene();
    renderChefPass(svg, 5800, "dark");
    expect(label(svg, "drinks-ticket-label")).toBe("COMPLETE");
    expect(label(svg, "grill-ticket-label")).toBe("PREPARING");
    expect(label(svg, "tandoor-ticket-label")).toBe("PREPARING");
    expect(svg.querySelector('[id="cpd-expo-check-2"]')?.getAttribute("opacity")).toBe("1");
    expect(svg.querySelector('[id="cpd-expo-check-0"]')?.getAttribute("opacity")).toBe("0");
    expect(label(svg, "handoff-top")).toBe("NOT READY");
  });
  it("requires explicit illustrated expeditor confirmation after all stations complete", () => {
    const svg = scene();
    renderChefPass(svg, 7500, "dark");
    expect(label(svg, "handoff-top")).toBe("CONFIRM HANDOFF");
    expect(svg.querySelector('[id="cpd-expo-check-3"]')?.getAttribute("opacity")).toBe("0");
    renderChefPass(svg, 8500, "dark");
    expect(label(svg, "handoff-top")).toBe("RELEASED");
    expect(label(svg, "handoff-bottom")).toBe("BY EXPEDITOR");
    expect(svg.querySelector('[id="cpd-expo-check-3"]')?.getAttribute("opacity")).toBe("1");
  });
});
