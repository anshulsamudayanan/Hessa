import { BALL_CLASSES } from './ballTracker';
import { FilesetResolver, HandLandmarker, ObjectDetector } from '@mediapipe/tasks-vision';

/**
 * Perception layer model loading. Everything runs on-device with MediaPipe Tasks
 * (Apache-2.0); the WASM runtime and models are served from /mediapipe on our own
 * origin (see scripts/prepare-ai-assets.mjs) and cached by the service worker.
 */

const BASE = `${import.meta.env.BASE_URL}mediapipe`;

let fileset: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
const visionFileset = () => (fileset ??= FilesetResolver.forVisionTasks(`${BASE}/wasm`));

/** Try the GPU delegate first (much faster on phones), fall back to CPU. */
async function withDelegate<T>(create: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
  try {
    return await create('GPU');
  } catch (err) {
    console.warn('GPU delegate unavailable, using CPU', err);
    return create('CPU');
  }
}

let handLandmarker: Promise<HandLandmarker> | null = null;

export function loadHandLandmarker(): Promise<HandLandmarker> {
  handLandmarker ??= visionFileset()
    .then((fs) =>
      withDelegate((delegate) =>
        HandLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: `${BASE}/models/hand_landmarker.task`, delegate },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.5,
        }),
      ),
    )
    .catch((err) => {
      handLandmarker = null;
      throw err;
    });
  return handLandmarker;
}

const ballDetectors = new Map<string, Promise<ObjectDetector>>();

/**
 * EfficientDet-Lite0 float16 (COCO) restricted to "sports ball", plus "person"
 * when the game needs to tell teams apart by shirt colour. float16, not int8:
 * tested in-browser, the int8 build returns wrong boxes on the GPU delegate.
 * Small balls are only found on zoomed crops (see ballPerception.ts).
 */
export function loadBallDetector(withPeople = false): Promise<ObjectDetector> {
  const key = withPeople ? 'ball+person' : 'ball';
  let p = ballDetectors.get(key);
  if (!p) {
    p = visionFileset()
      .then((fs) =>
        withDelegate((delegate) =>
          ObjectDetector.createFromOptions(fs, {
            baseOptions: { modelAssetPath: `${BASE}/models/efficientdet_lite0_fp16.tflite`, delegate },
            runningMode: 'VIDEO',
            scoreThreshold: 0.3,
            maxResults: withPeople ? 8 : 3,
            categoryAllowlist: withPeople ? [...BALL_CLASSES, 'person'] : BALL_CLASSES,
          }),
        ),
      )
      .catch((err) => {
        ballDetectors.delete(key);
        throw err;
      });
    ballDetectors.set(key, p);
  }
  return p;
}

/** MediaPipe requires strictly increasing timestamps per task. */
export function monotonicClock() {
  let last = 0;
  return () => {
    const now = performance.now();
    last = now > last ? now : last + 0.01;
    return last;
  };
}
