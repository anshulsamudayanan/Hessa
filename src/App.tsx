import { lazy, Suspense, type ComponentType } from 'react';
import { Loader2 } from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { getCountry, GAMES, type GameId } from '@/data/catalog';
import { navigate, useRoute } from '@/lib/router';
import { CountryPage } from '@/pages/CountryPage';
import { HomePage } from '@/pages/HomePage';

// Each game (and its AI models) loads only when opened.
const GAME_SCREENS: Record<GameId, ComponentType> = {
  'hand-cricket': lazy(() => import('@/games/handCricket/HandCricketGame').then((m) => ({ default: m.HandCricketGame }))),
  'football-match': lazy(() => import('@/games/football/FootballGame').then((m) => ({ default: m.FootballGame }))),
  'basketball-match': lazy(() => import('@/games/basketball/BasketballGame').then((m) => ({ default: m.BasketballGame }))),
  qif: lazy(() => import('@/games/qif/QifGame').then((m) => ({ default: m.QifGame }))),
  'al-dama': lazy(() => import('@/games/dama/DamaGame').then((m) => ({ default: m.DamaGame }))),
};

function NotFound() {
  return (
    <div className="min-h-dvh">
      <TopBar onBack={() => navigate('/')} backLabel="Map" />
      <p className="p-8 text-center text-ink/70">That page doesn’t exist.</p>
    </div>
  );
}

export default function App() {
  const route = useRoute();

  if (route.name === 'country') {
    const country = getCountry(route.countryId);
    return country ? <CountryPage country={country} /> : <NotFound />;
  }

  if (route.name === 'play') {
    const Screen = route.gameId in GAMES ? GAME_SCREENS[route.gameId as GameId] : undefined;
    if (!Screen) return <NotFound />;
    return (
      <Suspense
        fallback={
          <div className="grid min-h-dvh place-items-center">
            <Loader2 className="size-8 animate-spin text-teal" aria-label="Loading game" />
          </div>
        }
      >
        <Screen key={route.gameId} />
      </Suspense>
    );
  }

  return <HomePage />;
}
