import { describe, expect, it } from 'vitest';
import { BallTracker, type BallObs } from './ballTracker';
import { addScore, amendScore, boxScore, endMatch, newMatch, recordAttempt, tick, type MatchConfig, type MatchState } from './matchRules';
import { findColorBlob, isTrackableColor } from './ballColor';
import { BasketWatcher, GoalWatcher, judgeBasket, segmentEntry } from './shotWatcher';
import { attributeShot, classifyColor, rgbToLab } from './teamColors';

const ball = (t: number, x: number, y: number, r = 0.03, score = 0.8): BallObs => ({ t, x, y, r, score });

/** Linear path from a to b sampled every 33 ms. */
function path(t0: number, a: [number, number], b: [number, number], ms: number): BallObs[] {
  const out: BallObs[] = [];
  for (let dt = 0; dt <= ms; dt += 33) {
    const k = dt / ms;
    out.push(ball(t0 + dt, a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k));
  }
  return out;
}

describe('ball tracker', () => {
  it('follows the same ball instead of jumping to a distractor', () => {
    const tr = new BallTracker();
    expect(tr.update(0, [ball(0, 0.5, 0.5)])).toMatchObject({ x: 0.5 });
    const next = tr.update(33, [ball(33, 0.9, 0.1, 0.03, 0.99), ball(33, 0.52, 0.5, 0.03, 0.4)]);
    expect(next).toMatchObject({ x: 0.52 });
  });

  it('drops the track after a long gap', () => {
    const tr = new BallTracker();
    tr.update(0, [ball(0, 0.1, 0.1)]);
    tr.update(1000, []);
    expect(tr.update(1033, [ball(1033, 0.9, 0.9)])).toMatchObject({ x: 0.9 });
  });

  it('predicts motion: prefers the candidate ahead of a moving ball over one left behind', () => {
    const tr = new BallTracker();
    tr.update(0, [ball(0, 0.1, 0.5)]);
    tr.update(33, [ball(33, 0.2, 0.5)]);
    const next = tr.update(66, [ball(66, 0.16, 0.5), ball(66, 0.3, 0.5)]);
    expect(next?.x).toBeCloseTo(0.3);
  });

  it('a colour blob can continue a track but never start one', () => {
    const tr = new BallTracker();
    expect(tr.update(0, [{ ...ball(0, 0.5, 0.5), source: 'color' }])).toBeNull();
    tr.update(33, [ball(33, 0.5, 0.5)]);
    expect(tr.update(66, [{ ...ball(66, 0.55, 0.5), source: 'color' }])).toMatchObject({ source: 'color' });
  });

  it('prefers a detector sighting over a colour blob when both are near', () => {
    const tr = new BallTracker();
    tr.update(0, [ball(0, 0.5, 0.5)]);
    const next = tr.update(33, [{ ...ball(33, 0.51, 0.5), source: 'color' }, { ...ball(33, 0.53, 0.5), source: 'detector' }]);
    expect(next?.source).toBe('detector');
  });
});

describe('ball colour blob', () => {
  const orange = rgbToLab(240, 120, 30);
  function image(w: number, h: number, paint: [number, number][]) {
    const d = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) d.set([60, 140, 60, 255], i * 4); // grass
    for (const [x, y] of paint) d.set([240, 120, 30, 255], (y * w + x) * 4);
    return d;
  }

  it('finds the ball-coloured blob and ignores a stray pixel', () => {
    const px: [number, number][] = [[1, 1]];
    for (let y = 5; y < 9; y++) for (let x = 10; x < 14; x++) px.push([x, y]);
    const blob = findColorBlob(image(20, 20, px), 20, { x0: 0, y0: 0, x1: 20, y1: 20 }, orange);
    expect(blob?.x).toBeCloseTo(11.5);
    expect(blob?.y).toBeCloseTo(6.5);
    expect(blob?.count).toBe(16);
  });

  it('returns nothing when the colour is absent', () => {
    expect(findColorBlob(image(20, 20, []), 20, { x0: 0, y0: 0, x1: 20, y1: 20 }, orange)).toBeNull();
  });

  it('refuses white/grey balls as a tracking colour', () => {
    expect(isTrackableColor(rgbToLab(245, 245, 245))).toBe(false);
    expect(isTrackableColor(orange)).toBe(true);
  });
});

