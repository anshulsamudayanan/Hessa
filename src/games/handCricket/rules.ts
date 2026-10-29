/**
 * Hand cricket rules engine. Deterministic and independent of the camera: it is
 * only ever given two numbers that the referee actually detected (or that the
 * players entered manually, which is recorded as such).
 */

export type PlayerIndex = 0 | 1;

export interface BallRecord {
  eventId: number;
  innings: 1 | 2;
  batter: PlayerIndex;
  batterShow: number;
  bowlerShow: number;
  runs: number;
  out: boolean;
  source: 'camera' | 'manual';
}

export interface MatchResult {
  winner: PlayerIndex | null; // null = tie
  text: string;
}

export interface HandCricketState {
  players: [string, string];
  innings: 1 | 2;
  batting: PlayerIndex;
  scores: [number, number];
  target: number | null;
  balls: BallRecord[];
  result: MatchResult | null;
  /** Optional limit (overs × 6). null = each innings lasts until the batter is out. */
  ballsPerInnings: number | null;
}

export interface BallDecision {
  applied: boolean;
  ignoredReason?: 'duplicate' | 'match-over';
  runs: number;
  out: boolean;
  inningsEnded: boolean;
  matchOver: boolean;
  message: string;
}

export function newMatch(players: [string, string], firstBatter: PlayerIndex, overs: number | null = null): HandCricketState {
  return { players, innings: 1, batting: firstBatter, scores: [0, 0], target: null, balls: [], result: null, ballsPerInnings: overs ? overs * 6 : null };
}

/** Balls left in the current innings, or null when there's no overs limit. */
export function ballsLeft(s: HandCricketState): number | null {
  if (s.ballsPerInnings === null) return null;
  return s.ballsPerInnings - s.balls.filter((b) => b.innings === s.innings).length;
}

export interface InningsStats {
  batter: PlayerIndex;
  runs: number;
  balls: number;
  sixes: number;
  fours: number;
  out: boolean;
  /** Runs per over (6 balls). */
  runRate: number;
}

export function inningsStats(s: HandCricketState, innings: 1 | 2): InningsStats | null {
  const balls = s.balls.filter((b) => b.innings === innings);
  if (!balls.length) return null;
  const runs = balls.reduce((t, b) => t + b.runs, 0);
  return {
    batter: balls[0].batter,
    runs,
    balls: balls.length,
    sixes: balls.filter((b) => b.runs === 6).length,
    fours: balls.filter((b) => b.runs === 4).length,
    out: balls.some((b) => b.out),
    runRate: (runs / balls.length) * 6,
  };
}

const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

export function applyBall(
  state: HandCricketState,
  ball: { eventId: number; batterShow: number; bowlerShow: number; source?: 'camera' | 'manual' },
): { state: HandCricketState; decision: BallDecision } {
  const ignored = (reason: 'duplicate' | 'match-over'): { state: HandCricketState; decision: BallDecision } => ({
    state,
    decision: { applied: false, ignoredReason: reason, runs: 0, out: false, inningsEnded: false, matchOver: !!state.result, message: '' },
  });
  if (state.result) return ignored('match-over');
  if (state.balls.some((b) => b.eventId === ball.eventId)) return ignored('duplicate');
  for (const n of [ball.batterShow, ball.bowlerShow]) {
    if (!Number.isInteger(n) || n < 1 || n > 6) throw new RangeError(`Hand cricket numbers must be 1–6, got ${n}`);
  }

  const out = ball.batterShow === ball.bowlerShow;
  const runs = out ? 0 : ball.batterShow;
  const batter = state.batting;
  const scores: [number, number] = [...state.scores];
  scores[batter] += runs;
  const record: BallRecord = { ...ball, source: ball.source ?? 'camera', innings: state.innings, batter, runs, out };
  const next: HandCricketState = { ...state, scores, balls: [...state.balls, record] };
  const name = state.players[batter];
  const detected = `Batter ${ball.batterShow}, Bowler ${ball.bowlerShow}`;

  const runsText = `${runs} run${runs === 1 ? '' : 's'}!`;
  const inningsBalls = next.balls.filter((b) => b.innings === state.innings).length;
  const oversUp = state.ballsPerInnings !== null && inningsBalls >= state.ballsPerInnings;

  if (state.innings === 1) {
    if (!out && !oversUp) return done(next, { runs, out, message: `${detected} — ${runsText}` });
    const target = scores[batter] + 1;
    const how = out ? 'OUT!' : `${runsText} Overs done —`;
    return done(
      { ...next, innings: 2, batting: other(batter), target },
      { runs, out, inningsEnded: true, message: `${detected} — ${how} ${name} made ${scores[batter]}. ${state.players[other(batter)]} needs ${target} to win.` },
    );
  }

  // Second innings: chasing `target`.
  const chaser = batter;
  const setter = other(batter);
  if (!out) {
    if (scores[chaser] >= state.target!) {
      const result = { winner: chaser, text: `${state.players[chaser]} chased it down!` };
      return done({ ...next, result }, { runs, out, matchOver: true, message: `${detected} — ${runsText} ${result.text}` });
    }
    if (!oversUp) return done(next, { runs, out, message: `${detected} — ${runsText}` });
  }
  const result: MatchResult =
    scores[chaser] === scores[setter]
      ? { winner: null, text: 'Scores level — it’s a tie!' }
      : { winner: setter, text: `${state.players[setter]} wins by ${scores[setter] - scores[chaser]} run${scores[setter] - scores[chaser] === 1 ? '' : 's'}!` };
  const how = out ? 'OUT!' : `${runsText} Overs done —`;
  return done({ ...next, result }, { runs, out, inningsEnded: true, matchOver: true, message: `${detected} — ${how} ${result.text}` });
}

function done(
  state: HandCricketState,
  d: { runs: number; out: boolean; message: string; inningsEnded?: boolean; matchOver?: boolean },
): { state: HandCricketState; decision: BallDecision } {
  return { state, decision: { applied: true, inningsEnded: false, matchOver: false, ...d } };
}
