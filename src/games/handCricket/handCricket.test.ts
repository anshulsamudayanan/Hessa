import { describe, expect, it } from 'vitest';
import { readFingers, signFromDigits, type Digit, type DigitState, type Vec3 } from './fingers';
import { REVEAL_TIMING, RevealDetector, settleSide, type FrameObs } from './revealDetector';
import { applyBall, newMatch, type HandCricketState } from './rules';

// ---------------------------------------------------------------------------
// Synthetic hands: wrist at origin, fingers pointing +y, palm facing -z.
// ---------------------------------------------------------------------------
type Pose = Partial<Record<Digit, 'up' | 'down' | 'half'>>;

function makeHand(pose: Pose): Vec3[] {
  const p = (x: number, y: number, z = 0): Vec3 => ({ x, y, z });
  const lm: Vec3[] = Array(21);
  lm[0] = p(0, 0);
  const columns: [Exclude<Digit, 'thumb'>, number, number][] = [
    ['index', 5, 0.03],
    ['middle', 9, 0.008],
    ['ring', 13, -0.014],
    ['pinky', 17, -0.034],
  ];
  for (const [name, base, x] of columns) {
    const mcp = p(x, 0.085);
    const pip = p(x, 0.125);
    lm[base] = mcp;
    lm[base + 1] = pip;
    const state = pose[name] ?? 'down';
    if (state === 'up') {
      lm[base + 2] = p(x, 0.15);
      lm[base + 3] = p(x, 0.17);
    } else if (state === 'down') {
      // Curled back toward the palm.
      lm[base + 2] = p(x, 0.11, -0.02);
      lm[base + 3] = p(x, 0.09, -0.02);
    } else {
      // Bent ~60° at the PIP: neither clearly up nor down.
      lm[base + 2] = p(x, 0.14, -0.018);
      lm[base + 3] = p(x, 0.148, -0.034);
    }
  }
  const thumb = pose.thumb ?? 'down';
  lm[1] = p(0.025, 0.025);
  lm[2] = p(0.045, 0.045);
  if (thumb === 'up') {
    lm[3] = p(0.065, 0.068);
    lm[4] = p(0.082, 0.09);
  } else if (thumb === 'down') {
    // Tucked across the curled fingers.
    lm[3] = p(0.035, 0.075, -0.02);
    lm[4] = p(0.015, 0.1, -0.025);
  } else {
    lm[3] = p(0.06, 0.065, -0.006);
    lm[4] = p(0.07, 0.08, -0.012);
  }
  return lm;
}

