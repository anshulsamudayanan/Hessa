/**
 * Perception: turns 21 MediaPipe hand landmarks into a hand-cricket number.
 *
 * Signs (printed on the setup screen):
 *   fist = 0 (neutral / "ready")
 *   1–5  = number of raised digits (thumb counts, so 4 fingers + thumb = 5)
 *   6    = thumb only (thumbs-up)
 *
 * Uses 3D world landmarks so the result doesn't depend on how far the hand is
 * from the camera. Each digit is classified extended / folded / unsure; if any
 * digit is unsure the whole reading is `null` — the referee never guesses.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type DigitState = 'extended' | 'folded' | 'unsure';
export type Digit = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

export interface FingerReading {
  digits: Record<Digit, DigitState>;
  /** 0 = fist, 1–6 = sign, null = could not read reliably. */
  count: number | null;
}

const FINGERS: Record<Exclude<Digit, 'thumb'>, [number, number, number, number]> = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const dist = (a: Vec3, b: Vec3) => len(sub(a, b));
const cos = (a: Vec3, b: Vec3) => (a.x * b.x + a.y * b.y + a.z * b.z) / (len(a) * len(b) || 1);

// Thresholds, tuned on MediaPipe sample photos (see README): extended fingers reach
// 1.4–1.6× the wrist→PIP distance, folded ones ≤ 1.05×; a tucked thumb tip sits
// within 0.3–0.45 palm lengths of a finger knuckle, an extended one ≥ 0.65.
// Between the "extended" and "folded" bounds a digit is "unsure".
export const FINGER_THRESHOLDS = {
  reachExtended: 1.25, // |wrist→tip| / |wrist→PIP|
  reachFolded: 1.1,
  straightExtended: 0.5, // cos of bend at PIP (MCP→PIP vs PIP→TIP)
  straightFolded: 0,
  thumbAwayExtended: 0.55, // min distance thumb tip → finger knuckles, in palm lengths
  thumbAwayFolded: 0.45,
  thumbStraight: 0.45,
};

function fingerState(lm: Vec3[], [mcp, pip, , tip]: [number, number, number, number]): DigitState {
  const T = FINGER_THRESHOLDS;
  const straight = cos(sub(lm[pip], lm[mcp]), sub(lm[tip], lm[pip]));
  const reach = dist(lm[0], lm[tip]) / (dist(lm[0], lm[pip]) || 1);
  if (straight > T.straightExtended && reach > T.reachExtended) return 'extended';
  if (straight < T.straightFolded || reach < T.reachFolded) return 'folded';
  return 'unsure';
}

function thumbState(lm: Vec3[]): DigitState {
  const T = FINGER_THRESHOLDS;
  const palm = dist(lm[0], lm[9]) || 1;
  const tip = lm[4];
  // A tucked thumb rests on some finger (in a V sign it holds the ring/pinky down).
  const away = Math.min(...[5, 6, 9, 10, 13, 14, 17, 18].map((i) => dist(tip, lm[i]))) / palm;
  const straight = cos(sub(lm[3], lm[2]), sub(lm[4], lm[3]));
  if (away > T.thumbAwayExtended && straight > T.thumbStraight) return 'extended';
  if (away < T.thumbAwayFolded) return 'folded';
  return 'unsure';
}

export function readFingers(world: Vec3[]): FingerReading {
  if (world.length < 21) {
    return { digits: { thumb: 'unsure', index: 'unsure', middle: 'unsure', ring: 'unsure', pinky: 'unsure' }, count: null };
  }
  const digits: Record<Digit, DigitState> = {
    thumb: thumbState(world),
    index: fingerState(world, FINGERS.index),
    middle: fingerState(world, FINGERS.middle),
    ring: fingerState(world, FINGERS.ring),
    pinky: fingerState(world, FINGERS.pinky),
  };
  return { digits, count: signFromDigits(digits) };
}

export function signFromDigits(d: Record<Digit, DigitState>): number | null {
  const states = Object.values(d);
  if (states.includes('unsure')) return null;
  const fingers = (['index', 'middle', 'ring', 'pinky'] as const).filter((k) => d[k] === 'extended').length;
  const thumb = d.thumb === 'extended';
  if (fingers === 0) return thumb ? 6 : 0;
  return fingers + (thumb ? 1 : 0);
}
