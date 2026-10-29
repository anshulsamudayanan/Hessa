# Hessa — Explore the world. Play its games.
Link for the app:https://hessa-drab.vercel.app/#/

Hessa is an installable web app (PWA) where **the phone is the referee**. Pick a country on the world map, choose one of its games, prop the phone up, and play for real in the same room. Hessa watches through the camera (or listens through the microphone), applies the rules, and keeps score.

All AI runs **on the phone** (MediaPipe, Apache‑2.0). No video or audio is recorded, stored or uploaded, and there is no backend and no API key.

## What's in the first release

| Country | Game | Referee | Status |
| --- | --- | --- | --- |
| 🇮🇳 India | **Hand Cricket** | Camera, hand landmarks → finger count | Ready (see accuracy notes) |
| 🇧🇷 Brazil | **Pelada**: mini football match, 1v1–3v3, timed | Camera, ball detection → goals | Experimental |
| 🇺🇸 USA | **Streetball**: half‑court match to 21 / timed | Camera, ball + rim → baskets, shirt colour → which side | Experimental |
| 🇦🇪 UAE | **Qif**: sing until QIF, then go silent | Microphone, voice‑band level | Ready |
| 🇦🇪 UAE | **Al Dama**: Gulf draughts | Digital board, rules engine | Ready (variant to confirm) |

Football and basketball referee a **whole match**: clock, score for each side, who scored, a box score, a timeline, and the **MVP** (most points) at the end.

**Match features:**

- **Choose your camera.** Every camera game lists the available cameras: built‑in, USB webcams, or a phone's front and back cameras. There's also a **Mirror** switch. Your choice is remembered, and if that camera is unplugged Hessa falls back to another one.
- **Halves.** Football defaults to two halves and basketball to one period; both offer 2–20 minute matches.
  - At the end of a half the clock stops on a **half‑time screen** with the score, goals/baskets, shooting, players' calls, top scorers, and (for football) a **switch ends** option, so goals are credited correctly in the second half.
- **Clock warnings.** "One minute left" / "One minute to half‑time" is spoken and shown, the last 10 seconds beep, and the clock changes colour.
- **Full time** shows the score by half and a timeline tagged H1/H2.
- **Hand cricket overs.** You can set an optional overs limit (1, 2, 3 or 5 overs, or until out), with "Last over!" and "Last ball!" warnings. An **innings break** screen shows the first innings (runs, balls, 4s, 6s, run rate, ball‑by‑ball), the target and the required rate.

## How the referee is built

Every camera game uses the same layers. The AI only *interprets* what happened; deterministic rules decide what it *means*.

```
camera.ts          Camera manager: permission, errors, stream lifecycle, front/back switch
frameQuality.ts    Lighting / blocked-lens check
vision.ts          Perception: loads MediaPipe HandLandmarker / ObjectDetector (GPU, CPU fallback)
fingers.ts         Hand landmarks → number 0–6 (or "unsure")
ballTracker.ts     Ball detections → one consistent ball track
teamColors.ts      Person boxes → shirt colour → team (or "unsure")
revealDetector.ts  Event detector: hand-cricket reveal window and fairness rules
shotWatcher.ts     Event detectors: GoalWatcher (football), BasketWatcher (basketball)
voice.ts           Event detector: Qif stop judge (audio thread level meter)
rules.ts / matchRules.ts   Rules engines + score managers (pure, unit tested)
CameraSetup / *Game.tsx    Referee interface and session flow
```

Fairness guarantees, all covered by tests:

- **No invented detections.** Each digit is classified as extended, folded or *unsure*. One unsure digit makes the whole reading unsure, and the ball is replayed.
- **One event, one score.** Every event has an id. The rules engines ignore duplicates, and the detectors need a reset before they fire again (fists again in hand cricket, ball back in play in football, a cooldown in basketball).
- **Uncertain calls go to the players.** "Couldn't identify both numbers — please try again", "Did it go in?", "Which side scored?". Anything players decide is labelled *players' call* or *entered manually* in the results.

