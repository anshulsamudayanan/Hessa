import { BookOpen, Crown, Flag as FlagIcon, Handshake, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { loadNames, PlayerNames, saveNames } from '@/components/PlayerNames';
import { ResultScreen } from '@/components/ResultScreen';
import { TopBar } from '@/components/TopBar';
import { navigate } from '@/lib/router';
import { agreeDraw, applyMove, countPieces, legalMoves, movesWithPrefix, newGame, type DamaState, type Player } from './rules';

const RULES = [
  'Each player has 16 pieces on their 2nd and 3rd rows. Light moves first.',
  'Pieces move one square forward or sideways — never diagonally, never backward.',
  'Capture by jumping over an enemy piece next to you (forward or sideways) onto the empty square beyond. Keep jumping if you can.',
  'Capturing is compulsory, and you must choose the move that takes the most pieces.',
  'Reach the far row and your piece is crowned a king: it moves any distance in straight lines and captures from a distance, but can’t turn straight back during a capture.',
  'You win when your opponent has no pieces left or no legal move.',
];

export function DamaGame() {
  const [phase, setPhase] = useState<'setup' | 'play' | 'result'>('setup');
  const [names, setNames] = useState(() => loadNames(2));
  const [game, setGame] = useState<DamaState>(newGame);
  const [resigned, setResigned] = useState<Player | null>(null);
  const [moves, setMoves] = useState(0);
  const players = names.map((n, i) => n.trim() || `Player ${i + 1}`) as [string, string];
  const exit = () => navigate('/country/uae');

  if (phase === 'result') {
    const winner = resigned !== null ? (resigned === 0 ? 1 : 0) : game.winner;
    return (
      <div className="min-h-dvh">
        <TopBar title="Al Dama" onBack={exit} backLabel="UAE" />
        <ResultScreen
          headline={winner === null ? 'Draw agreed' : `${players[winner]} wins!`}
          scores={[0, 1].map((p) => ({ name: `${players[p]} pieces`, score: String(countPieces(game.board, p as Player)), winner: winner === p }))}
          summary={
            <p>
              {resigned !== null
                ? `${players[resigned]} resigned`
                : game.draw
                  ? 'Both players agreed a draw'
                  : `${players[winner === 0 ? 1 : 0]} had no legal move left`}{' '}
              after {moves} moves.
            </p>
          }
          onReplay={() => {
            setGame(newGame());
            setResigned(null);
            setMoves(0);
            setPhase('play');
          }}
          onBack={exit}
          backLabel="Back to UAE"
        />
      </div>
    );
  }

  if (phase === 'play') {
    return (
      <DamaBoard
        players={players}
        game={game}
        onMove={(g) => {
          setGame(g);
          setMoves(g.moveCount);
          if (g.winner !== null || g.draw) setTimeout(() => setPhase('result'), 1200);
        }}
        onResign={(p) => {
          setResigned(p);
          setPhase('result');
        }}
        onExit={() => setPhase('setup')}
      />
    );
  }

  return (
    <div className="min-h-dvh">
      <TopBar title="Al Dama الدامة" onBack={exit} backLabel="UAE" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 pb-12">
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="font-display text-xl font-semibold">Players</h2>
          <PlayerNames names={names} onChange={setNames} labels={['Light pieces (moves first)', 'Dark pieces']} />
        </section>
        <section className="card flex flex-col gap-2 p-5">
          <h2 className="font-display text-xl font-semibold">Rules</h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-ink/85">
            {RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
          <p className="mt-1 rounded-2xl bg-dusty/30 p-3 text-sm text-ink/85">
            Dama rules vary between families and regions. This is the common Gulf / Turkish form; if you play differently at home, tell us and
            we’ll add your variant. Hessa checks every move here — the camera isn’t used for Dama yet.
          </p>
        </section>
        <button
          className="btn-primary self-end"
          onClick={() => {
            saveNames(players);
            setGame(newGame());
            setPhase('play');
          }}
        >
          Start game
        </button>
      </div>
    </div>
  );
}

function DamaBoard({
  players,
  game,
  onMove,
  onResign,
  onExit,
}: {
  players: [string, string];
  game: DamaState;
  onMove: (g: DamaState) => void;
  onResign: (p: Player) => void;
  onExit: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [prefix, setPrefix] = useState<number[]>([]);
  const [showRules, setShowRules] = useState(false);
  const [drawOffer, setDrawOffer] = useState(false);
  const legal = useMemo(() => legalMoves(game), [game]);
  const movable = useMemo(() => new Set(legal.map((m) => m.from)), [legal]);
  const mustCapture = legal.length > 0 && legal[0].captures.length > 0;

  const candidates = selected === null ? [] : movesWithPrefix(legal, selected, prefix);
  const nextSteps = new Set(candidates.map((m) => m.path[prefix.length]).filter((s) => s !== undefined));
  const pendingCaptures = new Set(candidates.length ? candidates[0].captures.slice(0, prefix.length) : []);

  const tap = (sq: number) => {
    if (game.winner !== null || game.draw) return;
    if (nextSteps.has(sq)) {
      const p = [...prefix, sq];
      const left = movesWithPrefix(legal, selected!, p);
      const done = left.find((m) => m.path.length === p.length);
      if (done && left.length === 1) {
        onMove(applyMove(game, done));
        setSelected(null);
        setPrefix([]);
      } else setPrefix(p);
      return;
    }
    if (movable.has(sq)) {
      setSelected(sq);
      setPrefix([]);
    } else {
      setSelected(null);
      setPrefix([]);
    }
  };

  const last = game.lastMove;
  const lastSquares = new Set(last ? [last.from, ...last.path] : []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-cream">
      <div className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button className="grid size-11 place-items-center rounded-full bg-ink/5" onClick={onExit} aria-label="Leave game">
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="font-display text-xl font-bold">
            {game.winner !== null ? `${players[game.winner]} wins!` : `${players[game.turn]} to move`}
          </div>
          <div className="text-sm text-ink/70">
            {mustCapture ? 'Capture is compulsory — take the most pieces' : game.turn === 0 ? 'Light pieces' : 'Dark pieces'}
          </div>
        </div>
        <button className="grid size-11 place-items-center rounded-full bg-ink/5" onClick={() => setShowRules(true)} aria-label="Rules">
          <BookOpen className="size-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <div
          className="grid aspect-square w-full max-w-[min(92vw,calc(100dvh-14rem))] grid-cols-8 overflow-hidden rounded-2xl shadow-lg ring-4 ring-teal"
          role="grid"
          aria-label="Dama board"
        >
          {game.board.map((piece, i) => {
            const r = Math.floor(i / 8);
            const c = i % 8;
            const dark = (r + c) % 2 === 1;
            const isSel = selected === i || prefix[prefix.length - 1] === i;
            const isStep = nextSteps.has(i);
            const ghost = pendingCaptures.has(i);
            const canMove = movable.has(i) && selected === null;
            return (
              <button
                key={i}
                role="gridcell"
                aria-label={`${String.fromCharCode(97 + c)}${8 - r}${piece ? `, ${piece.owner === 0 ? 'light' : 'dark'}${piece.king ? ' king' : ''}` : ''}`}
                onClick={() => tap(i)}
                className={`relative grid aspect-square place-items-center ${dark ? 'bg-olive/70' : 'bg-paper'} ${lastSquares.has(i) ? 'after:absolute after:inset-0 after:bg-dusty/40' : ''}`}
              >
                {piece && !(prefix.length && i === selected) && (
                  <span
                    className={`relative z-10 grid size-[78%] place-items-center rounded-full shadow-[inset_0_-3px_0_rgba(0,0,0,0.2)] transition ${
                      piece.owner === 0 ? 'bg-cream ring-2 ring-ink/60' : 'bg-teal ring-2 ring-ink'
                    } ${isSel ? 'scale-110 ring-4 ring-dusty' : ''} ${canMove ? 'ring-4 ring-dusty/80' : ''} ${ghost ? 'opacity-30' : ''}`}
                  >
                    {piece.king && <Crown className={`size-1/2 ${piece.owner === 0 ? 'text-teal' : 'text-cream'}`} />}
                  </span>
                )}
                {prefix.length > 0 && i === prefix[prefix.length - 1] && game.board[selected!] && (
                  <span className={`relative z-10 size-[78%] rounded-full ring-4 ring-dusty ${game.board[selected!]!.owner === 0 ? 'bg-cream' : 'bg-teal'}`} />
                )}
                {isStep && <span className="absolute z-20 size-1/3 rounded-full bg-teal/70 ring-2 ring-cream" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="text-sm text-ink/70">
          Light {countPieces(game.board, 0)} · Dark {countPieces(game.board, 1)}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary min-h-11 px-3 text-sm" onClick={() => setDrawOffer(true)}>
            <Handshake className="size-4" /> Draw
          </button>
          <button className="btn-secondary min-h-11 px-3 text-sm" onClick={() => onResign(game.turn)}>
            <FlagIcon className="size-4" /> Resign
          </button>
        </div>
      </div>

      {drawOffer && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-ink/60 p-4" role="dialog" aria-modal="true">
          <div className="card w-full max-w-sm p-5">
            <h2 className="font-display text-xl font-semibold">
              {players[game.turn]} offers a draw. {players[game.turn === 0 ? 1 : 0]}, accept?
            </h2>
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setDrawOffer(false)}>
                Keep playing
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => {
                  setDrawOffer(false);
                  onMove(agreeDraw(game));
                }}
              >
                Accept draw
              </button>
            </div>
          </div>
        </div>
      )}

      {showRules && (
        <div className="absolute inset-0 z-50 grid place-items-end bg-ink/60 sm:place-items-center" role="dialog" aria-modal="true" aria-label="Rules">
          <div className="max-h-[85dvh] w-full max-w-lg overflow-auto rounded-t-3xl bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
            <h2 className="font-display text-xl font-semibold">Al Dama rules</h2>
            <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-ink/85">
              {RULES.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
            <button className="btn-primary mt-4 w-full" onClick={() => setShowRules(false)}>
              Back to the board
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
