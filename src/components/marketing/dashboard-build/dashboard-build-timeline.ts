/**
 * Scroll-assembled dashboard timeline (home-v2).
 *
 * Everything on the stage is a pure function of one number: scroll progress `p` in [0, 1].
 * Scrolling down raises `p` and the panels assemble; scrolling up lowers it and they come apart.
 * There is no separate "reverse" animation, so the two directions cannot disagree.
 *
 * Trusted marketing fixture: no API calls, no auth, no tenant data.
 */

/** Scroll distance of the pinned section, in viewport heights (stage height included). */
export const SCROLL_LENGTH_VH = { desktop: 500, mobile: 400 } as const;

/** From here to 1 the finished dashboard holds still so it can be read and clicked. */
export const HOLD_START = 0.9;

/** The camera starts gliding back to the top of the page here; it is home again at p = 1. */
export const CAMERA_RETURN_START = 0.92;

/** Hotspots only become interactive once the dashboard is essentially complete. */
export const INTERACTIVE_AT = 0.95;

export type PieceId =
  | "shell"
  | "sidebar"
  | "topbar"
  | "hero"
  | "glance"
  | "kpi-1"
  | "kpi-2"
  | "kpi-3"
  | "kpi-4"
  | "kpi-5"
  | "kpi-6"
  | "priorities"
  | "health"
  | "pulse"
  | "floor"
  | "requests";

export type Piece = {
  id: PieceId;
  /** Scroll range in which this piece travels from its exploded pose to its place. */
  start: number;
  end: number;
  /** Exploded pose in px / degrees. All zero means "already in place". */
  from: { x: number; y: number; z: number; rotateY: number };
};

const kpi = (index: number, x: number, y: number): Piece => ({
  id: `kpi-${index + 1}` as PieceId,
  start: 0.34 + index * 0.02,
  end: 0.42 + index * 0.02,
  from: { x, y, z: -160, rotateY: 0 },
});

/** Order is paint order. Ranges overlap on purpose so the build never looks like a slideshow. */
export const PIECES: readonly Piece[] = [
  { id: "shell", start: 0, end: 0.1, from: { x: 0, y: 0, z: -260, rotateY: 0 } },
  { id: "sidebar", start: 0.02, end: 0.12, from: { x: -90, y: 0, z: -120, rotateY: 14 } },
  { id: "topbar", start: 0.1, end: 0.2, from: { x: 0, y: -70, z: -80, rotateY: 0 } },
  { id: "hero", start: 0.18, end: 0.34, from: { x: 0, y: 70, z: 140, rotateY: 0 } },
  { id: "glance", start: 0.3, end: 0.4, from: { x: 0, y: 40, z: -60, rotateY: 0 } },
  kpi(0, -60, 90),
  kpi(1, -20, 100),
  kpi(2, 20, 90),
  kpi(3, 60, 100),
  kpi(4, 100, 90),
  kpi(5, 140, 100),
  { id: "priorities", start: 0.56, end: 0.7, from: { x: -80, y: 70, z: 100, rotateY: -10 } },
  { id: "pulse", start: 0.6, end: 0.72, from: { x: 80, y: 70, z: 100, rotateY: 10 } },
  { id: "health", start: 0.7, end: 0.84, from: { x: 0, y: 90, z: 120, rotateY: 0 } },
  { id: "floor", start: 0.78, end: 0.88, from: { x: 60, y: 90, z: 120, rotateY: 0 } },
  { id: "requests", start: 0.8, end: 0.9, from: { x: 80, y: 90, z: 120, rotateY: -8 } },
];

export type Chapter = { id: string; label: string; at: number };

/** Rail entries. `at` is the progress a click scrolls to, just after the chapter completes. */
export const CHAPTERS: readonly Chapter[] = [
  { id: "navigate", label: "Navigate", at: 0.22 },
  { id: "overview", label: "Overview", at: 0.52 },
  { id: "priorities", label: "Priorities", at: 0.7 },
  { id: "health", label: "Outlet health", at: 0.86 },
  { id: "live-service", label: "Live service", at: 0.9 },
];

/**
 * The new-order beat, told the way the product tells it: a new order lands on a quiet table, the
 * Service Dispatch "Awaiting acceptance" tile goes up by one, and the bell badge counts one more.
 * (The product has no order toast, so none is invented.) Each beat is a short scroll window; the
 * dispatch beat fires while the returning camera passes the Dispatch panel, the bell beat once the
 * camera is home.
 */
