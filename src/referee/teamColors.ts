import type { ObjectDetectorResult as DetectionResult } from '@mediapipe/tasks-vision';
import type { BallObs } from './ballTracker';
import type { Rect } from './viewport';

/**
 * Tells the two teams apart by shirt colour (no face recognition). Each team's
 * colour is captured during setup; during play the person nearest the ball at
 * release is sampled and matched. Ambiguous matches return null so the referee
 * asks instead of guessing.
 */

export interface Lab {
  l: number;
  a: number;
  b: number;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return { l: 116 * f(y) - 16, a: 500 * (f(x) - f(y)), b: 200 * (f(y) - f(z)) };
}

/** Distance that down-weights lightness, so shade/lighting changes matter less than hue. */
export const colorDistance = (p: Lab, q: Lab) => Math.hypot((p.l - q.l) * 0.5, p.a - q.a, p.b - q.b);

export function classifyColor(c: Lab, teams: [Lab, Lab], maxDist = 40, ratio = 0.7): 0 | 1 | null {
  const d0 = colorDistance(c, teams[0]);
  const d1 = colorDistance(c, teams[1]);
  const [best, other, team] = d0 <= d1 ? [d0, d1, 0 as const] : [d1, d0, 1 as const];
  if (best > maxDist || best > other * ratio) return null;
  return team;
}

export interface PersonSighting {
  box: Rect; // view space
  color: Lab;
  /** CSS colour for showing the sampled shirt. */
  css: string;
}

let scratch: HTMLCanvasElement | null = null;

/** Average colour of the torso (middle of the upper body) of a detected person box (image pixels). */
export function sampleTorso(video: HTMLVideoElement, bx: number, by: number, bw: number, bh: number): { lab: Lab; css: string } | null {
  scratch ??= document.createElement('canvas');
  scratch.width = 12;
  scratch.height = 12;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx || bw < 8 || bh < 16) return null;
  ctx.drawImage(video, bx + bw * 0.3, by + bh * 0.22, bw * 0.4, bh * 0.25, 0, 0, 12, 12);
  const d = ctx.getImageData(0, 0, 12, 12).data;
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

export function peopleFromDetections(res: DetectionResult, video: HTMLVideoElement, mirrored: boolean): PersonSighting[] {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const out: PersonSighting[] = [];
  for (const d of res.detections) {
    if (d.categories[0]?.categoryName !== 'person' || !d.boundingBox) continue;
    const { originX, originY, width, height } = d.boundingBox;
    const sample = sampleTorso(video, originX, originY, width, height);
    if (!sample) continue;
    const x = originX / vw;
    out.push({ color: sample.lab, css: sample.css, box: { x: mirrored ? 1 - x - width / vw : x, y: originY / vh, w: width / vw, h: height / vh } });
  }
  return out;
}

/** Largest person in view — used when capturing a team colour during setup. */
export const largestPerson = (people: PersonSighting[]) =>
  people.reduce<PersonSighting | null>((a, p) => (!a || p.box.w * p.box.h > a.box.w * a.box.h ? p : a), null);

/**
 * Who released the ball? Looks at the ball shortly before the shot was first seen
 * above the rim and votes on the team colour of the person holding/near it.
 */
export function attributeShot(
  startedAt: number,
  ballTrail: BallObs[],
  peopleFrames: { t: number; people: PersonSighting[] }[],
  teams: [Lab, Lab],
): 0 | 1 | null {
  const votes = [0, 0];
  for (const b of ballTrail) {
    if (b.t < startedAt - 1000 || b.t > startedAt - 100) continue;
    const frame = peopleFrames.reduce<{ t: number; people: PersonSighting[] } | null>(
      (best, f) => (!best || Math.abs(f.t - b.t) < Math.abs(best.t - b.t) ? f : best),
      null,
    );
    if (!frame || Math.abs(frame.t - b.t) > 150) continue;
    for (const p of frame.people) {
      const padX = p.box.w * 0.25;
      const padY = p.box.h * 0.15;
      if (b.x >= p.box.x - padX && b.x <= p.box.x + p.box.w + padX && b.y >= p.box.y - padY && b.y <= p.box.y + p.box.h) {
        const team = classifyColor(p.color, teams);
        if (team !== null) votes[team]++;
      }
    }
  }
  if (votes[0] + votes[1] < 2) return null;
  if (votes[0] >= votes[1] * 2) return 0;
  if (votes[1] >= votes[0] * 2) return 1;
  return null;
}
