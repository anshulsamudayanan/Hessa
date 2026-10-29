import { geoBounds, geoCentroid, geoContains, geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { feature, mesh } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry, MultiLineString } from 'geojson';
import worldData from 'world-atlas/countries-110m.json';
import { COUNTRIES, type Country, type CountryId } from '@/data/catalog';

/**
 * Interactive 3D globe (orthographic projection on a canvas): drag to spin with
 * inertia, pinch / wheel / buttons to zoom, tap a country to open it. Spins
 * slowly on its own when idle (unless the user prefers reduced motion).
 */

type CountryFeature = Feature<Geometry, { name: string }>;

const topo = worldData as any;
const world = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
const FEATURES: CountryFeature[] = world.features.filter((f) => f.id !== '010'); // drop Antarctica
const BORDERS = mesh(topo, topo.objects.countries, (a: any, b: any) => a !== b) as MultiLineString;
const GRATICULE = geoGraticule10();
const SPHERE = { type: 'Sphere' } as const;

/** All country names on the globe, used by search. */
export const MAP_COUNTRY_NAMES = FEATURES.map((f) => ({ iso: String(f.id), name: f.properties.name }));

const PLAYABLE = new Map(COUNTRIES.map((c) => [c.isoNumeric, c]));
const PINS = COUNTRIES.map((c) => {
  const f = FEATURES.find((ft) => ft.id === c.isoNumeric)!;
  return { country: c, lonLat: geoCentroid(f) as [number, number] };
});

const pinLabel = (name: string) => (name === 'United Arab Emirates' ? 'UAE' : name === 'United States' ? 'USA' : name);
// UAE and India sit close together; nudge their labels apart (px).
const LABEL_DX: Partial<Record<CountryId, number>> = { uae: -22, india: 22 };

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const MAX_TILT = 75;
const IDLE_SPIN_DELAY = 3500;
const IDLE_SPIN_DEG_PER_S = 7;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

interface View {
  lambda: number; // rotation: -longitude at the centre
  phi: number; // rotation: -latitude at the centre
  zoom: number;
}

const START: View = { lambda: 10, phi: -18, zoom: 1 };

interface GlobeProps {
  onSelectPlayable: (id: CountryId) => void;
  onSelectOther: (name: string) => void;
  /** ISO numeric id of a country to turn toward and outline (e.g. from search). */
  highlightIso?: string | null;
}