## Hand cricket

- Players stand side by side facing the phone. **Left of the screen = player 1, right = player 2.** Each player shows one hand, palm toward the camera.
- Signs: **fist** = ready, **1–5** = raised digits (thumb counts), **6** = thumb only 👍.
- Each ball: both fists held, then a 3‑2‑1‑SHOW countdown. Readings during the countdown are ignored, so an early hand never counts. After SHOW there is a 1.5 s window, and each hand must hold one number steadily. Switching numbers, a missing hand, or two hands on one side makes the ball "unclear". Both numbers appear on screen before the rules engine applies them, for example "Detected: Batter 4, Bowler 2 — 4 runs!".
- After two unclear balls in a row, players can enter that ball manually. It is marked as not camera‑verified.

**Accuracy, honestly:** the thresholds were tuned on the real MediaPipe model using Google's sample hand photos. With the tuned thresholds those photos read correctly: thumbs‑up 6, V 2, pointing 1, thumbs‑down 6. The poses for 3, 4, 5 and the fist are only covered by synthetic landmark tests. The full pipeline (camera stream → model → reading on screen) was checked in a desktop browser with a simulated camera, **but not yet on a phone with real players.** Expect a hand side‑on to the camera, poor light, or fingers pressed together to give "unsure" rather than a wrong number. Use the *Test the referee* panel on the setup screen to check readings before a match.

## Football (Pelada) and Streetball

- **Football:** put the phone side‑on to a small pitch so both goals are in view, and box each goal (from the goal line back to the net, ground to crossbar).
  - A goal is called when the ball's path **crosses the goal line under the bar**. The path between frames is checked, so a fast shot that skips past the box between two frames still counts. A ball dropping in over the bar, or entering from behind, never counts.
  - During setup, rest the ball in each goal. Hessa measures how big it looks there, and refers any "goal" where the ball looks much closer or further away (passing in front of or behind the goal) to the players.
  - If the ball is seen in a goal without a visible crossing, or is lost right in front of a goal mouth, Hessa asks "Was that a goal?".
  - The ball must come back into play before the next goal can count.
- **How the ball is found:** the detector only sees small balls when zoomed in. With the real model, a 30 px ball was missed on every whole frame but found on zoomed crops. So Hessa detects on a crop around where the ball should be, sized so the ball fills about 1/8 of it. When the ball is lost, it sweeps coarse and fine tiles across the frame, checking each goal every other step. Between detections it follows the ball's learned colour, which catches motion‑blurred shots.
- **Basketball:** put the phone to one side of the hoop and box the rim. A basket counts when the ball crosses rim level, going down, inside the rim. Before the match, each team's shirt colour is captured. The player nearest the ball just before release decides which side gets the points. If that's unclear, Hessa asks.
- **MVP / credit:** when a side has one player, points are credited to them automatically. With 2–3 players, tap the scorer's name on the banner. Tap *3PT* for long shots, or *Disallow* to overturn a call.

**Limitations (experimental):** one camera has no depth, so a ball passing just in front of or behind a goal can look like a goal. Motion blur, the ball leaving the frame, occlusion and low light all cause missed or uncertain calls, and similar shirt colours confuse team detection. I measured the real EfficientDet‑Lite0 model on a simulated pitch using a real ball photo:

- Balls of 18–80 px were found and their goals called, including shots crossing in 0.35 s.
- Balls under about 18 px were not found.
- Strongly coloured balls at 45–80 px were sometimes missed. The model can label a big orange ball as the fruit "orange", which Hessa now also accepts as a ball.

This is **not** professional goal‑line technology, and it has not yet been tested on a real pitch or court.

**Model note:** the int8 version of EfficientDet returned wrong results on the GPU (a person was labelled "train"), so Hessa uses the float16 version.

## Qif

