/**
 * Coordinate helpers. Games reason in "view space": normalised 0..1 coordinates of
 * the picture as players see it on screen (mirrored for the front camera), so the
 * left player is always on the left of the screen.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Model output (image space, 0..1) → view space. */
export const toView = (p: Point, mirrored: boolean): Point => ({ x: mirrored ? 1 - p.x : p.x, y: p.y });

/** Where a video of size vw×vh lands inside a box when drawn with object-fit: contain. */
export function containRect(vw: number, vh: number, bw: number, bh: number): Rect {
  if (!vw || !vh) return { x: 0, y: 0, w: bw, h: bh };
  const s = Math.min(bw / vw, bh / vh);
  const w = vw * s;
  const h = vh * s;
  return { x: (bw - w) / 2, y: (bh - h) / 2, w, h };
}

export const rectContains = (r: Rect, p: Point) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
