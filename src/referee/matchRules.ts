/**
 * Rules engine for refereed two-sided matches (football, basketball). Deterministic:
 * it only records score events the referee (or players, marked as such) report,
 * keeps the clock (in one or two halves, stopping at half-time), ends the match
 * on time or target, and computes the box score and MVP. Team A = 0, Team B = 1.
 */

export type TeamIndex = 0 | 1;
export type ScoreSource = 'camera' | 'players';

export interface Team {
  name: string;
  players: string[];
}

export interface ScoreEvent {
  id: number;
  team: TeamIndex;
  /** Index into the team's players, or null if nobody was credited. */
  scorer: number | null;
  points: number;
  label: string;
  atMs: number;
  /** 1 = first half (or the only period), 2 = second half. */
  period: number;
  source: ScoreSource;
}

export interface AttemptEvent {
  id: number;
  team: TeamIndex | null;
  made: boolean;
  period?: number;
}

export interface MatchConfig {
  teams: [Team, Team];
  durationMs: number;
  /** First to this many points wins (basketball street rules). null = time only. */
  targetPoints: number | null;
  /** 1 = one period, 2 = two halves with a half-time break. Defaults to 1. */
  periods?: number;
}

export interface MatchState extends MatchConfig {
  periods: number;
  /** Total elapsed playing time across periods. */
  clockMs: number;
  period: number;
  /** Clock stopped between halves, waiting for the second half to start. */
  atBreak: boolean;
  events: ScoreEvent[];
  attempts: AttemptEvent[];
  scores: [number, number];
  finished: boolean;
  /** null when finished level. */
  winner: TeamIndex | null;
  endReason: 'time' | 'target' | 'ended' | null;
}

export function newMatch(cfg: MatchConfig): MatchState {
  const periods = Math.max(1, Math.round(cfg.periods ?? 1));
  return { ...cfg, periods, clockMs: 0, period: 1, atBreak: false, events: [], attempts: [], scores: [0, 0], finished: false, winner: null, endReason: null };
}

export const periodLength = (s: Pick<MatchState, 'durationMs' | 'periods'>) => s.durationMs / s.periods;

/** Time left in the current period (half), in ms. */
export const timeLeftInPeriod = (s: MatchState) => Math.max(0, periodLength(s) * s.period - s.clockMs);

/** Points per team in a given period. */
export function periodScores(s: MatchState, period: number): [number, number] {
  return totals(s.events.filter((e) => e.period === period));
}

const totals = (events: ScoreEvent[]): [number, number] => [
  events.filter((e) => e.team === 0).reduce((s, e) => s + e.points, 0),
  events.filter((e) => e.team === 1).reduce((s, e) => s + e.points, 0),
];

const leader = (s: [number, number]): TeamIndex | null => (s[0] === s[1] ? null : s[0] > s[1] ? 0 : 1);

function finish(state: MatchState, endReason: MatchState['endReason']): MatchState {
  return { ...state, finished: true, endReason, winner: leader(state.scores) };
}

export function addScore(
  state: MatchState,
  e: { id: number; team: TeamIndex; points: number; label: string; source: ScoreSource; scorer?: number | null },
): { state: MatchState; applied: boolean } {
  if (state.finished || state.atBreak || state.events.some((x) => x.id === e.id)) return { state, applied: false };
  if (!Number.isInteger(e.points) || e.points < 1) throw new RangeError('Points must be a positive integer');
  const soleScorer = state.teams[e.team].players.length === 1 ? 0 : null;
  const event: ScoreEvent = { ...e, scorer: e.scorer ?? soleScorer, atMs: state.clockMs, period: state.period };
  const events = [...state.events, event];
  let next: MatchState = { ...state, events, scores: totals(events) };
  if (state.targetPoints !== null && next.scores[e.team] >= state.targetPoints) next = finish(next, 'target');
  return { state: next, applied: true };
}

export function recordAttempt(state: MatchState, a: AttemptEvent): MatchState {
  if (state.finished || state.attempts.some((x) => x.id === a.id)) return state;
  return { ...state, attempts: [...state.attempts, { ...a, period: state.period }] };
}

/** Correct the last call: credit a scorer, change the value, or disallow it. */
export function amendScore(state: MatchState, id: number, change: { scorer?: number | null; points?: number; disallow?: boolean }): MatchState {
  const target = state.events.find((e) => e.id === id);
  if (!target) return state;
  const events = change.disallow
    ? state.events.filter((e) => e.id !== id)
    : state.events.map((e) => (e.id === id ? { ...e, scorer: change.scorer !== undefined ? change.scorer : e.scorer, points: change.points ?? e.points } : e));
  const scores = totals(events);
  const next = { ...state, events, scores };
  // A disallowed winning basket re-opens the match.
  if (state.endReason === 'target' && state.targetPoints !== null && Math.max(...scores) < state.targetPoints) {
    return { ...next, finished: false, endReason: null, winner: null };
  }
  return state.finished ? { ...next, winner: leader(scores) } : next;
}

export function tick(state: MatchState, elapsedMs: number): MatchState {
  if (state.finished || state.atBreak) return state;
  const periodEnd = periodLength(state) * state.period;
  const clockMs = Math.min(periodEnd, state.clockMs + elapsedMs);
  const next = { ...state, clockMs };
  if (clockMs < periodEnd) return next;
  return state.period < state.periods ? { ...next, atBreak: true } : finish(next, 'time');
}

/** Kick off the next half after the break. */
export function startNextPeriod(state: MatchState): MatchState {
  if (!state.atBreak || state.finished) return state;
  return { ...state, atBreak: false, period: state.period + 1 };
}

export function endMatch(state: MatchState): MatchState {
  return state.finished ? state : finish(state, 'ended');
}

export interface PlayerLine {
  team: TeamIndex;
  name: string;
  points: number;
  scores: number;
}

export interface BoxScore {
  players: PlayerLine[];
  uncredited: [number, number];
  mvp: PlayerLine[];
  attempts: [{ made: number; total: number }, { made: number; total: number }];
}

/** Per-player points and MVP (most points; ties share it; nobody if no one scored). */
export function boxScore(state: MatchState): BoxScore {
  const players: PlayerLine[] = state.teams.flatMap((t, ti) =>
    t.players.map((name, pi) => {
      const mine = state.events.filter((e) => e.team === ti && e.scorer === pi);
      return { team: ti as TeamIndex, name, points: mine.reduce((s, e) => s + e.points, 0), scores: mine.length };
    }),
  );
  const uncredited: [number, number] = [0, 1].map((ti) =>
    state.events.filter((e) => e.team === ti && e.scorer === null).reduce((s, e) => s + e.points, 0),
  ) as [number, number];
  const top = Math.max(0, ...players.map((p) => p.points));
  const mvp = top > 0 ? players.filter((p) => p.points === top) : [];
  const attempts = [0, 1].map((ti) => {
    const mine = state.attempts.filter((a) => a.team === ti);
    return { made: mine.filter((a) => a.made).length, total: mine.length };
  }) as BoxScore['attempts'];
  return { players: [...players].sort((a, b) => b.points - a.points), uncredited, mvp, attempts };
}

export const formatClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