export const BEATS = {
  table: [0.86, 0.89],
  dispatch: [0.95, 0.965],
  bell: [0.985, 0.998],
} as const;
export type BeatId = keyof typeof BEATS;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Smootherstep: zero velocity at both ends, so panels settle instead of snapping. */
export const ease = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** 0 before `start`, 1 after `end`, eased in between. */
export function rangeProgress(p: number, start: number, end: number) {
  if (end <= start) return p >= end ? 1 : 0;
  return ease((clamp01(p) - start) / (end - start));
}

/**
 * Scroll progress of a pinned section. `top` is the section's `getBoundingClientRect().top`;
 * the stage is pinned while `-top` runs from 0 to `height - viewport`.
 */
export function scrollProgress(top: number, height: number, viewport: number) {
  const travel = height - viewport;
  if (travel <= 0) return 1;
  return clamp01(-top / travel);
}

/**
 * Frame-rate independent easing of the displayed value toward the scroll target, so a hard
 * flick or touch momentum still reads as fluid motion. Snaps when close enough to stop the loop.
 */
export function dampProgress(current: number, target: number, dtMs: number, halfLifeMs = 85) {
  const next = target + (current - target) * Math.pow(0.5, Math.max(0, dtMs) / halfLifeMs);
  return Math.abs(next - target) < 0.0004 ? target : next;
}

export function isInteractive(p: number) {
  return p >= INTERACTIVE_AT;
}

export function chapterAt(p: number): Chapter {
  const found = CHAPTERS.find((chapter) => p <= chapter.at);
  return found ?? CHAPTERS[CHAPTERS.length - 1]!;
}

export type PieceStyle = { transform: string; opacity: string };

const round = (value: number) => (Math.round(value * 100) / 100).toString();

/** Pure style for one piece at progress `p`. Only transform and opacity, so it stays on the GPU. */
export function pieceStyle(p: number, piece: Piece): PieceStyle {
  const t = rangeProgress(p, piece.start, piece.end);
  const rest = 1 - t;
  const { x, y, z, rotateY } = piece.from;
  return {
    transform:
      t === 1
        ? "none"
        : `translate3d(${round(x * rest)}px, ${round(y * rest)}px, ${round(z * rest)}px) rotateY(${round(rotateY * rest)}deg)`,
    // Opacity leads the motion so a panel is visible before it lands.
    opacity: round(clamp01(t * 1.8)),
  };
}

export type StageStyle = { transform: string };

/** The whole stage starts tilted and slightly small, then flattens as the build completes. */
export function stageStyle(p: number): StageStyle {
  const s = rangeProgress(p, 0, HOLD_START);
  return { transform: `rotateX(${round(16 * (1 - s))}deg) scale(${round(0.9 + 0.1 * s)})` };
}

/**
 * Items inside a piece (for example sidebar links) arrive one after another within the piece's
 * own range: a short slide from the left plus a fade. `index` and `count` place the item.
 */
export function staggerStyle(p: number, piece: Piece, index: number, count: number): PieceStyle {
  const length = piece.end - piece.start;
  const start = piece.start + length * (0.1 + (0.5 * index) / Math.max(1, count));
  const t = rangeProgress(p, start, start + length * 0.4);
  return {
    transform: t === 1 ? "none" : `translate3d(${round(-14 * (1 - t))}px, 0, 0)`,
    opacity: round(t),
  };
}

/**
 * The real dashboard is much taller than a screen, so the stage acts as a camera that pans down
 * the page as it builds, like scrolling the product. 0 = top of the page, 1 = bottom. It returns to
 * the top at the very end.
 */
export function cameraFraction(p: number) {
  const down = 0.45 * rangeProgress(p, 0.5, 0.66) + 0.55 * rangeProgress(p, 0.66, 0.88);
  // Once everything is built, glide back to the top so the held frame is the hero and KPIs.
  return down * (1 - rangeProgress(p, CAMERA_RETURN_START, 1));
}

