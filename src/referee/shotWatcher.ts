import type { BallObs } from './ballTracker';
import type { Rect } from './viewport';

/**
 * Game event detectors for ball games. They turn the ball track into discrete,
 * de-duplicated events. `uncertain` means players must confirm — never a guess.
 */
export interface ShotVerdict {
  id: number;
  outcome: 'scored' | 'not-scored' | 'uncertain';
  label: string;
  reason: string;
  /** Football: which goal the ball went into. */
  goal?: 'left' | 'right';
  /** Basketball: when the shot was first seen above the rim (for shooter attribution). */
  startedAt?: number;
}

export interface WatcherUpdate {
  status: string;
  verdict?: ShotVerdict;
}

export interface ShotWatcher {
  update(t: number, ball: BallObs | null): WatcherUpdate;
  reset(): void;
}

const inside = (r: Rect, p: { x: number; y: number }, pad = 0) =>
  p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

// ---------------------------------------------------------------------------
// Football: phone side-on to a small pitch, one goal marked at each end.
// ---------------------------------------------------------------------------

export type Edge = 'left' | 'right' | 'top' | 'bottom';

/**
 * Where the segment a→b first enters `box` (Liang–Barsky clipping), with `t` the
 * fraction along the segment. null if it never enters, or if `a` is already inside.
 */
export function segmentEntry(a: { x: number; y: number }, b: { x: number; y: number }, box: Rect): { edge: Edge; t: number } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - box.x, box.x + box.w - a.x, a.y - box.y, box.y + box.h - a.y];
  const edges: Edge[] = ['left', 'right', 'top', 'bottom'];
  let t0 = 0;
  let t1 = 1;
  let entry: Edge | null = null;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return null;
      if (r > t0) {
        t0 = r;
        entry = edges[i];
      }
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return entry ? { edge: entry, t: t0 } : null;
}

export interface GoalCalibration {
  /** Apparent ball radius measured inside each goal [left, right] during setup; null if not measured. */
  ballR: [number | null, number | null];
}

export const GOAL_RULES = {
  maxGapMs: 350, // two sightings further apart than this can't be joined into a path
  depthMin: 0.6, // ball radius vs. calibrated radius at the goal
  depthMax: 1.65,
  inBoxSightings: 3,
  inBoxWindowMs: 900,
  lostMs: 900,
  nearMouth: 0.12,
  restartMs: 700,
};

/**
 * Calls a goal when the ball's path crosses a goal mouth (the goal line, under
 * the bar). Fast shots that skip past the goal box between frames still count,
 * because the path between sightings is checked, not just the sightings.
 * Balls entering over the bar or from behind never count. With a calibrated
 * ball size per goal, a ball that looks much closer to or further from the
 * camera than the goal (passing in front of / behind it) is referred to players.
 */
export class GoalWatcher implements ShotWatcher {
  private armed = true;
  private prev: BallObs | null = null;
  private prev2: BallObs | null = null;
  private inBox: number[][] = [[], []];
  private notViaMouth = [false, false];
  private lostFlagged = false;
  private clearSince: number | null = null;
  private nextId = 1;

  constructor(
    private goals: [Rect, Rect],
    private calib: GoalCalibration = { ballR: [null, null] },
    private rules = GOAL_RULES,
  ) {}

  reset() {
    this.armed = true;
    this.prev = null;
    this.prev2 = null;
    this.inBox = [[], []];
    this.notViaMouth = [false, false];
    this.lostFlagged = false;
    this.clearSince = null;
  }

  /** The goal mouth faces the pitch: the right edge of the left goal, the left edge of the right goal. */
  private mouth(g: 0 | 1): Edge {
    return g === 0 ? 'right' : 'left';
  }

  private emit(g: 0 | 1, outcome: ShotVerdict['outcome'], reason: string): WatcherUpdate {
    this.armed = false;
    this.clearSince = null;
    return {
      status: outcome === 'scored' ? 'Goal!' : 'Was that a goal?',
      verdict: { id: this.nextId++, outcome, label: outcome === 'scored' ? 'GOAL' : 'Not sure', goal: g === 0 ? 'left' : 'right', reason },
    };
  }

  private crossing(g: 0 | 1, r: number): WatcherUpdate {
    const cal = this.calib.ballR[g];
    if (cal) {
      const ratio = r / cal;
      if (ratio > this.rules.depthMax) return this.emit(g, 'uncertain', 'The ball looked closer to the camera than the goal — it may have passed in front of it.');
      if (ratio < this.rules.depthMin) return this.emit(g, 'uncertain', 'The ball looked further away than the goal — it may have gone behind it.');
    }
    return this.emit(g, 'scored', cal ? 'Ball crossed the goal line under the bar, at the goal’s distance.' : 'Ball crossed the goal line under the bar.');
  }