// Side-on pitch: left goal at the left edge, right goal at the right edge.
// Mouths (goal lines): x = 0.10 for the left goal, x = 0.90 for the right goal.
const LEFT = { x: 0.02, y: 0.45, w: 0.08, h: 0.2 };
const RIGHT = { x: 0.9, y: 0.45, w: 0.08, h: 0.2 };

function feed(w: GoalWatcher | BasketWatcher, balls: (BallObs | null)[], t0 = 0) {
  const verdicts = [];
  let t = t0;
  for (const b of balls) {
    t = b ? b.t : t + 33;
    const u = w.update(t, b);
    if (u.verdict) verdicts.push(u.verdict);
  }
  return verdicts;
}

describe('goal-line geometry', () => {
  it('finds which edge a path enters a box through', () => {
    expect(segmentEntry({ x: 0.5, y: 0.55 }, { x: 0.95, y: 0.55 }, RIGHT)).toMatchObject({ edge: 'left' });
    expect(segmentEntry({ x: 0.94, y: 0.3 }, { x: 0.94, y: 0.55 }, RIGHT)).toMatchObject({ edge: 'top' });
    expect(segmentEntry({ x: 0.5, y: 0.2 }, { x: 0.6, y: 0.3 }, RIGHT)).toBeNull();
    expect(segmentEntry({ x: 0.95, y: 0.5 }, { x: 0.96, y: 0.5 }, RIGHT)).toBeNull(); // starts inside
  });
});

describe('football goal watcher', () => {
  it('calls a goal when the ball crosses the goal line under the bar', () => {
    const v = feed(new GoalWatcher([LEFT, RIGHT]), path(0, [0.5, 0.55], [0.95, 0.55], 600));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ outcome: 'scored', goal: 'right' });
  });

  it('catches a fast shot that skips past the goal box between two frames', () => {
    const v = feed(new GoalWatcher([LEFT, RIGHT]), [ball(0, 0.7, 0.55), ball(33, 0.84, 0.56), ball(66, 0.995, 0.57)]);
    expect(v).toMatchObject([{ outcome: 'scored', goal: 'right' }]);
  });

  it('a ball dropping in over the bar and sitting behind the goal is never a goal', () => {
    const balls = [...path(0, [0.8, 0.2], [0.94, 0.3], 200), ...path(233, [0.94, 0.3], [0.95, 0.6], 300), ...Array.from({ length: 40 }, (_, i) => ball(600 + i * 33, 0.95, 0.6))];
    expect(feed(new GoalWatcher([LEFT, RIGHT]), balls)).toHaveLength(0);
  });

  it('a shot along the front of the goal that stays outside is not a goal', () => {
    expect(feed(new GoalWatcher([LEFT, RIGHT]), path(0, [0.86, 0.2], [0.86, 0.8], 600))).toHaveLength(0);
  });

  it('with a measured ball size, a ball passing much closer to the camera is referred to the players', () => {
    const w = new GoalWatcher([LEFT, RIGHT], { ballR: [null, 0.03] });
    const nearCamera = path(0, [0.5, 0.55], [0.95, 0.55], 600).map((b) => ({ ...b, r: 0.06 }));
    const v = feed(w, nearCamera);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ outcome: 'uncertain', goal: 'right' });
    expect(v[0].reason).toMatch(/in front/);
  });

  it('with a measured ball size, a ball at the goal’s distance is a clean goal', () => {
    const v = feed(new GoalWatcher([LEFT, RIGHT], { ballR: [null, 0.03] }), path(0, [0.5, 0.55], [0.95, 0.55], 600));
    expect(v[0]).toMatchObject({ outcome: 'scored' });
  });

  it('asks when the ball shows up in the goal but the crossing was missed', () => {
    const balls = [ball(0, 0.6, 0.55), ...Array.from({ length: 5 }, (_, i) => ball(1200 + i * 33, 0.95, 0.6))];
    const v = feed(new GoalWatcher([LEFT, RIGHT]), balls);
    expect(v).toMatchObject([{ outcome: 'uncertain', goal: 'right' }]);
  });

  it('asks when the ball is lost just in front of a goal while heading in', () => {
    const balls: (BallObs | null)[] = [...path(0, [0.5, 0.55], [0.85, 0.55], 300), ...Array(40).fill(null)];
    const v = feed(new GoalWatcher([LEFT, RIGHT]), balls);
    expect(v).toMatchObject([{ outcome: 'uncertain', goal: 'right' }]);
  });

  it('does not ask when the ball is lost in mid-field', () => {
    const balls: (BallObs | null)[] = [...path(0, [0.3, 0.55], [0.5, 0.55], 300), ...Array(40).fill(null)];
    expect(feed(new GoalWatcher([LEFT, RIGHT]), balls)).toHaveLength(0);
  });

  it('counts one goal while the ball sits in the net, then re-arms after the restart', () => {
    const w = new GoalWatcher([LEFT, RIGHT]);
    const goal = [...path(0, [0.4, 0.55], [0.05, 0.55], 300), ...Array.from({ length: 60 }, (_, i) => ball(333 + i * 33, 0.05, 0.55))];
    expect(feed(w, goal)).toHaveLength(1);
    const restart = Array.from({ length: 30 }, (_, i) => ball(3000 + i * 33, 0.5, 0.55));
    const second = path(4100, [0.5, 0.55], [0.95, 0.55], 600);
    const v = feed(w, [...restart, ...second]);
    expect(v).toHaveLength(1);
    expect(v[0].goal).toBe('right');
  });

  it('a ball lingering near the goal after a goal does not re-arm', () => {
    const w = new GoalWatcher([LEFT, RIGHT]);
    feed(w, path(0, [0.5, 0.55], [0.05, 0.55], 600));
    const nearGoal = Array.from({ length: 60 }, (_, i) => ball(1000 + i * 33, i % 2 ? 0.05 : 0.13, 0.55));
    expect(feed(w, nearGoal)).toHaveLength(0);
  });
});

