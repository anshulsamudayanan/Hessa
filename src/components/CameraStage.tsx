import { useEffect, useRef, type ReactNode } from 'react';
import type { Camera } from '@/referee/camera';
import { containRect, type Point, type Rect } from '@/referee/viewport';

/**
 * Live camera view with a transparent overlay canvas on top. Games draw their
 * detections on the overlay in view space via `prepareOverlay`.
 */
export function CameraStage({
  camera,
  overlayRef,
  children,
  className = '',
}: {
  camera: Camera;
  overlayRef?: React.RefObject<HTMLCanvasElement | null>;
  children?: ReactNode;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = overlayRef?.current;
    if (!box || !canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(box.clientWidth * dpr);
      canvas.height = Math.round(box.clientHeight * dpr);
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [overlayRef]);

  return (
    <div ref={boxRef} className={`relative overflow-hidden bg-ink ${className}`}>
      <video
        ref={camera.bindVideo}
        className={`absolute inset-0 h-full w-full object-contain ${camera.mirrored ? '-scale-x-100' : ''}`}
        playsInline
        muted
        autoPlay
      />
      {overlayRef && <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />}
      {children}
    </div>
  );
}

export interface Overlay {
  ctx: CanvasRenderingContext2D;
  /** Visible video area inside the stage, in CSS pixels. */
  rect: Rect;
  /** View-space point (0..1) → CSS pixel on the overlay. */
  px: (p: Point) => Point;
}

/** Clears the overlay and returns a context scaled to CSS pixels plus a view→pixel mapper. */
export function prepareOverlay(canvas: HTMLCanvasElement | null, video: HTMLVideoElement | null): Overlay | null {
  if (!canvas || !video) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = canvas.width / Math.max(1, canvas.clientWidth);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rect = containRect(video.videoWidth, video.videoHeight, canvas.clientWidth, canvas.clientHeight);
  return { ctx, rect, px: (p) => ({ x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h }) };
}
