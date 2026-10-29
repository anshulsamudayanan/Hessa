import { geoCentroid, geoEqualEarth, geoPath } from 'd3-geo';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import worldData from 'world-atlas/countries-110m.json';
import { COUNTRIES, type CountryId } from '@/data/catalog';

const W = 1000;
const H = 520;
const MIN_K = 1;
const MAX_K = 8;

type CountryFeature = Feature<Geometry, { name: string }>;

const world = feature(worldData as any, (worldData as any).objects.countries) as unknown as FeatureCollection<
  Geometry,
  { name: string }
>;
const FEATURES: CountryFeature[] = world.features.filter((f) => f.id !== '010'); // drop Antarctica

/** All country names on the map, used by search. */
export const MAP_COUNTRY_NAMES = FEATURES.map((f) => ({ iso: String(f.id), name: f.properties.name }));

const PLAYABLE = new Map(COUNTRIES.map((c) => [c.isoNumeric, c]));

// UAE and India are close together; nudge their labels apart (label units).
const LABEL_DX: Partial<Record<CountryId, number>> = { uae: -26, india: 24 };

const pinLabel = (name: string) =>
  name === 'United Arab Emirates' ? 'UAE' : name === 'United States' ? 'USA' : name;

interface Transform {
  k: number;
  x: number;
  y: number;
}

