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

export class GoalWatcher implements ShotWatcher {
  private armed = true;
  private hits: number[][] = [[], []];
  private clearSince: number | null = null;
  private nextId = 1;

  constructor(
    private goals: [Rect, Rect],
    private confirmMs = 350,
    private restartMs = 700,
  ) {}

  reset() {
    this.armed = true;
    this.hits = [[], []];
    this.clearSince = null;
  }

  update(t: number, ball: BallObs | null): WatcherUpdate {
    if (!this.armed) {
      // After a goal, the ball must be back in play outside both goals before the next one counts.
      const inPlay =
        ball &&
        !inside(this.goals[0], ball, 0.05) &&
        !inside(this.goals[1], ball, 0.05) &&
        ball.x > this.goals[0].x + this.goals[0].w &&
        ball.x < this.goals[1].x;
      if (!inPlay) this.clearSince = null;
      else if (this.clearSince === null) this.clearSince = t;
      if (this.clearSince !== null && t - this.clearSince >= this.restartMs) this.reset();
      return { status: 'Goal! Restart from the middle' };
    }
    if (!ball) return { status: 'Watching the ball' };
    for (const g of [0, 1] as const) {
      if (inside(this.goals[g], ball)) {
        this.hits[g] = [...this.hits[g].filter((h) => t - h <= this.confirmMs), t];
        // Two sightings inside the same goal within the window confirm it.
        if (this.hits[g].length >= 2) {
          this.armed = false;
          this.clearSince = null;
          this.hits = [[], []];
          return {
            status: 'Goal!',
            verdict: {
              id: this.nextId++,
              outcome: 'scored',
              label: 'GOAL',
              goal: g === 0 ? 'left' : 'right',
              reason: `Ball seen inside the ${g === 0 ? 'left' : 'right'} goal.`,
            },
          };
        }
        return { status: 'Ball at the goal…' };
      }
    }
    this.hits = [[], []];
    return { status: 'Watching the ball' };
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
