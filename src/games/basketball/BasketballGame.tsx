import { MatchGame, type MatchGameConfig } from '@/games/ballGame/MatchGame';
import { GAMES } from '@/data/catalog';
import { BasketWatcher } from '@/referee/shotWatcher';
import type { Rect } from '@/referee/viewport';

function CourtDiagram() {
  return (
    <svg viewBox="0 0 200 150" className="w-full" role="img" aria-label="Phone placed to the side of the hoop, seeing the rim and the court in front of it">
      <rect x="150" y="20" width="6" height="70" fill="#1F3133" />
      <rect x="140" y="20" width="4" height="34" fill="#1F3133" />
      <ellipse cx="128" cy="54" rx="13" ry="4" fill="none" stroke="#A4473A" strokeWidth="3" />
      <path d="M118 56l4 14h12l4-14" fill="none" stroke="#EAE0CC" strokeWidth="1.5" />
      <path d="M30 120Q80 0 128 50" fill="none" stroke="#C9ADA1" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx="30" cy="118" r="6" fill="#C9ADA1" />
      <rect x="10" y="125" width="180" height="4" fill="#A0A083" />
      <rect x="20" y="132" width="24" height="14" rx="3" fill="#1F3133" />
      <text x="50" y="143" fontSize="10" fill="#1F3133">phone, well back, sees rim + shooters</text>
    </svg>
  );
}

const CONFIG: MatchGameConfig = {
  game: GAMES['basketball-match'],
  countryId: 'usa',
  countryName: 'USA',
  regionLabels: ['Rim'],
  positioning: [
    'Place the phone well back and to one side of the hoop (landscape), so it sees the rim, the space above it, and the players.',
    'Keep the phone steady — a tripod, wall or bench. Don’t move it after marking the rim.',
    'Draw a tight box around the rim on the picture.',
    'Each team wears clearly different shirt colours (bibs are ideal). Capture both colours below.',
  ],
  diagram: <CourtDiagram />,
  useShirtColors: true,
  makeWatcher: (r: Rect[]) => new BasketWatcher(r[0]),
  // Zoomed crops find the ball; every other frame is full-frame to find the players for shirt colours.
  perception: { zoom: true, color: true, fullFrameEvery: 2 },
  durations: [2, 5, 10, 15, 20],
  defaultMinutes: 10,
  defaultPeriods: 1,
  targets: [11, 21, null],
  defaultTarget: 21,
  points: 2,
  altPoints: { label: '3PT', points: 3 },
  scoreWord: 'basket',
  limitations:
    'Made/missed is judged from the ball passing the rim you mark; motion blur, the ball leaving the picture, or players blocking the view can make Hessa unsure, and it will ask. Sides are matched by shirt colour, so similar colours, strong shadows or changing light confuse it — it asks “Which side scored?” rather than guess. It can’t tell 2s from 3s; tap “3PT”.',
};

export function BasketballGame() {
  return <MatchGame config={CONFIG} />;
}