The phone listens to the voice band (85–1000 Hz) on the audio thread. It measures the room's noise floor, shows **SING**, then calls **QIF** with a whistle at a random moment. Any voice that keeps going after the reaction window (0.4 / 0.6 / 0.9 s) means you're caught. The whistle is around 3 kHz, outside the voice band, so it doesn't count against the player. "Not singing" and "too noisy" turns are replayed, never scored. This was checked with a synthetic voice signal: stops at 150–300 ms pass, and stops at 800–1200 ms are caught under the tighter windows. Measured stop times include roughly 50–120 ms of processing latency. Music, TV or other people talking will confuse it.

## Al Dama

Two players on one phone. The rules implemented are the common Gulf / Turkish form:

- Men move one square forward or sideways and capture forward or sideways.
- Kings fly and can't reverse 180° mid‑capture.
- Captures are compulsory and you must take the maximum.
- Pieces are crowned at the end of the move.
- You lose with no pieces or no legal move.

Switches for the variant are in `DAMA_RULES` (`src/games/dama/rules.ts`). **Please confirm the regional variant** you want, especially whether a man reaching the far row mid‑capture keeps capturing as a king. Physical‑board camera mode isn't implemented, and the engine was built so it can be added later.

## Run it locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

`npm run dev` and `npm run build` first run `scripts/prepare-ai-assets.mjs`. That script copies the MediaPipe WASM runtime and downloads the two models (about 15 MB, cached in `public/mediapipe/`, which is git‑ignored) so the app serves them from its own origin. Open http://localhost:5173.

```bash
npm test        # 110 unit tests: rules engines, event detectors, finger reading, Qif judge, Dama
npm run lint    # TypeScript check
npm run build   # production build in dist/ (static files + service worker)
npm run preview # serve the production build
```

No environment variables are needed.

## Put it on your phone

Camera and microphone access require **HTTPS** (or `localhost`). A phone opening `http://<your-computer-ip>:5173` will **not** get the camera. Either:

1. **Deploy** (recommended). `dist/` is static, so any HTTPS static host works. On Netlify, Vercel or Cloudflare Pages, set the build command to `npm run build` and the output directory to `dist`. On GitHub Pages, serve the site at the domain root, or set Vite's `base` and the manifest `start_url`/`scope` to the repository path.
2. Or tunnel the dev server over HTTPS, for example `cloudflared tunnel --url http://localhost:5173`.

Then **add it to the home screen**:

- **Android / Chrome:** open the HTTPS URL, then tap ⋮ → *Install app* (or *Add to Home screen*).
- **iPhone / Safari:** tap Share → *Add to Home Screen*.

It opens full‑screen like a native app. After the first visit, the app shell works offline. Each AI model is cached the first time its game is opened.

**Checking permissions on the deployed site:** open each game, tap *Turn on camera* (or *Allow microphone*), allow it, and check that the live preview, "Referee model ready" and the lighting chip appear. Then deny the permission in site settings and check that the clear "blocked" message appears. Leaving a game turns the camera off. The screen stays awake during matches (Wake Lock).

## Project notes

- **Stack:** React 19, Vite, Tailwind CSS 4, motion, lucide-react, d3-geo + world-atlas for the canvas globe, vite-plugin-pwa (Workbox), Vitest.
- **Palette:** cream `#EAE0CC`, dusty rose `#C9ADA1`, olive `#A0A083`, sage `#798478`, deep teal `#4D6A6D`. The reference image is in `docs/design/`.
- **Origin:** this repo started from the Google AI Studio "FAREEG AI" project (Emirati games tournament + video upload review). The Express server, tournaments, leaderboards and record‑then‑review flow were removed because Hessa referees live and has no online features. The whistle synthesis was kept. The old code is in git history.

## Next steps

- Field tests on real phones (low‑end Android, iPhone) with real players: tune finger thresholds, ball confidence and shirt‑colour margins from those recordings.
- A ball‑specific detector, or a light colour tracker, for small, fast balls.
- Confirm the Al Dama variant, then add a camera mode for physical boards.
- More games per country (free kicks, H‑O‑R‑S‑E…) once the first ones are proven on court.
