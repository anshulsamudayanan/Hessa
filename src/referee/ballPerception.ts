import type { ObjectDetector, ObjectDetectorResult } from '@mediapipe/tasks-vision';
import { averageColor, findColorBlob, isTrackableColor, medianLab } from './ballColor';
import { BALL_CLASSES, BallTracker, type BallObs } from './ballTracker';
import type { Lab } from './teamColors';
import type { Rect } from './viewport';

/**
 * Ball perception for ball games, fusing two sensors:
 *
 *  1. The object detector, run on a zoomed-in crop (around where the ball is
 *     expected, or around each goal in turn) so a small ball gets 2–4× more
 *     pixels than when the whole frame is shrunk to the model's 320 px input.
 *  2. A colour tracker that follows the ball's learned colour between detections,
 *     catching blurred balls in flight that the detector misses.
 *
 * A predictive tracker picks one consistent ball from both.
 */

export interface PerceptionOptions {
  /** Detect on zoomed crops (football). Off = full frame every time (basketball needs people too). */
  zoom: boolean;
  /** Follow the ball's colour between detections. */
  color: boolean;
  /** View-space regions worth scanning when the ball is lost (e.g. goals). */
  focusRegions?: Rect[];
  /** Also run a full-frame detection every N frames (basketball: finds the players for shirt colours). */
  fullFrameEvery?: number;
}

export interface PerceptionResult {
  ball: BallObs | null;
  /** The detector result when it ran on the full frame (for people/team colours). */
  fullFrame: ObjectDetectorResult | null;
  /** Image-space crop used this frame (0..1), for debugging overlays. */
  crop: Rect | null;
}

const CROP_PX = 480;
const SCAN_W = 320;

export class BallPerception {
  readonly tracker = new BallTracker(500, 4);
  private cropCanvas = document.createElement('canvas');
  private scanCanvas = document.createElement('canvas');
  private turn = 0;
  private searchStep = 0;
  private coarseTiles: Rect[] | null = null;
  private fineTiles: Rect[] | null = null;
  private samples: Lab[] = [];
  private colorLab: Lab | null = null;
  colorCss: string | null = null;

  constructor(
    private detector: ObjectDetector,
    private opts: PerceptionOptions,
  ) {}

  get ballColor() {
    return this.colorLab;
  }

  reset() {
    this.tracker.reset();
  }

  setFocusRegions(regions: Rect[]) {
    this.opts = { ...this.opts, focusRegions: regions };
  }

  process(video: HTMLVideoElement, t: number, mirrored: boolean, timestamp: number): PerceptionResult {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const toImgX = (x: number) => (mirrored ? 1 - x : x);
    const predicted = this.tracker.predict(t);

    // 1. Choose where to look (image space, 0..1). Measured with the real model:
    // a ball under ~30 px in the model's 320 px input is missed, so whole-frame
    // detection misses typical balls entirely; zoomed crops find them.
    let crop: Rect | null = null;
    const frameNo = this.turn++;
    const fullFrameNow = this.opts.fullFrameEvery ? frameNo % this.opts.fullFrameEvery === 0 : false;
    if (this.opts.zoom && !fullFrameNow) {
      if (predicted) {
        // Crop ≈ 8 ball diameters, so the ball fills ~1/8 of the model input.
        const side = Math.min(1, Math.max(0.2, predicted.r * 16)); // fraction of frame height
        crop = this.square(toImgX(predicted.x), predicted.y, side, vw, vh);
      } else {
        crop = this.searchCrop(vw, vh, toImgX);
      }
    }

    // 2. Run the detector on the crop (or full frame).
    let candidates: BallObs[];
    let fullFrame: ObjectDetectorResult | null = null;
    if (crop) {
      const sw = crop.w * vw;
      const sh = crop.h * vh;
      const scale = Math.min(1, CROP_PX / Math.max(sw, sh));
      this.cropCanvas.width = Math.round(sw * scale);
      this.cropCanvas.height = Math.round(sh * scale);
      this.cropCanvas.getContext('2d')!.drawImage(video, crop.x * vw, crop.y * vh, sw, sh, 0, 0, this.cropCanvas.width, this.cropCanvas.height);
      const res = this.detector.detectForVideo(this.cropCanvas, timestamp);
      candidates = this.mapDetections(res, crop, this.cropCanvas.width, this.cropCanvas.height, vw, vh, mirrored, t, this.cropCanvas);
    } else {
      fullFrame = this.detector.detectForVideo(video, timestamp);
      candidates = this.mapDetections(fullFrame, { x: 0, y: 0, w: 1, h: 1 }, vw, vh, vw, vh, mirrored, t, video);
    }

    // 3. Colour candidate near the prediction (only to continue an existing track).
    if (this.opts.color && this.colorLab && predicted && !candidates.length) {
      const blob = this.colorCandidate(video, predicted, mirrored, t);
      if (blob) candidates.push(blob);
    }

    return { ball: this.tracker.update(t, candidates), fullFrame, crop };
  }