export function Globe({ onSelectPlayable, onSelectOther, highlightIso }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ ...START });
  const size = useRef({ w: 300, dpr: 1 });
  const vel = useRef({ lambda: 0, phi: 0 }); // deg per ms
  const anim = useRef<{ from: View; to: View; start: number; dur: number; done?: () => void } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean; lastX: number; lastY: number; lastT: number; pinchDist?: number } | null>(null);
  const lastInteract = useRef(-Infinity);
  const hover = useRef<string | null>(null);
  const highlight = useRef<string | null>(null);
  const rafId = useRef(0);
  const lastFrame = useRef(0);
  const reducedMotion = useRef(false);
  const [zoomed, setZoomed] = useState(false);

  // --- projection & drawing ------------------------------------------------
  const projection = () => {
    const { w } = size.current;
    const { lambda, phi, zoom } = view.current;
    return geoOrthographic()
      .translate([w / 2, w / 2])
      .scale((w / 2 - 6) * zoom)
      .clipAngle(90)
      .rotate([lambda, phi])
      .precision(0.4);
  };

  const visiblePins = (proj: ReturnType<typeof projection>) => {
    const centre: [number, number] = [-view.current.lambda, -view.current.phi];
    return PINS.filter((p) => geoDistance(p.lonLat, centre) < Math.PI / 2 - 0.12).map((p) => {
      const [x, y] = proj(p.lonLat)!;
      return { ...p, x, y };
    });
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { w, dpr } = size.current;
    const proj = projection();
    const path = geoPath(proj, ctx);
    const r = proj.scale();
    const c = w / 2;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, w);

    // Ocean with soft shading toward the upper-left light.
    const ocean = ctx.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r);
    ocean.addColorStop(0, '#eef0e8');
    ocean.addColorStop(1, '#c9d1c6');
    ctx.beginPath();
    path(SPHERE);
    ctx.fillStyle = ocean;
    ctx.fill();

    ctx.beginPath();
    path(GRATICULE);
    ctx.strokeStyle = 'rgba(77,106,109,0.13)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    for (const f of FEATURES) {
      const iso = String(f.id);
      const playable = PLAYABLE.has(iso);
      ctx.beginPath();
      path(f);
      ctx.fillStyle = playable
        ? hover.current === iso
          ? '#3b5456'
          : '#4D6A6D'
        : highlight.current === iso
          ? '#C9ADA1'
          : hover.current === iso
            ? '#b1b196'
            : '#bfbea5';
      ctx.fill();
    }

    ctx.beginPath();
    path(BORDERS);
    ctx.strokeStyle = 'rgba(234,224,204,0.9)';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Rim shadow for depth.
    const rim = ctx.createRadialGradient(c, c, r * 0.82, c, c, r);
    rim.addColorStop(0, 'rgba(31,49,51,0)');
    rim.addColorStop(1, 'rgba(31,49,51,0.22)');
    ctx.beginPath();
    path(SPHERE);
    ctx.fillStyle = rim;
    ctx.fill();
    ctx.strokeStyle = 'rgba(31,49,51,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pins and labels for playable countries on the visible side.
    ctx.font = '700 12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of visiblePins(proj)) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201,173,161,0.55)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#EAE0CC';
      ctx.fill();
      ctx.strokeStyle = '#1F3133';
      ctx.lineWidth = 2;
      ctx.stroke();

      const label = pinLabel(p.country.name);
      const lw = ctx.measureText(label).width + 16;
      const lx = p.x + (view.current.zoom < 1.8 ? (LABEL_DX[p.country.id] ?? 0) : 0);
      const ly = p.y - 22;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(lx - lw / 2, ly - 10, lw, 20, 10);
      else ctx.rect(lx - lw / 2, ly - 10, lw, 20); // Safari < 16
      ctx.fillStyle = 'rgba(31,49,51,0.9)';
      ctx.fill();
      ctx.fillStyle = '#EAE0CC';
      ctx.fillText(label, lx, ly + 0.5);
    }
  };

  // --- animation loop ----------------------------------------------------------
  const isIdleSpinning = () =>
    !reducedMotion.current && !drag.current && !anim.current && view.current.zoom < 1.3 && performance.now() - lastInteract.current > IDLE_SPIN_DELAY;

  const step = (now: number) => {
    const dt = Math.min(64, now - (lastFrame.current || now));
    lastFrame.current = now;
    const v = view.current;
    let active = false;

    if (anim.current) {
      const a = anim.current;
      const p = Math.min(1, (now - a.start) / a.dur);
      const e = 1 - Math.pow(1 - p, 3);
      const dl = wrap(a.to.lambda - a.from.lambda);
      view.current = {
        lambda: wrap(a.from.lambda + dl * e),
        phi: a.from.phi + (a.to.phi - a.from.phi) * e,
        zoom: a.from.zoom + (a.to.zoom - a.from.zoom) * e,
      };
      if (p >= 1) {
        anim.current = null;
        a.done?.();
      }
      active = true;
    } else if (!drag.current && (Math.abs(vel.current.lambda) > 0.0005 || Math.abs(vel.current.phi) > 0.0005)) {
      // Inertia after a flick.
      v.lambda = wrap(v.lambda + vel.current.lambda * dt);
      v.phi = clamp(v.phi + vel.current.phi * dt, -MAX_TILT, MAX_TILT);
      const decay = Math.pow(0.94, dt / 16);
      vel.current = { lambda: vel.current.lambda * decay, phi: vel.current.phi * decay };
      active = true;
    } else if (isIdleSpinning()) {
      v.lambda = wrap(v.lambda + (IDLE_SPIN_DEG_PER_S * dt) / 1000);
      v.phi += (START.phi - v.phi) * Math.min(1, dt / 1500); // ease back to a gentle tilt
      active = true;
    }

    draw();
    const waitingToSpin = !reducedMotion.current && !drag.current && view.current.zoom < 1.3;
    if (active || waitingToSpin || drag.current) rafId.current = requestAnimationFrame(step);
    else rafId.current = 0;
    setZoomed((z) => (z === view.current.zoom > 1.02 ? z : view.current.zoom > 1.02));
  };

  const requestDraw = () => {
    if (!rafId.current) {
      lastFrame.current = 0;
      rafId.current = requestAnimationFrame(step);
    }
  };

  const interacted = () => {
    lastInteract.current = performance.now();
    requestDraw();
  };

  // --- sizing ------------------------------------------------------------------
  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(w * dpr);
      draw();
      requestDraw();
    });
    ro.observe(canvas);
    // Wheel zoom needs a non-passive listener so the page doesn't scroll instead.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- actions -----------------------------------------------------------------
  const animateTo = (to: View, dur = 700, done?: () => void) => {
    vel.current = { lambda: 0, phi: 0 };
    anim.current = { from: { ...view.current }, to, start: performance.now(), dur: reducedMotion.current ? 1 : dur, done };
    interacted();
  };

  const zoomBy = (factor: number) => {
    anim.current = null;
    view.current.zoom = clamp(view.current.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    interacted();
  };

  const focusCountry = (iso: string, done?: () => void) => {
    const f = FEATURES.find((ft) => String(ft.id) === iso);
    if (!f) return;
    const [lon, lat] = geoCentroid(f);
    const [[x0, y0], [x1, y1]] = geoBounds(f);
    const span = Math.max(Math.abs(x1 - x0) > 180 ? 360 - Math.abs(x1 - x0) : Math.abs(x1 - x0), Math.abs(y1 - y0));
    const zoom = clamp(55 / Math.max(span, 4), 1.3, 3.2);
    animateTo({ lambda: -lon, phi: clamp(-lat, -MAX_TILT, MAX_TILT), zoom }, 800, done);
  };

  useEffect(() => {
    highlight.current = highlightIso ?? null;
    if (highlightIso) focusCountry(highlightIso);
    else requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIso]);

  const select = (iso: string, name: string) => {
    const country: Country | undefined = PLAYABLE.get(iso);
    if (country) focusCountry(iso, () => onSelectPlayable(country.id));
    else {
      highlight.current = iso;
      requestDraw();
      onSelectOther(name);
    }
  };

  // --- hit testing -------------------------------------------------------------
  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const hitTest = (x: number, y: number): { iso: string; name: string } | null => {
    const proj = projection();
    const pin = visiblePins(proj).find((p) => Math.hypot(p.x - x, p.y - y) < 20 || (Math.abs(p.x - x) < 30 && y < p.y - 8 && y > p.y - 34));
    if (pin) return { iso: pin.country.isoNumeric, name: pin.country.name };
    const { w } = size.current;
    if (Math.hypot(x - w / 2, y - w / 2) > proj.scale()) return null;
    const lonLat = proj.invert?.([x, y]);
    if (!lonLat) return null;
    const f = FEATURES.find((ft) => geoContains(ft, lonLat));
    return f ? { iso: String(f.id), name: f.properties.name } : null;
  };

  // --- pointer handling --------------------------------------------------------
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Stop mouse drags from selecting page text; keep keyboard focus on the globe.
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    anim.current = null;
    vel.current = { lambda: 0, phi: 0 };
    if (pointers.current.size === 1) {
      drag.current = { x: p.x, y: p.y, view: { ...view.current }, moved: false, lastX: p.x, lastY: p.y, lastT: performance.now() };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { ...(drag.current ?? { x: p.x, y: p.y, lastX: p.x, lastY: p.y, lastT: 0 }), view: { ...view.current }, moved: true, pinchDist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
    interacted();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = localPoint(e);
    if (!pointers.current.has(e.pointerId)) {
      // Mouse hover (no button pressed).
      if (e.pointerType === 'mouse') {
        const hit = hitTest(p.x, p.y);
        const iso = hit?.iso ?? null;
        if (iso !== hover.current) {
          hover.current = iso;
          e.currentTarget.style.cursor = iso ? 'pointer' : 'grab';
          requestDraw();
        }
      }
      return;
    }
    pointers.current.set(e.pointerId, p);
    const d = drag.current;
    if (!d) return;

    if (pointers.current.size >= 2 && d.pinchDist) {
      const [a, b] = [...pointers.current.values()];
      view.current.zoom = clamp(d.view.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / d.pinchDist), MIN_ZOOM, MAX_ZOOM);
      interacted();
      return;
    }

    const dx = p.x - d.x;
    const dy = p.y - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 6) return;
    d.moved = true;
    e.currentTarget.style.cursor = 'grabbing';
    // Degrees per pixel so the surface roughly follows the finger.
    const dpp = 180 / Math.PI / ((size.current.w / 2) * view.current.zoom);
    view.current.lambda = wrap(d.view.lambda + dx * dpp);
    view.current.phi = clamp(d.view.phi - dy * dpp, -MAX_TILT, MAX_TILT);
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    vel.current = { lambda: ((p.x - d.lastX) * dpp) / dt, phi: (-(p.y - d.lastY) * dpp) / dt };
    d.lastX = p.x;
    d.lastY = p.y;
    d.lastT = now;
    interacted();
  };

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (pointers.current.size === 1) {
      // Pinch ended with one finger still down: continue as a drag from here.
      const [rest] = [...pointers.current.values()];
      drag.current = { x: rest.x, y: rest.y, view: { ...view.current }, moved: true, lastX: rest.x, lastY: rest.y, lastT: performance.now() };
      return;
    }
    drag.current = null;
    e.currentTarget.style.cursor = hover.current ? 'pointer' : 'grab';
    if (!d) return;
    if (!d.moved && !cancelled) {
      vel.current = { lambda: 0, phi: 0 };
      const hit = hitTest(d.x, d.y);
      if (hit) select(hit.iso, hit.name);
    } else if (performance.now() - d.lastT > 80) {
      vel.current = { lambda: 0, phi: 0 }; // finger stopped before lifting: no flick
    }
    interacted();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = view.current;
    const stepDeg = 12 / v.zoom;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => (v.lambda = wrap(v.lambda + stepDeg)),
      ArrowRight: () => (v.lambda = wrap(v.lambda - stepDeg)),
      ArrowUp: () => (v.phi = clamp(v.phi + stepDeg, -MAX_TILT, MAX_TILT)),
      ArrowDown: () => (v.phi = clamp(v.phi - stepDeg, -MAX_TILT, MAX_TILT)),
      '+': () => zoomBy(1.25),
      '=': () => zoomBy(1.25),
      '-': () => zoomBy(0.8),
    };
    const fn = keys[e.key];
    if (!fn) return;
    e.preventDefault();
    anim.current = null;
    fn();
    interacted();
  };

  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <canvas
        ref={canvasRef}
        className="block aspect-square w-full cursor-grab touch-none rounded-3xl select-none"
        role="img"
        tabIndex={0}
        aria-label="Globe. Drag to spin, pinch to zoom, tap a highlighted country to play. Arrow keys rotate it. Playable countries are also listed below."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onPointerLeave={() => {
          if (hover.current && !drag.current) {
            hover.current = null;
            requestDraw();
          }
        }}
        onKeyDown={onKeyDown}
      />
      <div className="absolute right-0 bottom-0 flex flex-col gap-1.5">
        <button className="grid size-10 place-items-center rounded-xl bg-paper/95 text-ink shadow ring-1 ring-ink/10" onClick={() => zoomBy(1.4)} aria-label="Zoom in">
          <Plus className="size-5" />
        </button>
        <button className="grid size-10 place-items-center rounded-xl bg-paper/95 text-ink shadow ring-1 ring-ink/10" onClick={() => zoomBy(1 / 1.4)} aria-label="Zoom out">
          <Minus className="size-5" />
        </button>
        {zoomed && (
          <button
            className="grid size-10 place-items-center rounded-xl bg-paper/95 text-ink shadow ring-1 ring-ink/10"
            onClick={() => animateTo({ ...view.current, zoom: 1, phi: START.phi })}
            aria-label="Zoom out to the whole globe"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
