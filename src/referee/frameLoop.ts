import { useEffect, useRef } from 'react';

/**
 * Calls `onFrame` for new camera frames, throttled to `maxFps`, only while `active`.
 * Skips work when the page is hidden so a phone left on a tripod doesn't overheat.
 */
export function useFrameLoop(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean,
  onFrame: (video: HTMLVideoElement, now: number) => void,
  maxFps = 30,
) {
  const cb = useRef(onFrame);
  cb.current = onFrame;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let rafId = 0;
    let vfcId = 0;
    let last = 0;
    const minGap = 1000 / maxFps;

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const now = performance.now();
      if (video && video.readyState >= 2 && !document.hidden && now - last >= minGap) {
        last = now;
        try {
          cb.current(video, now);
        } catch (err) {
          console.error('Referee frame failed', err);
        }
      }
      schedule();
    };

    const schedule = () => {
      const video = videoRef.current as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }) | null;
      if (video?.requestVideoFrameCallback && !document.hidden) vfcId = video.requestVideoFrameCallback(tick);
      else rafId = requestAnimationFrame(tick);
    };

    schedule();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      const video = videoRef.current as (HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void }) | null;
      video?.cancelVideoFrameCallback?.(vfcId);
    };
  }, [active, maxFps, videoRef]);
}
