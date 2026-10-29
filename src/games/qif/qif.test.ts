import { describe, expect, it } from 'vitest';
import { judgeStop, noiseFloor, type LevelFrame } from './voice';
import { currentPlayer, currentRound, newQif, recordTurn, standings, winners } from './rules';

const FLOOR = -85;
const VOICE = -50;
const QUIET = -84;

/** Level trace: singing until `voiceUntil`, quiet after, 16 ms frames. */
function trace(stopAt: number, voiceUntil: number, end = stopAt + 3000, start = stopAt - 4000): LevelFrame[] {
  const out: LevelFrame[] = [];
  for (let t = start; t <= end; t += 16) out.push({ t, db: t < voiceUntil ? VOICE : QUIET });
  return out;
}

describe('Qif stop judge', () => {
  const STOP = 10_000;

  it('passes a player who stops quickly and reports the reaction time', () => {
    const v = judgeStop(trace(STOP, STOP + 250), FLOOR, STOP, 600);
    expect(v.outcome).toBe('pass');
    if (v.outcome === 'pass') expect(v.reactionMs).toBeGreaterThanOrEqual(240);
  });

  it('catches a player who keeps singing past the reaction window', () => {
    const v = judgeStop(trace(STOP, STOP + 1400), FLOOR, STOP, 600);
    expect(v.outcome).toBe('fail');
  });

  it('allows stopping right at the edge of the window', () => {
    expect(judgeStop(trace(STOP, STOP + 590), FLOOR, STOP, 600).outcome).toBe('pass');
  });

  it('ignores a short click or breath after stopping', () => {
    const frames = trace(STOP, STOP + 200).map((f) => (f.t >= STOP + 900 && f.t < STOP + 940 ? { ...f, db: VOICE } : f));
    expect(judgeStop(frames, FLOOR, STOP, 600).outcome).toBe('pass');
  });

  it('a stricter window catches a slower stop', () => {
    const frames = trace(STOP, STOP + 650);
    expect(judgeStop(frames, FLOOR, STOP, 900).outcome).toBe('pass');
    expect(judgeStop(frames, FLOOR, STOP, 400).outcome).toBe('fail');
  });

  it('does not score a player who was not actually singing', () => {
    expect(judgeStop(trace(STOP, 0), FLOOR, STOP, 600)).toEqual({ outcome: 'not-singing' });
  });

  it('refuses to judge in a very noisy room', () => {
    expect(judgeStop(trace(STOP, STOP + 100), -30, STOP, 600)).toEqual({ outcome: 'too-noisy' });
  });

  it('estimates the noise floor from quiet frames', () => {
    const quiet = Array.from({ length: 50 }, (_, i) => ({ t: i * 16, db: i === 10 ? -40 : -82 }));
    expect(noiseFloor(quiet)).toBe(-82);
  });
});

describe('Qif rules', () => {
  it('rotates players and rounds and finishes after the last turn', () => {
    let s = newQif(['A', 'B', 'C'], 2);
    expect([currentPlayer(s), currentRound(s)]).toEqual([0, 1]);
    for (let i = 0; i < 5; i++) s = recordTurn(s, { id: i, passed: true, reactionMs: 300 });
    expect([currentPlayer(s), currentRound(s), s.finished]).toEqual([2, 2, false]);
    s = recordTurn(s, { id: 5, passed: true, reactionMs: 300 });
    expect(s.finished).toBe(true);
  });

  it('ignores duplicate turn events', () => {
    let s = newQif(['A', 'B'], 1);
    s = recordTurn(s, { id: 1, passed: true, reactionMs: 200 });
    s = recordTurn(s, { id: 1, passed: true, reactionMs: 200 });
    expect(s.turns).toHaveLength(1);
  });

  it('ranks by points, then by fastest average stop', () => {
    let s = newQif(['A', 'B', 'C'], 2);
    const plays: [boolean, number | null][] = [
      [true, 400], // A
      [true, 250], // B
      [false, null], // C
      [true, 400], // A
      [true, 250], // B
      [true, 100], // C
    ];
    plays.forEach(([passed, reactionMs], i) => (s = recordTurn(s, { id: i, passed, reactionMs })));
    expect(standings(s).map((x) => x.name)).toEqual(['B', 'A', 'C']);
    expect(winners(s).map((x) => x.name)).toEqual(['B']);
  });

  it('needs at least two players', () => {
    expect(() => newQif(['solo'], 3)).toThrow(RangeError);
  });
});
