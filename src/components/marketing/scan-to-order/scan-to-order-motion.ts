/** Pure helpers for the "Scan, tap, ordered" section. No DOM access, so they are unit-testable. */

export type Point = { x: number; y: number };
export type Box = { left: number; top: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Phone tilt for a pointer over a box: rotateX/rotateY in degrees, centred at 0, capped at `max`. */
export function tiltFor(point: Point, box: Box, max = 9): { rx: number; ry: number } {
  if (box.width <= 0 || box.height <= 0) return { rx: 0, ry: 0 };
  const nx = clamp((point.x - box.left) / box.width, 0, 1) * 2 - 1;
  const ny = clamp((point.y - box.top) / box.height, 0, 1) * 2 - 1;
  return { rx: round(-ny * max), ry: round(nx * max) };
}

/** Pointer position inside a box as CSS percentages for the spotlight radial gradient. */
export function spotlightVars(point: Point, box: Box): { mx: string; my: string } {
  if (box.width <= 0 || box.height <= 0) return { mx: "50%", my: "50%" };
  const mx = clamp(((point.x - box.left) / box.width) * 100, 0, 100);
  const my = clamp(((point.y - box.top) / box.height) * 100, 0, 100);
  return { mx: `${round(mx)}%`, my: `${round(my)}%` };
}

/** Inverse translation that makes an element appear to start at `previous` (FLIP "invert" step). */
export function flipDelta(previous: Box, next: Box): Point {
  return { x: round(previous.left - next.left), y: round(previous.top - next.top) };
}

/** Digit columns for a rolling number: each character is a digit column or a static glyph. */
export type RollColumn = { kind: "digit"; digit: number } | { kind: "glyph"; glyph: string };

export function rollColumns(text: string): RollColumn[] {
  return Array.from(text).map((char) =>
    char >= "0" && char <= "9"
      ? { kind: "digit", digit: Number(char) }
      : { kind: "glyph", glyph: char }
  );
}

export type CartLine = { dishId: string; quantity: number };

/** Add (or remove, with a negative delta) a quantity. Quantities are whole numbers from 0 to 20. */
export function changeCart(lines: readonly CartLine[], dishId: string, delta: number): CartLine[] {
  const existing = lines.find((line) => line.dishId === dishId);
  const quantity = clamp(Math.trunc((existing?.quantity ?? 0) + delta), 0, 20);
  const others = lines.filter((line) => line.dishId !== dishId);
  return quantity === 0 ? others : [...others, { dishId, quantity }];
}

export function cartTotals(
  lines: readonly CartLine[],
  priceMinorOf: (dishId: string) => number
): { count: number; totalMinor: number } {
  let count = 0;
  let totalMinor = 0;
  for (const line of lines) {
    count += line.quantity;
    totalMinor += line.quantity * priceMinorOf(line.dishId);
  }
  return { count, totalMinor };
}

function round(value: number) {
  return Math.round(value * 100) / 100 || 0;
}
