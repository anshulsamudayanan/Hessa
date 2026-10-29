import { Camera, ChevronRight, Mic, Grid3x3, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Flag } from '@/components/Flag';
import { MAP_COUNTRY_NAMES, WorldMap } from '@/components/WorldMap';
import { COUNTRIES, GAMES, type RefereeKind } from '@/data/catalog';
import { navigate } from '@/lib/router';

export const REFEREE_ICON: Record<RefereeKind, typeof Camera> = { camera: Camera, microphone: Mic, digital: Grid3x3 };

export function HomePage() {
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [highlightIso, setHighlightIso] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const playableIso = new Set(COUNTRIES.map((c) => c.isoNumeric));
    const aliases: Record<string, string> = { usa: '840', america: '840', 'united states': '840', uae: '784', emirates: '784' };
    const matches = MAP_COUNTRY_NAMES.filter(
      (c) => c.name.toLowerCase().includes(q) || Object.entries(aliases).some(([a, iso]) => iso === c.iso && a.startsWith(q)),
    );
    return matches
      .sort((a, b) => Number(playableIso.has(b.iso)) - Number(playableIso.has(a.iso)) || a.name.localeCompare(b.name))
      .slice(0, 6)
      .map((m) => ({ ...m, country: COUNTRIES.find((c) => c.isoNumeric === m.iso) }));
  }, [query]);

  const showOther = (name: string) => {
    setNotice(`${name} isn’t on Hessa yet. Try India, Brazil, the USA or the UAE.`);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-12">
      <header className="flex items-end justify-between gap-4 pt-2">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">Hessa</h1>
          <p className="mt-1 text-base text-ink/75">Explore the world. Play its games.</p>
        </div>
      </header>

      <div className="relative">
        <label className="relative block">
          <span className="sr-only">Search countries</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink/50" />
          <input
            className="field pl-12"
            placeholder="Search a country"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setNotice(null);
            }}
          />
          {query && (
            <button className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-ink/60" onClick={() => setQuery('')} aria-label="Clear search">
              <X className="size-5" />
            </button>
          )}
        </label>
        {results.length > 0 && (
          <ul className="card absolute inset-x-0 top-full z-20 mt-2 overflow-hidden p-1 shadow-lg">
            {results.map((r) => (
              <li key={r.iso}>
                <button
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left hover:bg-ink/5"
                  onClick={() => {
                    setQuery('');
                    if (r.country) navigate(`/country/${r.country.id}`);
                    else {
                      setHighlightIso(r.iso);
                      showOther(r.name);
                    }
                  }}
                >
                  <span className="flex items-center gap-3">
                    {r.country && <Flag country={r.country.id} className="h-5 w-7" />}
                    <span className="font-medium">{r.name}</span>
                  </span>
                  <span className={`chip ${r.country ? 'bg-teal text-white' : 'bg-ink/5 text-ink/60'}`}>
                    {r.country ? `${r.country.games.length} ${r.country.games.length === 1 ? 'game' : 'games'}` : 'Coming later'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <section aria-label="World map" className="flex flex-col gap-2">
        <WorldMap
          onSelectPlayable={(id) => navigate(`/country/${id}`)}
          onSelectOther={showOther}
          highlightIso={highlightIso}
        />
        <p className="min-h-6 text-sm text-ink/70" role="status">
          {notice ?? 'Tap a highlighted country. Drag and pinch to explore.'}
        </p>
      </section>

      <section aria-labelledby="destinations" className="flex flex-col gap-3">
        <h2 id="destinations" className="font-display text-2xl font-semibold">Destinations</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {COUNTRIES.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/country/${c.id}`)}
              className="card group flex items-center gap-4 p-4 text-left transition hover:border-teal/40 active:scale-[0.99]"
            >
              <Flag country={c.id} className="h-10 w-15" />
              <div className="min-w-0 flex-1">
                <div className="font-display text-xl font-semibold">{c.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {c.games.map((g) => {
                    const Icon = REFEREE_ICON[GAMES[g].referee];
                    return (
                      <span key={g} className="chip bg-olive/25 text-ink">
                        <Icon className="size-3.5" />
                        {GAMES[g].name}
                      </span>
                    );
                  })}
                </div>
              </div>
              <ChevronRight className="size-5 text-ink/40 transition group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </section>

      <footer className="text-xs text-ink/55">
        Hessa runs its referees on your phone. Camera and microphone data is processed on the device and never uploaded or
        recorded.
      </footer>
    </div>
  );
}