/** `travel` is the scrollable height of the page inside the window, in unscaled px. */
export function cameraStyle(p: number, travel: number) {
  const offset = Math.max(0, travel) * cameraFraction(p);
  return { transform: offset === 0 ? "none" : `translate3d(0, ${round(-offset)}px, 0)` };
}

/** 0 before the beat, 1 after, eased in between. */
export function beatProgress(p: number, id: BeatId) {
  const [start, end] = BEATS[id];
  return rangeProgress(p, start, end);
}

/** A beat has "happened" once it is more than half way through. */
export const beatOn = (p: number, id: BeatId) => beatProgress(p, id) >= 0.5;

/** Count-up for a number that belongs to a piece; reverses when the user scrolls back. */
export function countValue(p: number, piece: Piece, target: number) {
  return Math.round(
    target * rangeProgress(p, piece.start + (piece.end - piece.start) * 0.3, piece.end)
  );
}

const PIECE_BY_ID = new Map<PieceId, Piece>(PIECES.map((piece) => [piece.id, piece]));
export const pieceById = (id: PieceId) => PIECE_BY_ID.get(id)!;

/**
 * Applies progress `p` to a stage element. Pieces are found by `[data-piece]`, counters by
 * `[data-count-to]` inside a piece. Safe to call every frame: it only writes changed values.
 */
export function renderDashboardBuild(stage: HTMLElement, p: number) {
  const value = clamp01(p);
  const frame = stageStyle(value);
  if (stage.style.transform !== frame.transform) stage.style.transform = frame.transform;

  const camera = stage.querySelector<HTMLElement>("[data-camera]");
  if (camera) {
    const view = cameraStyle(value, Number(stage.dataset["travel"]) || 0);
    if (camera.style.transform !== view.transform) camera.style.transform = view.transform;
  }

  renderBeats(stage, value);

  for (const element of stage.querySelectorAll<HTMLElement>("[data-piece]")) {
    const piece = PIECE_BY_ID.get(element.dataset["piece"] as PieceId);
    if (!piece) continue;
    const style = pieceStyle(value, piece);
    if (element.style.transform !== style.transform) element.style.transform = style.transform;
    if (element.style.opacity !== style.opacity) element.style.opacity = style.opacity;

    for (const item of element.querySelectorAll<HTMLElement>("[data-stagger]")) {
      const itemStyle = staggerStyle(
        value,
        piece,
        Number(item.dataset["stagger"]),
        Number(item.dataset["staggerCount"])
      );
      if (item.style.transform !== itemStyle.transform) item.style.transform = itemStyle.transform;
      if (item.style.opacity !== itemStyle.opacity) item.style.opacity = itemStyle.opacity;
    }

    for (const counter of element.querySelectorAll<HTMLElement>("[data-count-to]")) {
      // A counter can also carry a beat that adds one (the Dispatch "Awaiting acceptance" tile).
      const beat = counter.dataset["beatAdd"] as BeatId | undefined;
      const extra = beat && beatOn(value, beat) ? 1 : 0;
      const text = String(countValue(value, piece, Number(counter.dataset["countTo"])) + extra);
      if (counter.textContent !== text) counter.textContent = text;
    }
    for (const bar of element.querySelectorAll<HTMLProgressElement>("progress[data-progress-to]")) {
      const next = countValue(value, piece, Number(bar.dataset["progressTo"]));
      if (bar.value !== next) bar.value = next;
    }
  }
}

/**
 * `[data-beat="id"]` elements get `--beat` (0..1, for CSS pulses) and `data-on`. When they also have
 * `data-beat-from`/`data-beat-to` their text switches at the half-way point.
 */
function renderBeats(stage: HTMLElement, p: number) {
  for (const element of stage.querySelectorAll<HTMLElement>("[data-beat]")) {
    const id = element.dataset["beat"] as BeatId;
    if (!(id in BEATS)) continue;
    const progress = beatProgress(p, id);
    const on = progress >= 0.5;
    const css = round(progress);
    if (element.style.getPropertyValue("--beat") !== css) element.style.setProperty("--beat", css);
    const state = on ? "true" : "false";
    if (element.dataset["on"] !== state) element.dataset["on"] = state;
    const from = element.dataset["beatFrom"];
    const to = element.dataset["beatTo"];
    if (from !== undefined && to !== undefined) {
      const text = on ? to : from;
      if (element.textContent !== text) element.textContent = text;
    }
  }
}
