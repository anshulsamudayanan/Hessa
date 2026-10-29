/**
 * Al Dama rules engine (Gulf / Turkish-family draughts on all 64 squares).
 * Pure and deterministic: legality and the winner are decided here, never by AI.
 *
 * Variant implemented (configurable below; confirm with local players):
 *  - 16 pieces each, on each side's 2nd and 3rd rows; back rows start empty.
 *  - Men move one square forward or sideways — never diagonally or backward.
 *  - Men capture by jumping an adjacent enemy forward or sideways.
 *  - Kings ("dama") move any distance orthogonally and capture at a distance,
 *    landing on any empty square beyond the captured piece.
 *  - Captures are compulsory and you must take the maximum number of pieces.
 *  - Captured pieces are removed as they are jumped; a king may not reverse
 *    direction (180°) between two jumps.
 *  - A man reaching the far row is crowned at the end of its move.
 *  - You lose when you have no pieces or no legal move.
 */

export type Player = 0 | 1;

export interface Piece {
  owner: Player;
  king: boolean;
}

export type Board = (Piece | null)[]; // 64 squares, index = row * 8 + col, row 0 at the top

export interface Move {
  from: number;
  /** Landing squares, in order. Length 1 for a simple move. */
  path: number[];
  captures: number[];
}

export interface DamaState {
  board: Board;
  turn: Player;
  moveCount: number;
  winner: Player | null;
  draw: boolean;
  lastMove: Move | null;
}

export const DAMA_RULES = {
  maximumCapture: true,
  promoteDuringCapture: false,
};

const SIZE = 8;
const rc = (sq: number) => [Math.floor(sq / SIZE), sq % SIZE] as const;
const sq = (r: number, c: number) => r * SIZE + c;
const onBoard = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

/** Player 0 (light) starts at the bottom and moves up (row − 1). */
export const forward = (p: Player) => (p === 0 ? -1 : 1);
const farRow = (p: Player) => (p === 0 ? 0 : SIZE - 1);

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

export function initialBoard(): Board {
  const b: Board = Array(64).fill(null);
  for (let c = 0; c < SIZE; c++) {
    b[sq(1, c)] = { owner: 1, king: false };
    b[sq(2, c)] = { owner: 1, king: false };
    b[sq(5, c)] = { owner: 0, king: false };
    b[sq(6, c)] = { owner: 0, king: false };
  }
  return b;
}

export function newGame(): DamaState {
  return { board: initialBoard(), turn: 0, moveCount: 0, winner: null, draw: false, lastMove: null };
}

function manDirs(owner: Player) {
  return DIRS.filter(([dr]) => dr !== -forward(owner)); // forward + sideways, never backward
}

function captureSequences(board: Board, from: number, piece: Piece): Move[] {
  const results: Move[] = [];
  const walk = (b: Board, at: number, path: number[], caps: number[], lastDir: readonly [number, number] | null) => {
    let extended = false;
    const [r, c] = rc(at);
    const dirs = piece.king ? DIRS : manDirs(piece.owner);
    for (const d of dirs) {
      if (piece.king && lastDir && d[0] === -lastDir[0] && d[1] === -lastDir[1]) continue; // no 180° turn
      if (piece.king) {
        let rr = r + d[0];
        let cc = c + d[1];
        while (onBoard(rr, cc) && !b[sq(rr, cc)]) {
          rr += d[0];
          cc += d[1];
        }
        if (!onBoard(rr, cc)) continue;
        const victim = b[sq(rr, cc)]!;
        if (victim.owner === piece.owner) continue;
        let lr = rr + d[0];
        let lc = cc + d[1];
        while (onBoard(lr, lc) && !b[sq(lr, lc)]) {
          const nb = b.slice();
          nb[at] = null;
          nb[sq(rr, cc)] = null;
          nb[sq(lr, lc)] = piece;
          extended = true;
          walk(nb, sq(lr, lc), [...path, sq(lr, lc)], [...caps, sq(rr, cc)], d);
          lr += d[0];
          lc += d[1];
        }
      } else {
        const vr = r + d[0];
        const vc = c + d[1];
        const lr = vr + d[0];
        const lc = vc + d[1];
        if (!onBoard(lr, lc)) continue;
        const victim = b[sq(vr, vc)];
        if (!victim || victim.owner === piece.owner || b[sq(lr, lc)]) continue;
        const nb = b.slice();
        nb[at] = null;
        nb[sq(vr, vc)] = null;
        nb[sq(lr, lc)] = piece;
        extended = true;
        walk(nb, sq(lr, lc), [...path, sq(lr, lc)], [...caps, sq(vr, vc)], d);
      }
    }
    if (!extended && caps.length) results.push({ from, path, captures: caps });
  };
  walk(board, from, [], [], null);
  return results;
}

function simpleMoves(board: Board, from: number, piece: Piece): Move[] {
  const out: Move[] = [];
  const [r, c] = rc(from);
  for (const d of piece.king ? DIRS : manDirs(piece.owner)) {
    let rr = r + d[0];
    let cc = c + d[1];
    while (onBoard(rr, cc) && !board[sq(rr, cc)]) {
      out.push({ from, path: [sq(rr, cc)], captures: [] });
      if (!piece.king) break;
      rr += d[0];
      cc += d[1];
    }
  }
  return out;
}

export function legalMoves(state: DamaState): Move[] {
  if (state.winner !== null || state.draw) return [];
  const { board, turn } = state;
  const captures: Move[] = [];
  const quiet: Move[] = [];
  board.forEach((p, i) => {
    if (!p || p.owner !== turn) return;
    captures.push(...captureSequences(board, i, p));
    quiet.push(...simpleMoves(board, i, p));
  });
  if (!captures.length) return quiet;
  if (!DAMA_RULES.maximumCapture) return captures;
  const max = Math.max(...captures.map((m) => m.captures.length));
  return captures.filter((m) => m.captures.length === max);
}

const sameMove = (a: Move, b: Move) => a.from === b.from && a.path.length === b.path.length && a.path.every((s, i) => s === b.path[i]);

export function applyMove(state: DamaState, move: Move): DamaState {
  const legal = legalMoves(state).find((m) => sameMove(m, move));
  if (!legal) throw new Error('Illegal move');
  const board = state.board.slice();
  const piece = board[legal.from]!;
  board[legal.from] = null;
  legal.captures.forEach((c) => (board[c] = null));
  const to = legal.path[legal.path.length - 1];
  const crowned = !piece.king && rc(to)[0] === farRow(piece.owner);
  board[to] = { ...piece, king: piece.king || crowned };
  const next: DamaState = { board, turn: piece.owner === 0 ? 1 : 0, moveCount: state.moveCount + 1, winner: null, draw: false, lastMove: legal };
  if (!legalMoves(next).length) next.winner = piece.owner; // opponent has no pieces or is blocked
  return next;
}

export function agreeDraw(state: DamaState): DamaState {
  return state.winner !== null ? state : { ...state, draw: true };
}

export const countPieces = (b: Board, p: Player) => b.filter((x) => x?.owner === p).length;

/** Moves still consistent with the squares tapped so far (for step-by-step input). */
export function movesWithPrefix(moves: Move[], from: number, prefix: number[]): Move[] {
  return moves.filter((m) => m.from === from && prefix.every((s, i) => m.path[i] === s));
}

export const squareOf = sq;
