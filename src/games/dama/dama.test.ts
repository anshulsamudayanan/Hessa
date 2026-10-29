import { describe, expect, it } from 'vitest';
import { agreeDraw, applyMove, countPieces, legalMoves, movesWithPrefix, newGame, squareOf as sq, type Board, type DamaState, type Piece } from './rules';

const man = (owner: 0 | 1): Piece => ({ owner, king: false });
const king = (owner: 0 | 1): Piece => ({ owner, king: true });

function position(pieces: [number, number, Piece][], turn: 0 | 1 = 0): DamaState {
  const board: Board = Array(64).fill(null);
  pieces.forEach(([r, c, p]) => (board[sq(r, c)] = p));
  return { board, turn, moveCount: 0, winner: null, draw: false, lastMove: null };
}

describe('Al Dama rules', () => {
  it('starts with 16 pieces each and 8 forward moves for the first player', () => {
    const g = newGame();
    expect(countPieces(g.board, 0)).toBe(16);
    expect(countPieces(g.board, 1)).toBe(16);
    const moves = legalMoves(g);
    expect(moves).toHaveLength(8);
    expect(moves.every((m) => m.path[0] === m.from - 8)).toBe(true);
  });

  it('men move forward or sideways, never backward or diagonally', () => {
    const g = position([[4, 4, man(0)], [0, 0, man(1)]]);
    const targets = legalMoves(g).map((m) => m.path[0]).sort((a, b) => a - b);
    expect(targets).toEqual([sq(3, 4), sq(4, 3), sq(4, 5)].sort((a, b) => a - b));
  });

  it('captures are compulsory', () => {
    const g = position([[4, 4, man(0)], [3, 4, man(1)], [6, 0, man(0)]]);
    const moves = legalMoves(g);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ from: sq(4, 4), path: [sq(2, 4)], captures: [sq(3, 4)] });
  });

  it('men cannot capture backward', () => {
    const g = position([[4, 4, man(0)], [5, 4, man(1)]]);
    expect(legalMoves(g).every((m) => m.captures.length === 0)).toBe(true);
  });

  it('multi-captures chain and the maximum capture is mandatory', () => {
    // Piece A can take 1; piece B can take 2 in a chain → only B's capture is legal.
    const g = position([
      [6, 0, man(0)], [5, 0, man(1)], // A: single
      [6, 5, man(0)], [5, 5, man(1)], [4, 6, man(1)], // B: (6,5) x(5,5) → (4,5) x(4,6) → (4,7)
    ]);
    const moves = legalMoves(g);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ from: sq(6, 5), path: [sq(4, 5), sq(4, 7)], captures: [sq(5, 5), sq(4, 6)] });
    const after = applyMove(g, moves[0]);
    expect(countPieces(after.board, 1)).toBe(1);
  });

  it('kings fly and capture at a distance, landing on any square beyond', () => {
    const g = position([[7, 0, king(0)], [3, 0, man(1)], [7, 7, man(1)]]);
    const caps = legalMoves(g);
    // (7,7) along the bottom row has no square beyond it, so only the file capture exists.
    expect(caps.map((m) => m.path[0]).sort((a, b) => a - b)).toEqual([sq(0, 0), sq(1, 0), sq(2, 0)]);
  });

  it('kings may not turn back 180° mid-capture', () => {
    // Enemies on both sides of the king along one row: taking both would need a 180° reversal.
    const g = position([[4, 4, king(0)], [4, 6, man(1)], [4, 2, man(1)]]);
    const moves = legalMoves(g);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.captures.length === 1)).toBe(true);
  });

  it('crowns a man that reaches the far row', () => {
    const g = position([[1, 3, man(0)], [7, 7, man(1)]]);
    const after = applyMove(g, { from: sq(1, 3), path: [sq(0, 3)], captures: [] });
    expect(after.board[sq(0, 3)]).toEqual(king(0));
  });

  it('wins by capturing the last piece', () => {
    const g = position([[4, 4, man(0)], [3, 4, man(1)]]);
    const after = applyMove(g, legalMoves(g)[0]);
    expect(after.winner).toBe(0);
    expect(legalMoves(after)).toHaveLength(0);
  });

  it('wins when the opponent is blocked', () => {
    // Black man on (6,0) can only go down to (7,0) or sideways to (6,1); both are blocked and (6,2) stops a capture.
    // (5,0) is filled so light has no compulsory capture of its own.
    const g = position([[6, 0, man(1)], [7, 0, man(0)], [6, 1, man(0)], [6, 2, man(0)], [5, 0, man(0)], [5, 5, man(0)]], 0);
    const after = applyMove(g, { from: sq(5, 5), path: [sq(4, 5)], captures: [] });
    expect(after.winner).toBe(0);
  });

  it('rejects illegal moves', () => {
    expect(() => applyMove(newGame(), { from: sq(5, 0), path: [sq(3, 0)], captures: [] })).toThrow('Illegal move');
  });

  it('filters candidate moves by tapped prefix for step-by-step input', () => {
    const g = position([[6, 5, man(0)], [5, 5, man(1)], [4, 6, man(1)]]);
    const moves = legalMoves(g);
    expect(movesWithPrefix(moves, sq(6, 5), [sq(4, 5)])).toHaveLength(1);
    expect(movesWithPrefix(moves, sq(6, 5), [sq(4, 4)])).toHaveLength(0);
  });

  it('a draw can be agreed', () => {
    const g = agreeDraw(newGame());
    expect(g.draw).toBe(true);
    expect(legalMoves(g)).toHaveLength(0);
  });
});
