/**
 * Qif rules engine. Each player sings once per round; stopping within the
 * reaction window scores a point. Most points wins; ties are broken by the
 * fastest average stop. "Not singing" or "too noisy" turns are replayed, never scored.
 */

export interface QifTurn {
  id: number;
  player: number;
  round: number;
  passed: boolean;
  reactionMs: number | null;
}

export interface QifState {
  players: string[];
  rounds: number;
  turns: QifTurn[];
  finished: boolean;
}

export function newQif(players: string[], rounds: number): QifState {
  if (players.length < 2) throw new RangeError('Qif needs at least 2 players');
  return { players, rounds, turns: [], finished: false };
}

export const currentPlayer = (s: QifState) => s.turns.length % s.players.length;
export const currentRound = (s: QifState) => Math.floor(s.turns.length / s.players.length) + 1;

export function recordTurn(s: QifState, t: { id: number; passed: boolean; reactionMs: number | null }): QifState {
  if (s.finished || s.turns.some((x) => x.id === t.id)) return s;
  const turns = [...s.turns, { ...t, player: currentPlayer(s), round: currentRound(s) }];
  return { ...s, turns, finished: turns.length >= s.players.length * s.rounds };
}

export interface QifStanding {
  player: number;
  name: string;
  points: number;
  avgReactionMs: number | null;
}

export function standings(s: QifState): QifStanding[] {
  return s.players
    .map((name, player) => {
      const mine = s.turns.filter((t) => t.player === player);
      const passes = mine.filter((t) => t.passed && t.reactionMs !== null);
      return {
        player,
        name,
        points: mine.filter((t) => t.passed).length,
        avgReactionMs: passes.length ? passes.reduce((a, t) => a + t.reactionMs!, 0) / passes.length : null,
      };
    })
    .sort((a, b) => b.points - a.points || (a.avgReactionMs ?? Infinity) - (b.avgReactionMs ?? Infinity));
}

/** Winners (more than one only if points and average reaction are exactly equal). */
export function winners(s: QifState): QifStanding[] {
  const st = standings(s);
  const top = st[0];
  return st.filter((x) => x.points === top.points && x.avgReactionMs === top.avgReactionMs);
}
