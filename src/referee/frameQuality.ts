/** Lighting / view check run on a small downscaled copy of the camera frame. */

export type LightVerdict = 'ok' | 'too-dark' | 'too-bright' | 'low-contrast';

export interface FrameQuality {
  brightness: number; // 0..255 mean luma
  contrast: number; // luma standard deviation
  verdict: LightVerdict;
}

export const LIGHT_ADVICE: Record<LightVerdict, string> = {
  ok: 'Lighting looks good.',
  'too-dark': 'Too dark — turn on a light or face a window.',
  'too-bright': 'Too bright — avoid pointing the camera at a window or lamp.',
  'low-contrast': 'The view looks washed out or blocked — check nothing covers the lens.',
};

/** Assess RGBA pixels. Pure so it can be unit-tested. */
export function assessPixels(data: Uint8ClampedArray): FrameQuality {
  let sum = 0;
  let sumSq = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    sum += y;
    sumSq += y * y;
  }
  const brightness = sum / n;
  const contrast = Math.sqrt(Math.max(0, sumSq / n - brightness * brightness));
  let verdict: LightVerdict = 'ok';
  if (brightness < 55) verdict = 'too-dark';
  else if (brightness > 215) verdict = 'too-bright';
  else if (contrast < 18) verdict = 'low-contrast';
  return { brightness, contrast, verdict };
}

let scratch: HTMLCanvasElement | null = null;

export function assessVideoFrame(video: HTMLVideoElement): FrameQuality | null {
  if (video.readyState < 2 || !video.videoWidth) return null;
  scratch ??= document.createElement('canvas');
  scratch.width = 64;
  scratch.height = 36;
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, 64, 36);
  return assessPixels(ctx.getImageData(0, 0, 64, 36).data);
}