  update(t: number, ball: BallObs | null): WatcherUpdate {
    const R = this.rules;
    if (!this.armed) {
      // After a call, the ball must be back in play between the goals before the next one counts.
      const inPlay =
        ball &&
        !inside(this.goals[0], ball, 0.05) &&
        !inside(this.goals[1], ball, 0.05) &&
        ball.x > this.goals[0].x + this.goals[0].w &&
        ball.x < this.goals[1].x;
      if (!inPlay) this.clearSince = null;
      else if (this.clearSince === null) this.clearSince = t;
      if (this.clearSince !== null && t - this.clearSince >= R.restartMs) this.reset();
      return { status: 'Restart from the middle' };
    }

    if (!ball) {
      // Lost right in front of a goal mouth while heading in: ask rather than guess.
      const p = this.prev;
      const q = this.prev2;
      if (p && q && !this.lostFlagged && t - p.t > R.lostMs) {
        this.lostFlagged = true;
        for (const g of [0, 1] as const) {
          const box = this.goals[g];
          const mouthX = g === 0 ? box.x + box.w : box.x;
          const gap = g === 0 ? p.x - mouthX : mouthX - p.x;
          const heading = g === 0 ? p.x < q.x : p.x > q.x;
          if (heading && gap >= 0 && gap <= R.nearMouth && p.y >= box.y - 0.03 && p.y <= box.y + box.h + 0.03) {
            return this.emit(g, 'uncertain', 'Lost sight of the ball just in front of the goal.');
          }
        }
      }
      return { status: 'Looking for the ball' };
    }

    const prev = this.prev;
    this.prev2 = prev;
    this.prev = ball;
    this.lostFlagged = false;

    // 1. Did the path since the last sighting cross a goal mouth?
    if (prev && ball.t - prev.t <= R.maxGapMs) {
      for (const g of [0, 1] as const) {
        const entry = segmentEntry(prev, ball, this.goals[g]);
        if (!entry) continue;
        if (entry.edge !== this.mouth(g)) {
          this.notViaMouth[g] = true; // over the bar or round the back: never a goal
          continue;
        }
        return this.crossing(g, prev.r + (ball.r - prev.r) * entry.t);
      }
    }

    // 2. Ball inside a goal without a seen crossing (tracking gap): ask the players.
    let inAny = false;
    for (const g of [0, 1] as const) {
      if (!inside(this.goals[g], ball)) continue;
      inAny = true;
      if (this.notViaMouth[g]) return { status: g === 0 ? 'Ball behind the left goal' : 'Ball behind the right goal' };
      this.inBox[g] = [...this.inBox[g].filter((x) => t - x <= R.inBoxWindowMs), t];
      if (this.inBox[g].length >= R.inBoxSightings) {
        return this.emit(g, 'uncertain', 'Saw the ball in the goal but missed how it got there.');
      }
    }
    if (!inAny) {
      this.inBox = [[], []];
      this.notViaMouth = [false, false];
    }
    return { status: inAny ? 'Ball at the goal…' : 'Watching the ball' };
  }
}

// ---------------------------------------------------------------------------
// Basketball: camera to the side/front of the hoop with space above the rim.
// ---------------------------------------------------------------------------

/** Judge one attempt from the ball track. `rim` is the box drawn around the rim. */
export function judgeBasket(track: BallObs[], rim: Rect): Omit<ShotVerdict, 'id'> {
  const rimTop = rim.y;
  const rimBottom = rim.y + rim.h;
  const lineY = rim.y + rim.h / 2;
  // Find the descent through rim level: last point above the rim followed by first point below it.
  for (let i = 0; i < track.length; i++) {
    if (track[i].y > rimBottom) {
      let j = i - 1;
      while (j >= 0 && track[j].y >= rimTop) j--;
      if (j < 0) continue;
      const a = track[j];
      const b = track[i];
      if (b.t - a.t > 700) {
        return { outcome: 'uncertain', label: 'Not sure', reason: 'Lost the ball near the rim.' };
      }
      const k = (lineY - a.y) / (b.y - a.y || 1e-6);
      const crossX = a.x + (b.x - a.x) * k;
      const through = crossX >= rim.x + rim.w * 0.1 && crossX <= rim.x + rim.w * 0.9;
      const underHoop = b.x >= rim.x - rim.w * 0.2 && b.x <= rim.x + rim.w * 1.2;
      if (through && underHoop) return { outcome: 'scored', label: 'BASKET', reason: 'The ball dropped through the rim.' };
      return { outcome: 'not-scored', label: 'MISS', reason: 'The ball came down outside the rim.' };
    }
  }
  return { outcome: 'uncertain', label: 'Not sure', reason: 'Didn’t see the ball come down past the rim.' };
}

export class BasketWatcher implements ShotWatcher {
  private attempt = false;
  private track: BallObs[] = [];
  private startedAt = 0;
  private cooldownUntil = 0;
  private nextId = 1;

  constructor(private rim: Rect) {}

  reset() {
    this.attempt = false;
    this.track = [];
  }

  private inBand(b: BallObs) {
    return b.x >= this.rim.x - this.rim.w * 1.5 && b.x <= this.rim.x + this.rim.w * 2.5;
  }

  update(t: number, ball: BallObs | null): WatcherUpdate {
    if (t < this.cooldownUntil) return { status: 'Play on' };
    if (!this.attempt) {
      if (ball && ball.y < this.rim.y && this.inBand(ball)) {
        this.attempt = true;
        this.startedAt = t;
        this.track = [ball];
        return { status: 'Shot in the air…' };
      }
      return { status: 'Watching the hoop' };
    }
    if (ball) this.track.push(ball);
    const last = this.track[this.track.length - 1];
    const firstBelow = this.track.find((p) => p.y > this.rim.y + this.rim.h);
    const settled = firstBelow && t - firstBelow.t > 300;
    if (settled || t - this.startedAt > 3000 || t - last.t > 1500) {
      const verdict = { id: this.nextId++, startedAt: this.startedAt, ...judgeBasket(this.track, this.rim) };
      this.reset();
      this.cooldownUntil = t + 1200;
      return { status: 'Decision', verdict };
    }
    return { status: 'Shot in the air…' };
  }
}
