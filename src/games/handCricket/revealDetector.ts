/**
 * Game event detector for hand cricket. Turns a stream of per-frame hand readings
 * into at most one "reveal" event per ball, with fairness rules:
 *
 *  1. Both players must hold a fist (neutral) before each ball.
 *  2. A spoken/beeped countdown runs; readings during it are ignored, so an early
 *     hand is never taken as the final choice.
 *  3. Readings are collected only inside the reveal window after SHOW.
 *  4. Each side must hold one number steadily; a hand that switches numbers
 *     during the window, wobbles, or is missing makes the ball "unclear".
 *  5. One outcome per window, then a cooldown and a new neutral fist are required,
 *     so the same gesture can't be counted twice.
 */

export type Side = 'left' | 'right';

export interface HandObs {
  /** 0 = fist, 1–6 = sign, null = hand visible but not readable. */
  count: number | null;
}

export interface FrameObs {
  t: number;
  left: HandObs | null;
  right: HandObs | null;
  /** Two hands were seen on the same half of the frame. */
  conflict?: boolean;
}

export type UnclearReason = 'missing' | 'fist' | 'unstable' | 'changed' | 'two-hands-one-side';

export type SideResult = { ok: true; value: number } | { ok: false; reason: UnclearReason };

export type RevealOutcome =
  | { kind: 'reveal'; id: number; left: number; right: number }
  | { kind: 'unclear'; id: number; left: SideResult; right: SideResult };

export type RevealPhase = 'need-neutral' | 'countdown' | 'reveal' | 'cooldown';

export interface DetectorUpdate {
  phase: RevealPhase;
  /** 3, 2, 1 during countdown. */
  beat?: number;
  events: ('beat' | 'show' | 'abort')[];
  outcome?: RevealOutcome;
}

export const REVEAL_TIMING = {
  neutralHoldMs: 450,
  beatMs: 650,
  beats: 3,
  graceMs: 200,
  windowMs: 1500,
  cooldownMs: 1800,
  lostHandsAbortMs: 700,
  minSamples: 4,
  stableRun: 3,
  agreement: 0.7,
};

type Timing = typeof REVEAL_TIMING;

/** Decide one side's number from the samples taken inside the reveal window. */
export function settleSide(samples: (number | null | undefined)[], timing: Timing = REVEAL_TIMING): SideResult {
  const total = samples.length;
  if (total === 0) return { ok: false, reason: 'missing' };
  const missing = samples.filter((s) => s === undefined).length;
  const shown = samples.filter((s): s is number => typeof s === 'number' && s > 0);
  const fists = samples.filter((s) => s === 0).length;

  if (shown.length < timing.minSamples) {
    if (missing / total > 0.5) return { ok: false, reason: 'missing' };
    if (fists / total > 0.5) return { ok: false, reason: 'fist' };
    return { ok: false, reason: 'unstable' };
  }

  // Values held for a run of consecutive frames count as a deliberate sign.
  const stable = new Set<number>();
  let run = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    run = typeof s === 'number' && s > 0 && s === samples[i - 1] ? run + 1 : 1;
    if (typeof s === 'number' && s > 0 && run >= timing.stableRun) stable.add(s);
  }
  if (stable.size > 1) return { ok: false, reason: 'changed' };

  const freq = new Map<number, number>();
  shown.forEach((s) => freq.set(s, (freq.get(s) ?? 0) + 1));
  const [mode, modeCount] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  if (modeCount / shown.length < timing.agreement || (stable.size === 1 && !stable.has(mode))) {
    return { ok: false, reason: 'unstable' };
  }
  return { ok: true, value: mode };
}

export class RevealDetector {
  private phase: RevealPhase = 'need-neutral';
  private phaseStart = 0;
  private neutralSince: number | null = null;
  private lostSince: number | null = null;
  private lastBeat = 0;
  private samples: { left: (number | null | undefined)[]; right: (number | null | undefined)[] } = { left: [], right: [] };
  private conflictFrames = 0;
  private windowFrames = 0;
  private nextId = 1;

  constructor(private timing: Timing = REVEAL_TIMING) {}

  get currentPhase() {
    return this.phase;
  }

  reset() {
    this.phase = 'need-neutral';
    this.neutralSince = null;
    this.lostSince = null;
  }

  update(obs: FrameObs): DetectorUpdate {
    const T = this.timing;
    const events: DetectorUpdate['events'] = [];
    const t = obs.t;

    switch (this.phase) {
      case 'need-neutral': {
        const neutral = obs.left?.count === 0 && obs.right?.count === 0 && !obs.conflict;
        if (!neutral) this.neutralSince = null;
        else if (this.neutralSince === null) this.neutralSince = t;
        if (this.neutralSince !== null && t - this.neutralSince >= T.neutralHoldMs) {
          this.enter('countdown', t);
          this.lastBeat = T.beats;
          this.lostSince = null;
          events.push('beat');
          return { phase: this.phase, beat: T.beats, events };
        }
        return { phase: this.phase, events };
      }

      case 'countdown': {
        // Shaking fists is fine, but both players must stay in view.
        if (!obs.left || !obs.right) {
          this.lostSince ??= t;
          if (t - this.lostSince > T.lostHandsAbortMs) {
            this.enter('need-neutral', t);
            return { phase: this.phase, events: ['abort'] };
          }
        } else this.lostSince = null;

        const elapsed = t - this.phaseStart;
        if (elapsed >= T.beats * T.beatMs) {
          this.enter('reveal', t);
          this.samples = { left: [], right: [] };
          this.conflictFrames = 0;
          this.windowFrames = 0;
          events.push('show');
          return { phase: this.phase, events };
        }
        const beat = T.beats - Math.floor(elapsed / T.beatMs);
        if (beat !== this.lastBeat) {
          this.lastBeat = beat;
          events.push('beat');
        }
        return { phase: this.phase, beat, events };
      }

      case 'reveal': {
        const elapsed = t - this.phaseStart;
        if (elapsed >= T.graceMs && elapsed < T.windowMs) {
          this.windowFrames++;
          if (obs.conflict) this.conflictFrames++;
          // undefined = hand not in view, null = in view but unreadable.
          this.samples.left.push(obs.left ? obs.left.count : undefined);
          this.samples.right.push(obs.right ? obs.right.count : undefined);
        }
        if (elapsed >= T.windowMs) {
          const outcome = this.decide();
          this.enter('cooldown', t);
          return { phase: this.phase, events, outcome };
        }
        return { phase: this.phase, events };
      }

      case 'cooldown': {
        if (t - this.phaseStart >= T.cooldownMs) this.enter('need-neutral', t);
        return { phase: this.phase, events };
      }
    }
  }

  private enter(phase: RevealPhase, t: number) {
    this.phase = phase;
    this.phaseStart = t;
    this.neutralSince = null;
  }

  private decide(): RevealOutcome {
    const id = this.nextId++;
    if (this.windowFrames > 0 && this.conflictFrames / this.windowFrames > 0.3) {
      const r: SideResult = { ok: false, reason: 'two-hands-one-side' };
      return { kind: 'unclear', id, left: r, right: r };
    }
    const left = settleSide(this.samples.left, this.timing);
    const right = settleSide(this.samples.right, this.timing);
    if (left.ok && right.ok) return { kind: 'reveal', id, left: left.value, right: right.value };
    return { kind: 'unclear', id, left, right };
  }
}
