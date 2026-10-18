/** Trusted marketing-fixture timeline; no kitchen backend, order actions, or API calls. */
export const CHEF_PASS_DURATION_MS = 8500;

export type PassTheme = "dark" | "light";

const COLORS = {
  dark: {
    green: "#A0D7A3",
    greenbg: "#203B32",
    warning: "#FFC479",
    warnbg: "#493423",
    ember: "#FF792E",
    newbg: "#4B3829",
  },
  light: {
    green: "#146348",
    greenbg: "#D6EFE0",
    warning: "#844600",
    warnbg: "#FFE6BF",
    ember: "#E85C1B",
    newbg: "#F6DFC2",
  },
} as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const fade = (time: number, start: number, end: number) =>
  clamp((time - start) / (end - start));

/** The completion markers belong to the actual stations: Drinks, Grill, Tandoor. */
export function chefPassStage(timeMs: number) {
  const time = Math.max(0, Math.min(CHEF_PASS_DURATION_MS, timeMs)) / 1000;
  return time < 1 ? 0 : time < 3.7 ? 1 : time < 7.08 ? 2 : time < 8.04 ? 3 : 4;
}

export function renderChefPass(svg: SVGSVGElement, timeMs: number, theme: PassTheme) {
  const t = Math.max(0, Math.min(CHEF_PASS_DURATION_MS, timeMs)) / 1000;
  const prefix = theme === "dark" ? "cpd" : "cpl";
  const colors = COLORS[theme];
  const find = (id: string) => svg.querySelector<SVGElement>(`[id="${prefix}-${id}"]`);
  const set = (id: string, name: string, value: string | number) =>
    find(id)?.setAttribute(name, String(value));

  set("monitor", "opacity", 0.18 + 0.82 * fade(t, 0, 1));
  set("order-arrival", "opacity", fade(t, 0.85, 1.65));
  set("paths", "opacity", fade(t, 2.15, 3.65));

  for (const [id, at] of [
    ["station-grill", 2.15],
    ["station-tandoor", 2.55],
    ["station-drinks", 2.95],
  ] as const) {
    set(id, "opacity", 0.25 + 0.75 * fade(t, at, at + 0.62));
  }
  for (const [id, at] of [
    ["grill-ticket", 2.65],
    ["tandoor-ticket", 3],
    ["drinks-ticket", 3.35],
  ] as const) {
    set(id, "opacity", 0.08 + 0.92 * fade(t, at, at + 0.58));
  }
  for (const [id, start, end] of [
    ["grill-ticket", 3.5, 6.35],
    ["tandoor-ticket", 5.12, 7.08],
    ["drinks-ticket", 4.2, 5.64],
  ] as const) {
    const status = t < start ? "QUEUED" : t < end ? "PREPARING" : "COMPLETE";
    const progress = t < start ? 0 : t > end ? 1 : fade(t, start, end);
    const color =
      status === "COMPLETE"
        ? colors.green
        : status === "QUEUED"
          ? colors.warning
          : colors.ember;
    const background = status === "COMPLETE" ? colors.greenbg : colors.warnbg;
    const label = find(id + "-label");
    if (label) label.textContent = status;
    set(id + "-label", "fill", color);
    set(id + "-pill", "fill", background);
    set(id + "-progress", "fill", color);
    set(id + "-progress", "width", 80 * progress);
  }

  set("expo-card", "opacity", fade(t, 5.05, 5.67));
  const completed = Number(t >= 5.64) + Number(t >= 6.35) + Number(t >= 7.08);
  const released = t >= 8.04;
  set("expo-route", "stroke-dashoffset", 304 * (1 - (completed + Number(released)) / 4));
  const confirmations = [t >= 6.35, t >= 7.08, t >= 5.64, released];
  for (let i = 0; i < confirmations.length; i++) {
    const confirmed = confirmations[i];
    set("expo-dot-" + i, "fill", confirmed ? colors.greenbg : colors.warnbg);
    set("expo-dot-" + i, "stroke", confirmed ? colors.green : colors.warning);
    set("expo-check-" + i, "opacity", confirmed ? 1 : 0);
  }
  const top = find("handoff-top");
  const bottom = find("handoff-bottom");
  const note = find("expo-note");
  if (top) top.textContent = released ? "RELEASED" : completed === 3 ? "CONFIRM HANDOFF" : "NOT READY";
  if (bottom)
    bottom.textContent = released
      ? "BY EXPEDITOR"
      : completed === 3
        ? "AUTHORIZED ACTION"
        : "WAITING ON STATIONS";
  if (note)
    note.textContent = released
      ? "All required station work complete · manually confirmed by the authorized expeditor"
      : completed === 3
        ? "3 OF 3 REQUIRED STATIONS COMPLETE · authorized expeditor confirmation pending"
        : completed + " OF 3 REQUIRED STATIONS COMPLETE · final release unavailable";
  set("handoff-bg", "fill", released ? colors.greenbg : colors.newbg);
  set("handoff-bg", "transform", t >= 7.75 && t < 8.04 ? "translate(0 1.5)" : "translate(0 0)");
}