  /**
   * Ball lost: sweep the frame with tiles, alternating a coarse grid (half-height
   * tiles: quick, finds normal-sized balls) and a fine grid (quarter-height tiles:
   * slower, finds small/distant balls), and visit each focus region (goals / rim)
   * every other step since that's where calls happen.
   */
  private searchCrop(vw: number, vh: number, toImgX: (x: number) => number): Rect {
    const grid = (side: number) => {
      const tileW = (side * vh) / vw;
      const cols = Math.ceil(1 / tileW);
      const rows = Math.ceil(1 / side);
      const tiles: Rect[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const cx = cols === 1 ? 0.5 : tileW / 2 + (col * (1 - tileW)) / (cols - 1);
          const cy = rows === 1 ? 0.5 : side / 2 + (row * (1 - side)) / (rows - 1);
          tiles.push(this.square(cx, cy, side, vw, vh));
        }
      }
      return tiles;
    };
    this.coarseTiles ??= grid(0.5);
    this.fineTiles ??= grid(0.25);
    const focus = (this.opts.focusRegions ?? []).map((g) => {
      const side = Math.min(1, Math.max(0.35, g.h * 2.2, (g.w * 2.2 * vw) / vh));
      return this.square(toImgX(g.x + g.w / 2), g.y + g.h / 2, side, vw, vh);
    });
    const step = this.searchStep++;
    if (focus.length && step % 2 === 0) return focus[(step / 2) % focus.length];
    const n = Math.floor(step / (focus.length ? 2 : 1));
    // Interleave: coarse, fine, coarse, fine…
    return n % 2 === 0 ? this.coarseTiles[(n / 2) % this.coarseTiles.length] : this.fineTiles[((n - 1) / 2) % this.fineTiles.length];
  }

  /** Square crop (in pixels) centred on an image-space point, clamped to the frame, returned as 0..1 rect. */
  private square(cx: number, cy: number, sideOfHeight: number, vw: number, vh: number): Rect {
    const sidePx = Math.min(vw, vh, sideOfHeight * vh);
    const x = Math.min(vw - sidePx, Math.max(0, cx * vw - sidePx / 2));
    const y = Math.min(vh - sidePx, Math.max(0, cy * vh - sidePx / 2));
    return { x: x / vw, y: y / vh, w: sidePx / vw, h: sidePx / vh };
  }

  private mapDetections(
    res: ObjectDetectorResult,
    crop: Rect,
    cw: number,
    ch: number,
    vw: number,
    vh: number,
    mirrored: boolean,
    t: number,
    src: CanvasImageSource,
  ): BallObs[] {
    const out: BallObs[] = [];
    for (const d of res.detections) {
      const c = d.categories[0];
      if (!d.boundingBox || !BALL_CLASSES.includes(c?.categoryName)) continue;
      const b = d.boundingBox;
      const ix = crop.x + ((b.originX + b.width / 2) / cw) * crop.w;
      const iy = crop.y + ((b.originY + b.height / 2) / ch) * crop.h;
      const r = (((b.width / cw) * crop.w * vw) / vh + (b.height / ch) * crop.h) / 4;
      out.push({ t, x: mirrored ? 1 - ix : ix, y: iy, r, score: c.score, source: 'detector' });
      // Learn the ball's colour from confident, reasonably sized detections.
      if (this.opts.color && c.score >= 0.5 && b.width >= 10 && b.height >= 10) {
        const sample = averageColor(src, b.originX, b.originY, b.width, b.height);
        if (sample && isTrackableColor(sample.lab)) {
          this.samples = [...this.samples.slice(-14), sample.lab];
          this.colorLab = medianLab(this.samples);
          this.colorCss = sample.css;
        }
      }
    }
    return out;
  }

  private colorCandidate(video: HTMLVideoElement, predicted: BallObs, mirrored: boolean, t: number): BallObs | null {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const sw = SCAN_W;
    const sh = Math.round((SCAN_W * vh) / vw);
    this.scanCanvas.width = sw;
    this.scanCanvas.height = sh;
    const ctx = this.scanCanvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, sw, sh);
    const last = this.tracker.current!;
    const dt = (t - last.t) / 1000;
    const reachH = 0.05 + 4 * dt + 4 * last.r; // fraction of frame height
    const px = (mirrored ? 1 - predicted.x : predicted.x) * sw;
    const py = predicted.y * sh;
    const reach = reachH * sh;
    const gate = {
      x0: Math.max(0, Math.floor(px - reach)),
      y0: Math.max(0, Math.floor(py - reach)),
      x1: Math.min(sw, Math.ceil(px + reach)),
      y1: Math.min(sh, Math.ceil(py + reach)),
    };
    if (gate.x1 <= gate.x0 || gate.y1 <= gate.y0) return null;
    const img = ctx.getImageData(gate.x0, gate.y0, gate.x1 - gate.x0, gate.y1 - gate.y0);
    const blob = findColorBlob(img.data, img.width, { x0: 0, y0: 0, x1: img.width, y1: img.height }, this.colorLab!);
    if (!blob) return null;
    const r = blob.r / sh;
    // A blurred ball looks bigger/smaller, but not wildly so.
    if (r < last.r * 0.35 || r > last.r * 3) return null;
    const ix = (gate.x0 + blob.x) / sw;
    return { t, x: mirrored ? 1 - ix : ix, y: (gate.y0 + blob.y) / sh, r: Math.min(r, last.r * 1.5), score: 0.4, source: 'color' };
  }
}
