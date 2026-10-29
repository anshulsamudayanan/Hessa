import { Play } from 'lucide-react';
import { Flag } from '@/components/Flag';
import { TopBar } from '@/components/TopBar';
import { GAMES, type Country } from '@/data/catalog';
import { navigate } from '@/lib/router';
import { REFEREE_ICON } from './HomePage';

const REFEREE_LABEL = { camera: 'Camera referee', microphone: 'Microphone referee', digital: 'Digital board' } as const;

export function CountryPage({ country }: { country: Country }) {
  return (
    <div className="min-h-dvh">
      <TopBar title={country.name} onBack={() => navigate('/')} backLabel="Map" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center gap-4">
          <Flag country={country.id} className="h-12 w-18" />
          <h1 className="font-display text-3xl font-bold">{country.name}</h1>
        </header>
        <p className="text-base leading-relaxed text-ink/80">{country.intro}</p>

        <h2 className="font-display text-2xl font-semibold">Games</h2>
        <div className="flex flex-col gap-4">
          {country.games.map((id) => {
            const g = GAMES[id];
            const Icon = REFEREE_ICON[g.referee];
            return (
              <article key={id} className="card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-teal text-white">
                    <Icon className="size-3.5" />
                    {REFEREE_LABEL[g.referee]}
                  </span>
                  {g.status === 'experimental' && <span className="chip bg-dusty/60 text-ink">Experimental</span>}
                  <span className="chip bg-olive/25 text-ink">{g.players}</span>
                </div>
                <div>
                  <h3 className="font-display text-2xl font-semibold">
                    {g.name} {g.localName && <span className="font-sans text-lg font-medium text-ink/60" lang="ar">{g.localName}</span>}
                  </h3>
                  <p className="mt-0.5 font-medium text-teal">{g.tagline}</p>
                </div>
                <p className="text-ink/80">{g.description}</p>
                <dl className="grid gap-1 text-sm text-ink/75 sm:grid-cols-2">
                  <div>
                    <dt className="inline font-semibold text-ink">You need: </dt>
                    <dd className="inline">{g.equipment}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-ink">Hessa watches: </dt>
                    <dd className="inline">{g.refereeWatches}</dd>
                  </div>
                </dl>
                <button className="btn-primary mt-1 self-start" onClick={() => navigate(`/play/${id}`)}>
                  <Play className="size-5" /> Play {g.name}
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