const RIM = { x: 0.6, y: 0.3, w: 0.1, h: 0.04 };

describe('basketball', () => {
  const arc = (endX: number) => [
    ...path(0, [0.2, 0.6], [0.5, 0.1], 500),
    ...path(533, [0.5, 0.1], [endX, 0.25], 300),
    ...path(866, [endX, 0.25], [endX, 0.5], 300),
  ];

  it('scores a ball that drops through the rim', () => {
    expect(judgeBasket(arc(0.65), RIM)).toMatchObject({ outcome: 'scored' });
  });

  it('misses a ball that comes down beside the rim', () => {
    expect(judgeBasket(arc(0.8), RIM)).toMatchObject({ outcome: 'not-scored' });
  });

  it('is unsure when the ball is lost near the rim', () => {
    const track = [...path(0, [0.2, 0.6], [0.62, 0.2], 500), ball(1500, 0.64, 0.5)];
    expect(judgeBasket(track, RIM).outcome).toBe('uncertain');
  });

  it('watcher ignores dribbling below the rim', () => {
    const w = new BasketWatcher(RIM);
    for (let t = 0; t < 3000; t += 33) expect(w.update(t, ball(t, 0.3, 0.7)).verdict).toBeUndefined();
  });

  it('watcher produces one verdict per shot and reports when the shot started', () => {
    const v = feed(new BasketWatcher(RIM), [...arc(0.65), ...Array.from({ length: 80 }, (_, i) => ball(1200 + i * 33, 0.65, 0.8))]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ outcome: 'scored' });
    expect(v[0].startedAt).toBeGreaterThan(0);
  });
});

describe('shirt colours', () => {
  const red = rgbToLab(200, 30, 40);
  const blue = rgbToLab(30, 60, 190);

  it('matches a shirt to the closer team colour, tolerating lighting', () => {
    expect(classifyColor(rgbToLab(150, 25, 30), [red, blue])).toBe(0); // red in shade
    expect(classifyColor(rgbToLab(60, 90, 230), [red, blue])).toBe(1);
  });

  it('refuses to classify a colour that matches neither team', () => {
    expect(classifyColor(rgbToLab(40, 180, 40), [red, blue])).toBeNull();
  });

  it('attributes a shot to the team of the person holding the ball before release', () => {
    const shooter = { box: { x: 0.1, y: 0.3, w: 0.15, h: 0.6 }, color: red, css: '' };
    const defender = { box: { x: 0.5, y: 0.3, w: 0.15, h: 0.6 }, color: blue, css: '' };
    const frames = Array.from({ length: 30 }, (_, i) => ({ t: i * 33, people: [shooter, defender] }));
    const trail = Array.from({ length: 30 }, (_, i) => ball(i * 33, 0.18, 0.45 - i * 0.01));
    expect(attributeShot(900, trail, frames, [red, blue])).toBe(0);
  });

  it('returns null when nobody is near the ball', () => {
    const frames = Array.from({ length: 30 }, (_, i) => ({ t: i * 33, people: [] }));
    const trail = Array.from({ length: 30 }, (_, i) => ball(i * 33, 0.5, 0.5));
    expect(attributeShot(900, trail, frames, [red, blue])).toBeNull();
  });
});

