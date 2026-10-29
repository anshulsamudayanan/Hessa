import type { ObjectDetectorResult as DetectionResult } from '@mediapipe/tasks-vision';
import { dist } from './viewport';

/** One ball sighting in view space (0..1). `r` is the radius as a fraction of frame height. */
export interface BallObs {
  t: number;
  x: number;
  y: number;
  r: number;
  score: number;
}

export function ballsFromDetections(res: DetectionResult, vw: number, vh: number, mirrored: boolean, t: number): BallObs[] {
  return res.detections
    .filter((d) => d.boundingBox && d.categories[0]?.categoryName === 'sports ball')
    .map((d) => {
      const b = d.boundingBox!;
      const cx = (b.originX + b.width / 2) / vw;
      return {
        t,
        x: mirrored ? 1 - cx : cx,
        y: (b.originY + b.height / 2) / vh,
        r: (b.width / vh + b.height / vh) / 4,
        score: d.categories[0].score,
      };
    });
}

/**
 * Keeps a single ball track across frames: prefers the candidate closest to where
 * the ball was last seen, so a second ball lying in the corner doesn't steal the track.
 */
export class BallTracker {
  private last: BallObs | null = null;

  constructor(
    private maxGapMs = 500,
    private maxJumpPerSec = 3.5, // frame-heights per second; a hard kick crosses the frame fast
  ) {}

  reset() {
    this.last = null;
  }

  update(t: number, candidates: BallObs[]): BallObs | null {
    if (!candidates.length) {
      if (this.last && t - this.last.t > this.maxGapMs) this.last = null;
      return null;
    }
    let pick: BallObs;
    if (this.last && t - this.last.t <= this.maxGapMs) {
      const gate = 0.08 + (this.maxJumpPerSec * (t - this.last.t)) / 1000;
      const near = candidates.filter((c) => dist(c, this.last!) <= gate);
      if (!near.length) return null;
      pick = near.reduce((a, b) => (dist(a, this.last!) <= dist(b, this.last!) ? a : b));
    } else {
      pick = candidates.reduce((a, b) => (a.score >= b.score ? a : b));
    }
    this.last = pick;
    return pick;
  }
}
