import { useRef, useState } from 'react';
import { containRect, type Rect } from '@/referee/viewport';

export interface Region {
  label: string;
  rect: Rect | null;
}

/**
 * Drag on the live camera view to mark regions (goals, rim…). Regions are stored
 * in view space so they line up with detections regardless of screen size.
 * Dragging edits the `active` region.
 */
export function RegionPicker({
  video,
  regions,
  active,
  onChange,
}: {
  video: React.RefObject<HTMLVideoElement | null>;
  regions: Region[];
  active: number;
  onChange: (index: number, r: Rect) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraftState] = useState<Rect | null>(null);
  const draftRef = useRef<Rect | null>(null);
  const setDraft = (r: Rect | null) => {
    draftRef.current = r;
    setDraftState(r);
  };

  // Commit on release, and also if the browser cancels the gesture or steals the pointer.
  const commit = (end?: { x: number; y: number }) => {
    if (!start.current) return;
    const r = end ? rectFrom(start.current, end) : draftRef.current;
    start.current = null;
    setDraft(null);
    if (r && r.w > 0.03 && r.h > 0.02) onChange(active, r);
  };

  const toView = (e: React.PointerEvent) => {
    const box = boxRef.current!.getBoundingClientRect();
    const v = video.current;
    const r = containRect(v?.videoWidth ?? 0, v?.videoHeight ?? 0, box.width, box.height);
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left - r.x) / r.w)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top - r.y) / r.h)),
    };
  };

  const rectFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  const box = boxRef.current?.getBoundingClientRect();
  const v = video.current;
  const cr = box ? containRect(v?.videoWidth ?? 0, v?.videoHeight ?? 0, box.width, box.height) : null;
  const activeRegion = regions[active];

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 touch-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = toView(e);
        setDraft(rectFrom(start.current, start.current));
      }}
      onPointerMove={(e) => start.current && setDraft(rectFrom(start.current, toView(e)))}
      onPointerUp={(e) => commit(toView(e))}
      onPointerCancel={() => commit()}
      onLostPointerCapture={() => commit()}
    >
      {cr &&
        regions.map((reg, i) => {
          const shown = i === active && draft ? draft : reg.rect;
          if (!shown) return null;
          return (
            <div
              key={reg.label}
              className={`pointer-events-none absolute rounded-md border-[3px] border-dashed ${i === active ? 'border-cream bg-teal/25' : 'border-cream/60 bg-ink/10'}`}
              style={{ left: cr.x + shown.x * cr.w, top: cr.y + shown.y * cr.h, width: shown.w * cr.w, height: shown.h * cr.h }}
            >
              <span className={`absolute -top-7 ${shown.x > 0.6 ? "right-0" : "left-0"} rounded-full bg-ink/85 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-cream`}>{reg.label}</span>
            </div>
          );
        })}
      {activeRegion && !activeRegion.rect && !draft && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-2xl bg-ink/80 px-3 py-2 text-center text-sm font-medium text-cream">
          Drag on the picture to mark the {activeRegion.label.toLowerCase()}
        </div>
      )}
    </div>
  );
}
