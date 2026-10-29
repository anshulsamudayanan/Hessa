import { colorDistance, rgbToLab, type Lab } from './teamColors';

/**
 * Colour tracking for the ball. The object detector is accurate but misses
 * motion-blurred balls in flight; a blurred ball keeps its colour, so between
 * detections we look for a blob of the ball's colour near where the ball
 * should be. The colour is learned automatically from confident detections.
 */

export interface Blob {
  x: number; // pixels in the scanned image
  y: number;
  r: number;
  count: number;
}

/**
 * Find the ball-coloured blob inside `gate` (pixel rect) of an RGBA image.
 * Takes the centroid of matching pixels, then refines it by dropping outliers,
 * so a stray matching pixel elsewhere in the gate doesn't drag it away.
 */
export function findColorBlob(
  data: Uint8ClampedArray,
  width: number,
  gate: { x0: number; y0: number; x1: number; y1: number },
  color: Lab,
  maxDist = 20,
  minCount = 5,
): Blob | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = gate.y0; y < gate.y1; y++) {
    for (let x = gate.x0; x < gate.x1; x++) {
      const i = (y * width + x) * 4;
      if (colorDistance(rgbToLab(data[i], data[i + 1], data[i + 2]), color) <= maxDist) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < minCount) return null;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const cx = mean(xs);
  const cy = mean(ys);
  const keepR = Math.max(3, Math.sqrt(xs.length / Math.PI) * 2.5);
  const kx: number[] = [];
  const ky: number[] = [];
  xs.forEach((x, i) => {
    if (Math.hypot(x - cx, ys[i] - cy) <= keepR) {
      kx.push(x);
      ky.push(ys[i]);
    }
  });
  if (kx.length < minCount) return null;
  return { x: mean(kx), y: mean(ky), r: Math.sqrt(kx.length / Math.PI), count: kx.length };
}

/** Median of Lab samples per channel: robust to an occasional bad sample. */
export function medianLab(samples: Lab[]): Lab | null {
  if (!samples.length) return null;
  const med = (k: keyof Lab) => {
    const v = samples.map((s) => s[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  return { l: med('l'), a: med('a'), b: med('b') };
}

const scratch = typeof document !== 'undefined' ? document.createElement('canvas') : null;

/** Average colour of the centre of a box (pixels) in any drawable source. */
export function averageColor(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): { lab: Lab; css: string } | null {
  if (!scratch || sw < 4 || sh < 4) return null;
  scratch.width = 6;
  scratch.height = 6;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // Inner half of the box: avoids grass/background around the ball.
  ctx.drawImage(src, sx + sw * 0.25, sy + sh * 0.25, sw * 0.5, sh * 0.5, 0, 0, 6, 6);
  const d = ctx.getImageData(0, 0, 6, 6).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  [r, g, b] = [r / n, g / n, b / n];
  return { lab: rgbToLab(r, g, b), css: `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})` };
}

/** A ball colour that is too grey/dark/bright to track reliably (white balls on lines, black balls in shadow). */
export const isTrackableColor = (c: Lab) => Math.hypot(c.a, c.b) >= 15 && c.l > 15 && c.l < 95;
