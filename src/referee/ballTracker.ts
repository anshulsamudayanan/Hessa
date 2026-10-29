import type { ObjectDetectorResult as DetectionResult } from '@mediapipe/tasks-vision';
import { dist } from './viewport';

// COCO classes treated as "the ball". Tested with the real model: a large orange ball is
// often labelled "orange" (the fruit) rather than "sports ball".
export const BALL_CLASSES = ['sports ball', 'orange'];

/** One ball sighting in view space (0..1). `r` is the radius as a fraction of frame height. */
export interface BallObs {
  t: number;
  x: number;
  y: number;
  r: number;
  score: number;
  /** Which sensor saw it: the object detector, or the colour tracker filling a gap. */
  source?: 'detector' | 'color';
}

export function ballsFromDetections(res: DetectionResult, vw: number, vh: number, mirrored: boolean, t: number): BallObs[] {
  return res.detections
    .filter((d) => d.boundingBox && BALL_CLASSES.includes(d.categories[0]?.categoryName))
    .map((d) => {
      const b = d.boundingBox!;
      const cx = (b.originX + b.width / 2) / vw;
      return {
        t,
        x: mirrored ? 1 - cx : cx,
        y: (b.originY + b.height / 2) / vh,
        r: (b.width / vh + b.height / vh) / 4,
        score: d.categories[0].score,
        source: 'detector' as const,
      };
    });
}

/**
 * Keeps a single ball track across frames. Predicts where the ball should be from
 * its last two sightings and picks the candidate nearest that prediction, so a
 * second ball or a same-coloured object elsewhere doesn't steal the track. Only
 * the object detector may start a track; colour sightings can only continue one.
 */
export class BallTracker {
  private last: BallObs | null = null;
  private prev: BallObs | null = null;

  constructor(
    private maxGapMs = 500,
    private maxJumpPerSec = 3.5, // frame-heights per second; a hard kick crosses the frame fast
  ) {}

  reset() {
    this.last = null;
    this.prev = null;
  }

  get current() {
    return this.last;
  }

  /** Where the ball should be at time `t`, or null if there's no live track. */
  predict(t: number): BallObs | null {
    const last = this.last;
    if (!last || t - last.t > this.maxGapMs) return null;
    const prev = this.prev;
    if (!prev || last.t - prev.t > 300 || last.t === prev.t) return { ...last, t };
    const k = (t - last.t) / (last.t - prev.t);
    return { ...last, t, x: last.x + (last.x - prev.x) * k, y: last.y + (last.y - prev.y) * k };
  }

  update(t: number, candidates: BallObs[]): BallObs | null {
    const predicted = this.predict(t);
    if (!predicted) {
      if (this.last && t - this.last.t > this.maxGapMs) this.reset();
      const detected = candidates.filter((c) => c.source !== 'color');
      if (!detected.length) return null;
      return this.accept(detected.reduce((a, b) => (a.score >= b.score ? a : b)));
    }
    const dt = (t - this.last!.t) / 1000;
    const gate = 0.06 + this.maxJumpPerSec * dt + 3 * this.last!.r;
    const near = candidates.filter((c) => dist(c, predicted) <= gate);
    if (!near.length) return null;
    const closest = (list: BallObs[]) => list.reduce((a, b) => (dist(a, predicted) <= dist(b, predicted) ? a : b));
    const detected = near.filter((c) => c.source !== 'color');
    return this.accept(closest(detected.length ? detected : near));
  }

  private accept(b: BallObs) {
    this.prev = this.last;
    this.last = b;
    return b;
  }
}
