export type CountryId = 'india' | 'brazil' | 'usa' | 'uae';
export type GameId = 'hand-cricket' | 'football-match' | 'basketball-match' | 'qif' | 'al-dama';

/** How the game is refereed, shown on cards so players know what to expect. */
export type RefereeKind = 'camera' | 'microphone' | 'digital';

/**
 * `ready`: refereeing works end to end and its rules are tested.
 * `experimental`: playable, but the camera judgement is a prototype with known limits.
 */
export type GameStatus = 'ready' | 'experimental';

export interface GameInfo {
  id: GameId;
  country: CountryId;
  name: string;
  localName?: string;
  tagline: string;
  description: string;
  players: string;
  equipment: string;
  referee: RefereeKind;
  status: GameStatus;
  /** One line describing what Hessa actually observes. */
  refereeWatches: string;
}

export interface Country {
  id: CountryId;
  name: string;
  /** ISO 3166-1 numeric code, matches world-atlas feature ids. */
  isoNumeric: string;
  intro: string;
  games: GameId[];
}

export const COUNTRIES: Country[] = [
  {
    id: 'india',
    name: 'India',
    isoNumeric: '356',
    intro:
      'Cricket is close to a religion in India, and hand cricket is how generations of kids played it in classrooms, buses and back seats — no bat, no ball, just two hands and quick thinking.',
    games: ['hand-cricket'],
  },
  {
    id: 'brazil',
    name: 'Brazil',
    isoNumeric: '076',
    intro:
      'Five-time world champions, Brazil plays football everywhere: beaches, rooftops, narrow streets. Mark out a pitch anywhere and play.',
    games: ['football-match'],
  },
  {
    id: 'usa',
    name: 'United States',
    isoNumeric: '840',
    intro:
      'Basketball was invented in Springfield, Massachusetts in 1891 with a peach basket. Today every driveway and park hoop hosts a pickup game to 21.',
    games: ['basketball-match'],
  },
  {
    id: 'uae',
    name: 'United Arab Emirates',
    isoNumeric: '784',
    intro:
      'In the fareej — the old neighbourhoods — children played Qif in the evenings and elders gathered in the majlis over Al Dama, the Gulf’s strategic draughts.',
    games: ['qif', 'al-dama'],
  },
];

export const GAMES: Record<GameId, GameInfo> = {
  'hand-cricket': {
    id: 'hand-cricket',
    country: 'india',
    name: 'Hand Cricket',
    tagline: 'Two hands, one camera, no bat needed.',
    description:
      'Both players show 1–6 fingers at the same moment. Different numbers: the batter scores their number. Same number: OUT. Then swap and chase the target.',
    players: '2 players',
    equipment: 'Nothing — just hands',
    referee: 'camera',
    status: 'ready',
    refereeWatches: 'Both players’ hands, counting the fingers each one shows at the reveal.',
  },
  'football-match': {
    id: 'football-match',
    country: 'brazil',
    name: 'Pelada',
    localName: 'Mini football match',
    tagline: 'A full match on a mini pitch. Hessa keeps the score.',
    description:
      'Two sides, a small goal at each end. Prop the phone up at the side of the pitch and play a timed match — Hessa calls every goal, keeps the clock, and names the MVP at full time.',
    players: '1v1 up to 3v3',
    equipment: 'A ball and two small goals (or cones)',
    referee: 'camera',
    status: 'experimental',
    refereeWatches: 'The ball and the two goals you mark on screen.',
  },
  'basketball-match': {
    id: 'basketball-match',
    country: 'usa',
    name: 'Streetball',
    localName: 'Half-court match',
    tagline: 'One hoop, two sides, first to 21.',
    description:
      'Play a half-court game to 21 (or until time runs out). Hessa sees each shot, decides if it went in, and works out which side shot it from their shirt colours.',
    players: '1v1 up to 3v3',
    equipment: 'A ball, a hoop, and different-coloured shirts per side',
    referee: 'camera',
    status: 'experimental',
    refereeWatches: 'The ball around the rim you mark, and shirt colours to tell the sides apart.',
  },
  qif: {
    id: 'qif',
    country: 'uae',
    name: 'Qif',
    localName: 'قِف',
    tagline: 'Sing until you hear “Qif!” — then freeze your voice.',
    description:
      'Each player sings. At a random moment Hessa calls QIF (stop). Go silent within the reaction window or you’re caught still singing.',
    players: '2–6 players',
    equipment: 'Your voice',
    referee: 'microphone',
    status: 'ready',
    refereeWatches: 'Voice activity from the microphone around the moment it calls QIF.',
  },
  'al-dama': {
    id: 'al-dama',
    country: 'uae',
    name: 'Al Dama',
    localName: 'الدامة',
    tagline: 'Gulf draughts: straight lines, sharp captures.',
    description:
      'Pieces move forward or sideways and capture by jumping. Captures are compulsory and you must take the most pieces possible. Reach the far row to crown a king.',
    players: '2 players, one phone',
    equipment: 'Just the phone',
    referee: 'digital',
    status: 'ready',
    refereeWatches: 'Played on a digital board — the rules engine checks every move.',
  },
};

export function getCountry(id: string): Country | undefined {
  return COUNTRIES.find((c) => c.id === id);
}