describe('finger reading', () => {
  const cases: [string, Pose, number][] = [
    ['fist', {}, 0],
    ['1 (index)', { index: 'up' }, 1],
    ['2 (index + middle)', { index: 'up', middle: 'up' }, 2],
    ['2 (thumb + index)', { thumb: 'up', index: 'up' }, 2],
    ['3', { index: 'up', middle: 'up', ring: 'up' }, 3],
    ['4', { index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, 4],
    ['5 (open hand)', { thumb: 'up', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, 5],
    ['6 (thumb only)', { thumb: 'up' }, 6],
  ];
  it.each(cases)('reads %s', (_, pose, expected) => {
    expect(readFingers(makeHand(pose)).count).toBe(expected);
  });

  it('is scale invariant (child vs adult hand)', () => {
    const small = makeHand({ index: 'up', middle: 'up', ring: 'up' }).map((v) => ({ x: v.x * 0.6, y: v.y * 0.6, z: v.z * 0.6 }));
    expect(readFingers(small).count).toBe(3);
  });

  it('is rotation invariant (hand tilted sideways)', () => {
    const rot = makeHand({ index: 'up', middle: 'up' }).map((v) => ({ x: v.y, y: -v.x, z: v.z }));
    expect(readFingers(rot).count).toBe(2);
  });

  it('refuses to guess when a finger is half bent', () => {
    const r = readFingers(makeHand({ index: 'up', middle: 'half' }));
    expect(r.digits.middle).toBe('unsure');
    expect(r.count).toBeNull();
  });

  it('refuses to guess when the thumb is ambiguous', () => {
    expect(readFingers(makeHand({ thumb: 'half' })).count).toBeNull();
  });

  it('returns null for incomplete landmark sets', () => {
    expect(readFingers([]).count).toBeNull();
  });

  it('maps digits to signs', () => {
    const d = (o: Partial<Record<Digit, DigitState>>): Record<Digit, DigitState> => ({
      thumb: 'folded',
      index: 'folded',
      middle: 'folded',
      ring: 'folded',
      pinky: 'folded',
      ...o,
    });
    expect(signFromDigits(d({ thumb: 'extended' }))).toBe(6);
    expect(signFromDigits(d({ thumb: 'extended', index: 'extended', middle: 'extended' }))).toBe(3);
    expect(signFromDigits(d({ pinky: 'unsure' }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reveal window
// ---------------------------------------------------------------------------
const T = REVEAL_TIMING;
const FRAME = 33;

/** Drive the detector through a full ball and return what happened. */
function runBall(
  det: RevealDetector,
  start: number,
  reveal: (t: number) => Pick<FrameObs, 'left' | 'right' | 'conflict'>,
  countdown: (t: number) => Pick<FrameObs, 'left' | 'right'> = () => ({ left: { count: 0 }, right: { count: 0 } }),
) {
  let t = start;
  const outcomes = [];
  const events: string[] = [];
  // Neutral fists.
  while (det.currentPhase === 'need-neutral' && t < start + 3000) {
    const u = det.update({ t, left: { count: 0 }, right: { count: 0 } });
    events.push(...u.events);
    t += FRAME;
  }
  let showAt = -1;
  while (det.currentPhase === 'countdown') {
    const u = det.update({ t, ...countdown(t) });
    events.push(...u.events);
    if (u.events.includes('show')) showAt = t;
    t += FRAME;
  }
  while (det.currentPhase === 'reveal') {
    const u = det.update({ t, ...reveal(t - showAt) });
    if (u.outcome) outcomes.push(u.outcome);
    t += FRAME;
  }
  return { outcomes, events, t };
}

describe('reveal detector', () => {
  it('waits for both fists, counts down 3-2-1, then reads both numbers', () => {
    const det = new RevealDetector();
    const { outcomes, events } = runBall(det, 0, () => ({ left: { count: 4 }, right: { count: 2 } }));
    expect(events.filter((e) => e === 'beat')).toHaveLength(3);
    expect(events).toContain('show');
    expect(outcomes).toEqual([{ kind: 'reveal', id: 1, left: 4, right: 2 }]);
  });

  it('does not start without both players showing fists', () => {
    const det = new RevealDetector();
    for (let t = 0; t < 3000; t += FRAME) det.update({ t, left: { count: 0 }, right: null });
    expect(det.currentPhase).toBe('need-neutral');
    for (let t = 3000; t < 6000; t += FRAME) det.update({ t, left: { count: 0 }, right: { count: 3 } });
    expect(det.currentPhase).toBe('need-neutral');
  });

  it('ignores numbers shown early during the countdown', () => {
    const det = new RevealDetector();
    const { outcomes } = runBall(
      det,
      0,
      () => ({ left: { count: 2 }, right: { count: 5 } }),
      () => ({ left: { count: 6 }, right: { count: 0 } }), // left flashes 6 too early
    );
    expect(outcomes).toEqual([{ kind: 'reveal', id: 1, left: 2, right: 5 }]);
  });

  it('allows a moment of blur right after SHOW (grace period)', () => {
    const det = new RevealDetector();
    const { outcomes } = runBall(det, 0, (dt) => ({ left: { count: dt < 150 ? 1 : 3 }, right: { count: 3 } }));
    expect(outcomes[0]).toMatchObject({ kind: 'reveal', left: 3, right: 3 });
  });

  it('reports a missing hand instead of guessing', () => {
    const det = new RevealDetector();
    const { outcomes } = runBall(det, 0, () => ({ left: { count: 4 }, right: null }));
    expect(outcomes[0]).toMatchObject({ kind: 'unclear', left: { ok: true, value: 4 }, right: { ok: false, reason: 'missing' } });
  });

  it('reports a hand that stays a fist', () => {
    const det = new RevealDetector();
    const { outcomes } = runBall(det, 0, () => ({ left: { count: 0 }, right: { count: 5 } }));
    expect(outcomes[0]).toMatchObject({ kind: 'unclear', left: { ok: false, reason: 'fist' } });
  });

  it('flags a player who changes number after seeing the opponent', () => {
    const det = new RevealDetector();
    const { outcomes } = runBall(det, 0, (dt) => ({ left: { count: 3 }, right: { count: dt < 800 ? 2 : 3 } }));
    expect(outcomes[0]).toMatchObject({ kind: 'unclear', right: { ok: false, reason: 'changed' } });
  });

  it('marks flickering/unreadable hands as unstable', () => {
    const det = new RevealDetector();
    let i = 0;
    const { outcomes } = runBall(det, 0, () => ({ left: { count: [2, null, 3, null, 4][i++ % 5] }, right: { count: 1 } }));
    expect(outcomes[0]).toMatchObject({ kind: 'unclear', left: { ok: false } });
  });

  it('rejects two hands on one side of the frame', () => {
    const det = new RevealDetector();
    const { outcomes } = runBall(det, 0, () => ({ left: null, right: null, conflict: true }));
    expect(outcomes[0]).toMatchObject({ kind: 'unclear', left: { reason: 'two-hands-one-side' } });
  });

  it('produces exactly one outcome per ball and needs fists again before the next', () => {
    const det = new RevealDetector();
    const first = runBall(det, 0, () => ({ left: { count: 5 }, right: { count: 1 } }));
    // Players keep holding their numbers through the cooldown and beyond: no new ball.
    let t = first.t;
    const extra = [];
    for (; t < first.t + 5000; t += FRAME) {
      const u = det.update({ t, left: { count: 5 }, right: { count: 1 } });
      if (u.outcome) extra.push(u.outcome);
    }
    expect(extra).toHaveLength(0);
    expect(det.currentPhase).toBe('need-neutral');
    const second = runBall(det, t, () => ({ left: { count: 6 }, right: { count: 6 } }));
    expect(second.outcomes).toEqual([{ kind: 'reveal', id: 2, left: 6, right: 6 }]);
  });

  it('aborts the countdown if a player leaves the frame', () => {
    const det = new RevealDetector();
    let t = 0;
    while (det.currentPhase === 'need-neutral') det.update({ t: (t += FRAME), left: { count: 0 }, right: { count: 0 } });
    const events: string[] = [];
    for (let i = 0; i < 40 && det.currentPhase === 'countdown'; i++) events.push(...det.update({ t: (t += FRAME), left: { count: 0 }, right: null }).events);
    expect(events).toContain('abort');
    expect(det.currentPhase).toBe('need-neutral');
  });

  it('settleSide needs enough samples', () => {
    expect(settleSide([4, 4])).toEqual({ ok: false, reason: 'unstable' });
    expect(settleSide([])).toEqual({ ok: false, reason: 'missing' });
    expect(settleSide([4, 4, 4, 4, null, 4])).toEqual({ ok: true, value: 4 });
    expect(T.windowMs).toBeGreaterThan(T.graceMs);
  });
});

// ---------------------------------------------------------------------------
// Rules engine
// ---------------------------------------------------------------------------
function play(state: HandCricketState, balls: [number, number][], startId = 1) {
  let s = state;
  const decisions: ReturnType<typeof applyBall>['decision'][] = [];
  balls.forEach(([bat, bowl], i) => {
    const r = applyBall(s, { eventId: startId + i, batterShow: bat, bowlerShow: bowl });
    s = r.state;
    decisions.push(r.decision);
  });
  return { state: s, decisions };
}

describe('hand cricket rules', () => {
  it('awards the batter’s number when numbers differ', () => {
    const { state, decisions } = play(newMatch(['Asha', 'Ravi'], 0), [
      [4, 2],
      [6, 1],
    ]);
    expect(state.scores).toEqual([10, 0]);
    expect(decisions[0].message).toBe('Batter 4, Bowler 2 — 4 runs!');
  });

  it('gives OUT on matching numbers and switches innings with a target', () => {
    const { state, decisions } = play(newMatch(['Asha', 'Ravi'], 0), [
      [5, 1],
      [3, 3],
    ]);
    expect(decisions[1]).toMatchObject({ out: true, inningsEnded: true, matchOver: false });
    expect(state).toMatchObject({ innings: 2, batting: 1, target: 6, scores: [5, 0] });
  });

  it('ends the match as soon as the chaser reaches the target', () => {
    const { state, decisions } = play(newMatch(['Asha', 'Ravi'], 0), [
      [5, 1],
      [3, 3], // Asha out for 5, Ravi needs 6
      [4, 1],
      [2, 5], // 6 → win
    ]);
    expect(decisions[3].matchOver).toBe(true);
    expect(state.result).toEqual({ winner: 1, text: 'Ravi chased it down!' });
  });

  it('first batter wins when the chaser is out short', () => {
    const { state } = play(newMatch(['Asha', 'Ravi'], 1), [
      [6, 2],
      [1, 1], // Ravi 6
      [2, 3],
      [4, 4], // Asha out on 2
    ]);
    expect(state.result).toEqual({ winner: 1, text: 'Ravi wins by 4 runs!' });
  });

  it('declares a tie when the chaser is out level', () => {
    const { state } = play(newMatch(['A', 'B'], 0), [
      [3, 1],
      [2, 2],
      [3, 5],
      [1, 1],
    ]);
    expect(state.scores).toEqual([3, 3]);
    expect(state.result?.winner).toBeNull();
  });

  it('a duck (out first ball) sets a target of 1', () => {
    const { state } = play(newMatch(['A', 'B'], 0), [[2, 2]]);
    expect(state.target).toBe(1);
  });

  it('never applies the same event twice', () => {
    const s0 = newMatch(['A', 'B'], 0);
    const once = applyBall(s0, { eventId: 7, batterShow: 4, bowlerShow: 1 });
    const twice = applyBall(once.state, { eventId: 7, batterShow: 4, bowlerShow: 1 });
    expect(twice.decision).toMatchObject({ applied: false, ignoredReason: 'duplicate' });
    expect(twice.state.scores).toEqual([4, 0]);
  });

  it('ignores balls after the match is over', () => {
    const { state } = play(newMatch(['A', 'B'], 0), [
      [1, 1],
      [1, 2],
    ]);
    expect(state.result?.winner).toBe(1);
    const r = applyBall(state, { eventId: 99, batterShow: 6, bowlerShow: 1 });
    expect(r.decision.ignoredReason).toBe('match-over');
  });

  it('rejects numbers outside 1–6', () => {
    expect(() => applyBall(newMatch(['A', 'B'], 0), { eventId: 1, batterShow: 0, bowlerShow: 3 })).toThrow(RangeError);
    expect(() => applyBall(newMatch(['A', 'B'], 0), { eventId: 1, batterShow: 7, bowlerShow: 3 })).toThrow(RangeError);
  });

  it('records manual entries as manual', () => {
    const r = applyBall(newMatch(['A', 'B'], 0), { eventId: 1, batterShow: 2, bowlerShow: 5, source: 'manual' });
    expect(r.state.balls[0].source).toBe('manual');
  });
});
