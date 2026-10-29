import { Map as MapIcon, RotateCcw, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';

export interface FinalScore {
  name: string;
  score: string;
  winner?: boolean;
}

export function ResultScreen({
  headline,
  scores,
  summary,
  onReplay,
  onBack,
  backLabel = 'Back to country',
}: {
  headline: string;
  scores: FinalScore[];
  summary?: ReactNode;
  onReplay: () => void;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-6 px-4 py-10 text-center">
      <div className="grid size-20 place-items-center rounded-full bg-teal text-cream">
        <Trophy className="size-10" />
      </div>
      <h1 className="font-display text-4xl font-bold">{headline}</h1>
      <div className="grid w-full gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(scores.length, 3)}, minmax(0, 1fr))` }}>
        {scores.map((s) => (
          <div key={s.name} className={`card p-4 ${s.winner ? 'border-teal bg-teal text-cream' : ''}`}>
            <div className="truncate text-sm font-semibold opacity-80">{s.name}</div>
            <div className="font-display text-4xl font-bold tabular-nums">{s.score}</div>
          </div>
        ))}
      </div>
      {summary && <div className="card w-full p-5 text-left text-ink/85">{summary}</div>}
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <button className="btn-primary flex-1" onClick={onReplay}>
          <RotateCcw className="size-5" /> Play again
        </button>
        <button className="btn-secondary flex-1" onClick={onBack}>
          <MapIcon className="size-5" /> {backLabel}
        </button>
      </div>
    </div>
  );
}
