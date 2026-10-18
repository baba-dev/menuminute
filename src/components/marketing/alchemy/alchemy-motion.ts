/** A deterministic clock for the original Menu Alchemy illustration. No API requests or user data. */
export const ALCHEMY_DURATION_MS = 9000;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};
const ease = (value: number) => 1 - Math.pow(1 - clamp(value), 3);
const segment = (time: number, start: number, end: number) => clamp((time - start) / (end - start));

export function alchemyStage(timeMs: number) {
  const time = Math.max(0, Math.min(ALCHEMY_DURATION_MS, timeMs)) / 1000;
  return time < 1.25 ? 0 : time < 4.2 ? 1 : time < 7.45 ? 2 : 3;
}

export function renderAlchemy(svg: SVGSVGElement, timeMs: number, moving = false) {
  const t = Math.max(0, Math.min(ALCHEMY_DURATION_MS, timeMs));
  const seconds = t / 1000;
  const get = (id: string) => svg.querySelector<SVGElement>(`[id="${id}"]`);
  const attr = (id: string, name: string, value: string | number) =>
    get(id)?.setAttribute(name, String(value));
  const opacity = (id: string, value: number) => attr(id, "opacity", clamp(value).toFixed(4));
  const move = (id: string, x: number, y: number) =>
    attr(id, "transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
  const intro = ease(segment(seconds, 0, 1.2));
  const bob = moving && seconds > 1.2 ? Math.sin(seconds * 1.8) * 2 : 0;
  attr(
    "menuGroup",
    "transform",
    `translate(123 ${(106 + 30 * (1 - intro) + bob).toFixed(2)}) rotate(${-4 - 2 * (1 - intro)} 169 255)`
  );
  opacity("menuGroup", 0.05 + 0.95 * intro);
  opacity("camera", smooth(segment(seconds, 1, 1.45)) * (1 - smooth(segment(seconds, 4, 4.42))));
  const scan = smooth(segment(seconds, 1.22, 4.08));
  opacity(
    "scanner",
    smooth(segment(seconds, 1.18, 1.43)) * (1 - smooth(segment(seconds, 4.04, 4.32)))
  );
  const y = 169 + 275 * scan;
  attr("scanGlow", "y", y - 26);
  attr("scanWash", "y", y - 12);
  attr("scanLine", "y1", y);
  attr("scanLine", "y2", y);
  opacity(
    "lens",
    smooth(segment(seconds, 2.05, 2.45)) * (1 - smooth(segment(seconds, 5.2, 5.85))) * 0.83
  );
  attr("lensArc", "transform", `rotate(${(-99 + seconds * 25).toFixed(2)} 690 373)`);
  opacity("microBits", smooth(segment(seconds, 2, 3)) * (1 - smooth(segment(seconds, 5.6, 6.8))));
  for (let i = 0; i < 3; i++) {
    const appear = 2.48 + i * 0.55;
    const leave = 4.4 + i * 0.3;
    opacity(
      `chip-${i}`,
      smooth(segment(seconds, appear, appear + 0.48)) *
        (1 - smooth(segment(seconds, leave, leave + 0.45)))
    );
    const chipY = [214, 330, 446][i]! + (1 - ease(segment(seconds, appear, appear + 0.55))) * 17;
    move(`chip-${i}`, 547, chipY);
  }
  attr("routeDraw", "stroke-dashoffset", 470 * (1 - ease(segment(seconds, 3.78, 5.88))));
  for (let i = 0; i < 3; i++) {
    const start = 4.24 + i * 0.38;
    const progress = segment(seconds, start, start + 1.05);
    const x = 783 + 140 * progress;
    const flightY =
      [248, 364, 480][i]! +
      Math.sin(Math.PI * progress) * (-28 - 6 * i) +
      ([194, 288, 382][i]! - [248, 364, 480][i]!) * progress;
    move(`flight-${i}`, x, flightY);
    opacity(
      `flight-${i}`,
      smooth(segment(progress, 0, 0.16)) * (1 - smooth(segment(progress, 0.77, 1)))
    );
  }
  const board = smooth(segment(seconds, 3.78, 4.42));
  opacity("dashboard", board);
  attr("dashboard", "transform", `translate(${(894 + 24 * (1 - board)).toFixed(2)} 115)`);
  opacity("skel", board * (1 - smooth(segment(seconds, 5.18, 6.85))));
  for (let i = 0; i < 3; i++) {
    const row = smooth(segment(seconds, 5.12 + i * 0.43, 5.56 + i * 0.43));
    opacity(`row-${i}`, row);
    const food = smooth(segment(seconds, 5.82 + i * 0.62, 6.27 + i * 0.62));
    opacity(`food-${i}`, food);
    attr(
      `food-${i}`,
      "transform",
      `translate(37 ${185 + i * 93.5 + 8 * (1 - food)}) scale(${(0.86 + 0.14 * food).toFixed(3)})`
    );
  }
  opacity("extractionSummary", smooth(segment(seconds, 7.45, 8.2)));
  opacity("review", smooth(segment(seconds, 7.5, 8.3)));
  opacity("done", smooth(segment(seconds, 8.25, 8.9)));
}