describe('match rules', () => {
  const cfg = (o: Partial<MatchConfig> = {}): MatchConfig => ({
    teams: [
      { name: 'Reds', players: ['Ana'] },
      { name: 'Blues', players: ['Bia', 'Caio'] },
    ],
    durationMs: 600_000,
    targetPoints: null,
    ...o,
  });
  const goal = (s: MatchState, id: number, team: 0 | 1, points = 1, scorer?: number | null) =>
    addScore(s, { id, team, points, label: 'GOAL', source: 'camera', scorer }).state;

  it('keeps each side’s score and credits the only player automatically', () => {
    let s = newMatch(cfg());
    s = goal(s, 1, 0);
    s = goal(s, 2, 1);
    s = goal(s, 3, 0);
    expect(s.scores).toEqual([2, 1]);
    expect(s.events[0].scorer).toBe(0); // Ana is Reds' only player
    expect(s.events[1].scorer).toBeNull(); // Blues has two players — needs a tap
  });

  it('ignores duplicate events', () => {
    const s = goal(goal(newMatch(cfg()), 1, 0), 1, 0);
    expect(s.scores).toEqual([1, 0]);
  });

  it('ends at full time with the leader winning, or a draw', () => {
    let s = goal(newMatch(cfg()), 1, 1);
    s = tick(s, 599_000);
    expect(s.finished).toBe(false);
    s = tick(s, 2_000);
    expect(s).toMatchObject({ finished: true, winner: 1, endReason: 'time', clockMs: 600_000 });
    expect(tick(newMatch(cfg()), 700_000).winner).toBeNull();
  });

  it('ends when a side reaches the target and rejects later scores', () => {
    let s = newMatch(cfg({ targetPoints: 5 }));
    s = goal(s, 1, 0, 2);
    s = goal(s, 2, 0, 3);
    expect(s).toMatchObject({ finished: true, winner: 0, endReason: 'target' });
    expect(addScore(s, { id: 3, team: 1, points: 2, label: '', source: 'camera' }).applied).toBe(false);
  });

  it('disallowing the winning basket re-opens the game', () => {
    let s = newMatch(cfg({ targetPoints: 4 }));
    s = goal(s, 1, 0, 2);
    s = goal(s, 2, 0, 2);
    expect(s.finished).toBe(true);
    s = amendScore(s, 2, { disallow: true });
    expect(s).toMatchObject({ finished: false, scores: [2, 0] });
  });

  it('upgrades a basket to a three and credits a scorer', () => {
    let s = goal(newMatch(cfg()), 1, 1, 2);
    s = amendScore(s, 1, { points: 3, scorer: 1 });
    expect(s.scores).toEqual([0, 3]);
    expect(boxScore(s).mvp).toEqual([{ team: 1, name: 'Caio', points: 3, scores: 1 }]);
  });

  it('picks the MVP by points, shares ties, and reports uncredited points', () => {
    let s = newMatch(cfg());
    s = goal(s, 1, 0); // Ana
    s = goal(s, 2, 1, 1, 0); // Bia
    s = goal(s, 3, 1); // uncredited
    const box = boxScore(s);
    expect(box.mvp.map((p) => p.name).sort()).toEqual(['Ana', 'Bia']);
    expect(box.uncredited).toEqual([0, 1]);
  });

  it('has no MVP when nobody scored', () => {
    expect(boxScore(endMatch(newMatch(cfg()))).mvp).toEqual([]);
  });

  it('tracks shooting attempts per side', () => {
    let s = newMatch(cfg());
    s = recordAttempt(s, { id: 1, team: 0, made: true });
    s = recordAttempt(s, { id: 2, team: 0, made: false });
    s = recordAttempt(s, { id: 2, team: 0, made: false }); // duplicate
    expect(boxScore(s).attempts[0]).toEqual({ made: 1, total: 2 });
  });

  it('rejects invalid point values', () => {
    expect(() => addScore(newMatch(cfg()), { id: 1, team: 0, points: 0, label: '', source: 'camera' })).toThrow(RangeError);
  });
});