const clampTransform = ({ k, x, y }: Transform): Transform => {
  const kk = Math.min(MAX_K, Math.max(MIN_K, k));
  // Keep at least part of the map on screen.
  const minX = W - W * kk;
  const minY = H - H * kk;
  return { k: kk, x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
};

interface WorldMapProps {
  onSelectPlayable: (id: CountryId) => void;
  onSelectOther: (name: string) => void;
  /** ISO numeric id of a country to outline (e.g. from search). */
  highlightIso?: string | null;
}

export function WorldMap({ onSelectPlayable, onSelectOther, highlightIso }: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [t, setT] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; startDist?: number; startT?: Transform; last?: { x: number; y: number } }>({
    moved: false,
  });
  const animRef = useRef<number>(0);

  const { projection, path } = useMemo(() => {
    const projection = geoEqualEarth().fitExtent(
      [
        [8, 8],
        [W - 8, H - 8],
      ],
      { type: 'FeatureCollection', features: FEATURES } as any,
    );
    return { projection, path: geoPath(projection) };
  }, []);

  const shapes = useMemo(
    () => FEATURES.map((f) => ({ iso: String(f.id), name: f.properties.name, d: path(f) ?? '' })),
    [path],
  );

  const pins = useMemo(
    () =>
      COUNTRIES.map((c) => {
        const f = FEATURES.find((ft) => ft.id === c.isoNumeric)!;
        const [px, py] = projection(geoCentroid(f))!;
        return { country: c, x: px, y: py };
      }),
    [projection],
  );

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  // Pins and labels keep a readable on-screen size on narrow phones.
  const [uiScale, setUiScale] = useState(1);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const ro = new ResizeObserver(() => setUiScale(Math.min(2.6, Math.max(1, W / (svg.clientWidth || W)))));
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  const toSvgPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
  };

  const zoomAt = (factor: number, cx = W / 2, cy = H / 2) => {
    setT((prev) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, prev.k * factor));
      const f = k / prev.k;
      return clampTransform({ k, x: cx - (cx - prev.x) * f, y: cy - (cy - prev.y) * f });
    });
  };

  const animateTo = (target: Transform, done?: () => void) => {
    cancelAnimationFrame(animRef.current);
    const from = t;
    const start = performance.now();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduce ? 0 : 500;
    const step = (now: number) => {
      const p = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setT({ k: from.k + (target.k - from.k) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e });
      if (p < 1) animRef.current = requestAnimationFrame(step);
      else done?.();
    };
    animRef.current = requestAnimationFrame(step);
  };

  const focusCountry = (iso: string, done?: () => void) => {
    const f = FEATURES.find((ft) => String(ft.id) === iso);
    if (!f) return;
    const [[x0, y0], [x1, y1]] = path.bounds(f);
    const k = Math.min(MAX_K, Math.max(1.5, 0.6 / Math.max((x1 - x0) / W, (y1 - y0) / H)));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    animateTo(clampTransform({ k, x: W / 2 - cx * k, y: H / 2 - cy * k }), done);
  };

  useEffect(() => {
    if (highlightIso) focusCountry(highlightIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIso]);

  const selectIso = (iso: string, name: string) => {
    const playable = PLAYABLE.get(iso);
    if (playable) focusCountry(iso, () => onSelectPlayable(playable.id));
    else onSelectOther(name);
  };

  // --- Pan & pinch -------------------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, toSvgPoint(e.clientX, e.clientY));
    cancelAnimationFrame(animRef.current);
    if (pointers.current.size === 1) {
      gesture.current = { moved: false, last: toSvgPoint(e.clientX, e.clientY) };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { moved: true, startDist: Math.hypot(a.x - b.x, a.y - b.y), startT: t };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (pointers.current.size === 2 && g.startDist && g.startT) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const k = Math.min(MAX_K, Math.max(MIN_K, g.startT.k * (dist / g.startDist)));
      const f = k / g.startT.k;
      setT(clampTransform({ k, x: mid.x - (mid.x - g.startT.x) * f, y: mid.y - (mid.y - g.startT.y) * f }));
    } else if (pointers.current.size === 1 && g.last) {
      const dx = p.x - g.last.x;
      const dy = p.y - g.last.y;
      if (!g.moved && Math.hypot(dx, dy) < 6) return;
      g.moved = true;
      g.last = p;
      setT((prev) => clampTransform({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      const [only] = [...pointers.current.values()];
      gesture.current = { moved: true, last: only };
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const p = toSvgPoint(e.clientX, e.clientY);
    zoomAt(e.deltaY < 0 ? 1.25 : 0.8, p.x, p.y);
  };

  const handleTap = (iso: string, name: string) => {
    if (gesture.current.moved) return;
    selectIso(iso, name);
  };

  const pinR = (7 * uiScale) / Math.sqrt(t.k);
  const labelScale = (0.6 * uiScale) / Math.sqrt(t.k);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#dfe3da] ring-1 ring-ink/10">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none select-none"
        role="img"
        aria-label="World map. Highlighted countries have games you can play."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
          {shapes.map(({ iso, name, d }) => {
            const playable = PLAYABLE.has(iso);
            const hovered = hoverIso === iso;
            const highlighted = highlightIso === iso;
            return (
              <path
                key={iso + name}
                d={d}
                fill={playable ? (hovered ? '#3e5759' : '#4D6A6D') : highlighted ? '#C9ADA1' : hovered ? '#b4b49a' : '#c3c2aa'}
                stroke="#EAE0CC"
                strokeWidth={0.6 / t.k}
                className="cursor-pointer transition-colors duration-150"
                onPointerEnter={() => setHoverIso(iso)}
                onPointerLeave={() => setHoverIso((h) => (h === iso ? null : h))}
                onClick={() => handleTap(iso, name)}
              >
                <title>{playable ? `${name} — tap to play` : name}</title>
              </path>
            );
          })}
          {pins.map(({ country, x, y }) => (
            <g
              key={country.id}
              transform={`translate(${x} ${y})`}
              className="cursor-pointer"
              onClick={() => handleTap(country.isoNumeric, country.name)}
            >
              <circle r={pinR} fill="#C9ADA1" className="pin-pulse" />
              <circle r={pinR * 0.62} fill="#EAE0CC" stroke="#1F3133" strokeWidth={2 / t.k} />
              <circle r={pinR * 2.2} fill="transparent" />
              <g transform={`translate(0 ${-pinR * 0.9}) scale(${labelScale}) translate(${t.k < 2 ? (LABEL_DX[country.id] ?? 0) : 0} 0)`}>
                <rect
                  x={-pinLabel(country.name).length * 4.6 - 10}
                  y={-30}
                  width={pinLabel(country.name).length * 9.2 + 20}
                  height={24}
                  rx={12}
                  fill="#1F3133"
                  opacity={0.9}
                />
                <text y={-13.5} textAnchor="middle" fill="#EAE0CC" fontSize={14} fontWeight={700} fontFamily="Plus Jakarta Sans, system-ui">
                  {pinLabel(country.name)}
                </text>
              </g>
            </g>
          ))}
        </g>
      </svg>
      <div className="absolute right-2 bottom-2 flex flex-col gap-1.5">
        <button className="grid size-10 place-items-center rounded-xl bg-paper/95 text-ink shadow ring-1 ring-ink/10" onClick={() => zoomAt(1.5)} aria-label="Zoom in">
          <Plus className="size-5" />
        </button>
        <button className="grid size-10 place-items-center rounded-xl bg-paper/95 text-ink shadow ring-1 ring-ink/10" onClick={() => zoomAt(1 / 1.5)} aria-label="Zoom out">
          <Minus className="size-5" />
        </button>
        {t.k > 1.01 && (
          <button className="grid size-10 place-items-center rounded-xl bg-paper/95 text-ink shadow ring-1 ring-ink/10" onClick={() => animateTo({ k: 1, x: 0, y: 0 })} aria-label="Reset map">
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
