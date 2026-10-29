import { MatchGame, type MatchGameConfig } from '@/games/ballGame/MatchGame';
import { GAMES } from '@/data/catalog';
import { GoalWatcher } from '@/referee/shotWatcher';
import type { Rect } from '@/referee/viewport';

function PitchDiagram() {
  return (
    <svg viewBox="0 0 200 150" className="w-full" role="img" aria-label="Phone at the side of a small pitch, seeing both goals">
      <rect x="10" y="10" width="180" height="90" rx="6" fill="#A0A083" opacity="0.35" />
      <line x1="100" y1="10" x2="100" y2="100" stroke="#EAE0CC" strokeWidth="2" />
      <circle cx="100" cy="55" r="14" fill="none" stroke="#EAE0CC" strokeWidth="2" />
      <rect x="4" y="40" width="10" height="30" fill="none" stroke="#1F3133" strokeWidth="3" />
      <rect x="186" y="40" width="10" height="30" fill="none" stroke="#1F3133" strokeWidth="3" />
      <circle cx="70" cy="45" r="5" fill="#C9ADA1" />
      <circle cx="130" cy="65" r="5" fill="#4D6A6D" />
      <path d="M100 138 10 100h180z" fill="#4D6A6D" opacity="0.15" />
      <rect x="88" y="128" width="24" height="16" rx="3" fill="#1F3133" />
      <text x="100" y="122" textAnchor="middle" fontSize="10" fill="#1F3133">phone, side-on, raised</text>
    </svg>
  );
}

const CONFIG: MatchGameConfig = {
  game: GAMES['football-match'],
  countryId: 'brazil',
  countryName: 'Brazil',
  regionLabels: ['Left goal', 'Right goal'],
  positioning: [
    'Use a small pitch (about 6–12 m long) with a small goal or two cones at each end.',
    'Put the phone at the halfway line, off to the side, raised (on a chair or wall), in landscape so both goals are in the picture.',
    'Mark each goal mouth on the picture: draw the box the ball must enter to score.',
    'Use a ball in a strong colour that stands out from the ground.',
  ],
  diagram: <PitchDiagram />,
  useShirtColors: false,
  makeWatcher: (r: Rect[]) => new GoalWatcher([r[0], r[1]]),
  durations: [5, 10, 15, 20],
  defaultMinutes: 10,
  targets: [null],
  defaultTarget: null,
  points: 1,
  scoreWord: 'goal',
  limitations:
    'From one side-on camera Hessa can’t see depth, so a ball passing just in front of or behind a goal can look like a goal — use “Disallow” to overturn it. Very fast shots can blur past the camera; use “Camera missed one?” if that happens.',
};

export function FootballGame() {
  return <MatchGame config={CONFIG} />;
}
