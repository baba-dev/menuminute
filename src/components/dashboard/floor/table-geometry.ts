import type { TableShape } from "@/modules/hospitality/floor-contracts";

/** Pure layout maths for the table illustration, so chair placement is unit-testable. */
export type ChairSlot = {
  x: number;
  y: number;
  /** Degrees. 0 draws the chair above the table with its back facing away from it. */
  rotation: number;
};
export type TableGeometry = {
  width: number;
  height: number;
  top:
    | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
    | {
        kind: "rect";
        x: number;
        y: number;
        w: number;
        h: number;
        r: number;
      };
  /** A bench back drawn behind the seats of a booth. */
  bench: { x: number; y: number; w: number; h: number } | null;
  slots: ChairSlot[];
};

const PITCH = 46; // space one chair takes along a table edge
const OFFSET = 26; // centre of a chair from the table edge
const MARGIN = 44; // room around the table for the chairs

function side(
  count: number,
  length: number,
  at: (t: number) => { x: number; y: number },
  rotation: number
) {
  return Array.from({ length: count }, (_, i) => ({
    ...at(((i + 0.5) / count) * length),
    rotation,
  }));
}

export function layoutTable(shape: TableShape, chairCount: number): TableGeometry {
  const n = Math.max(0, Math.min(30, Math.floor(chairCount)));

  if (shape === "round") {
    const r = Math.max(60, Math.ceil((n * PITCH) / (2 * Math.PI)) - OFFSET + 18);
    const ring = r + OFFSET;
    const size = 2 * (ring + MARGIN - 16);
    const c = size / 2;
    return {
      width: size,
      height: size,
      top: { kind: "ellipse", cx: c, cy: c, rx: r, ry: r },
      bench: null,
      slots: Array.from({ length: n }, (_, i) => {
        const theta = -90 + (i * 360) / n;
        const rad = (theta * Math.PI) / 180;
        return { x: c + ring * Math.cos(rad), y: c + ring * Math.sin(rad), rotation: theta + 90 };
      }),
    };
  }

  // Straight-edged tables: decide how many chairs sit on each side.
  const sides = { top: 0, right: 0, bottom: 0, left: 0 };
  if (shape === "rectangle") {
    sides.top = Math.ceil(n / 2);
    sides.bottom = Math.floor(n / 2);
  } else if (shape === "booth") {
    sides.top = n;
  } else {
    const order = ["top", "bottom", "right", "left"] as const;
    for (let i = 0; i < n; i++) sides[order[i % 4]!]++;
  }

  const along = Math.max(sides.top, sides.bottom);
  const across = Math.max(sides.left, sides.right);
  let w = Math.max(shape === "square" ? 120 : 170, along * PITCH + 20);
  let h = shape === "square" ? Math.max(120, across * PITCH + 20) : shape === "booth" ? 70 : 96;
  if (shape === "square") {
    w = h = Math.max(w, h);
  }
  const x = MARGIN + OFFSET - 10;
  const y = MARGIN + OFFSET - 10;
  const slots: ChairSlot[] = [
    ...side(sides.top, w, (t) => ({ x: x + t, y: y - OFFSET + 8 }), 0),
    ...side(sides.bottom, w, (t) => ({ x: x + t, y: y + h + OFFSET - 8 }), 180),
    ...side(sides.right, h, (t) => ({ x: x + w + OFFSET - 8, y: y + t }), 90),
    ...side(sides.left, h, (t) => ({ x: x - OFFSET + 8, y: y + t }), 270),
  ];
  return {
    width: w + 2 * (MARGIN + OFFSET - 10),
    height: h + 2 * (MARGIN + OFFSET - 10),
    top: { kind: "rect", x, y, w, h, r: shape === "booth" ? 10 : 16 },
    bench: shape === "booth" ? { x: x - 6, y: y + h - 6, w: w + 12, h: 18 } : null,
    slots,
  };
}
