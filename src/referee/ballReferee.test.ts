import { describe, expect, it } from 'vitest';
import { BallTracker, type BallObs } from './ballTracker';
import { addScore, amendScore, boxScore, endMatch, newMatch, recordAttempt, tick, type MatchConfig, type MatchState } from './matchRules';
import { BasketWatcher, GoalWatcher, judgeBasket } from './shotWatcher';
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
});

// Side-on pitch: left goal at the left edge, right goal at the right edge.
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

describe('football goal watcher', () => {
  it('calls a goal in the right goal', () => {
    const v = feed(new GoalWatcher([LEFT, RIGHT]), path(0, [0.5, 0.55], [0.95, 0.55], 600));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ outcome: 'scored', goal: 'right' });
  });

  it('does not count a ball that only clips the goal box for one frame', () => {
    const balls = [...path(0, [0.5, 0.55], [0.88, 0.55], 400), ball(433, 0.91, 0.55), ...path(466, [0.85, 0.55], [0.6, 0.55], 300)];
    expect(feed(new GoalWatcher([LEFT, RIGHT]), balls)).toHaveLength(0);
  });

  it('counts one goal while the ball sits in the net, then re-arms after the restart', () => {
    const w = new GoalWatcher([LEFT, RIGHT]);
    const sitInNet = Array.from({ length: 60 }, (_, i) => ball(i * 33, 0.05, 0.55));
    expect(feed(w, sitInNet)).toHaveLength(1);
    // Kick-off from the middle, then a goal at the other end.
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
