import { Minus, Plus } from 'lucide-react';

const KEY = 'hessa.playerNames';

export function loadNames(count: number): string[] {
  let saved: string[] = [];
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {}
  return Array.from({ length: count }, (_, i) => saved[i] || `Player ${i + 1}`);
}

export function saveNames(names: string[]) {
  try {
    const saved: string[] = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    names.forEach((n, i) => (saved[i] = n.trim() || `Player ${i + 1}`));
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {}
}

/** Name inputs; labels let games describe positions (e.g. "Left of screen"). */
export function PlayerNames({
  names,
  onChange,
  labels,
  min,
  max,
}: {
  names: string[];
  onChange: (names: string[]) => void;
  labels?: string[];
  min?: number;
  max?: number;
}) {
  const adjustable = min !== undefined && max !== undefined;
  return (
    <div className="flex flex-col gap-3">
      {names.map((n, i) => (
        <label key={i} className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink/75">{labels?.[i] ?? `Player ${i + 1}`}</span>
          <input
            className="field"
            value={n}
            maxLength={16}
            onChange={(e) => onChange(names.map((x, j) => (j === i ? e.target.value : x)))}
            onFocus={(e) => e.target.select()}
          />
        </label>
      ))}
      {adjustable && (
        <div className="flex items-center gap-2">
          <button className="btn-secondary min-h-11 px-3" disabled={names.length <= min} onClick={() => onChange(names.slice(0, -1))} aria-label="Remove player">
            <Minus className="size-4" />
          </button>
          <span className="text-sm font-medium">{names.length} players</span>
          <button
            className="btn-secondary min-h-11 px-3"
            disabled={names.length >= max}
            onClick={() => onChange([...names, loadNames(names.length + 1)[names.length]])}
            aria-label="Add player"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
