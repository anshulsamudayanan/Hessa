import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'country'; countryId: string }
  | { name: 'play'; gameId: string };

/** Hash routing keeps the installed app working from any static host and makes the back button work. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'country' && parts[1]) return { name: 'country', countryId: parts[1] };
  if (parts[0] === 'play' && parts[1]) return { name: 'play', gameId: parts[1] };
  return { name: 'home' };
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
