import { AlertTriangle, Camera as CameraIcon, CheckCircle2, Eye, Loader2, RefreshCw, SwitchCamera, Sun } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { GameInfo } from '@/data/catalog';
import type { Camera } from '@/referee/camera';
import { assessVideoFrame, LIGHT_ADVICE, type FrameQuality } from '@/referee/frameQuality';
import { CameraStage } from './CameraStage';

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Shared pre-match screen for camera-refereed games: how to place the phone,
 * permission, live preview, lighting check, model status, and a confirm step.
 */
export function CameraSetup({
  game,
  camera,
  positioning,
  diagram,
  modelStatus,
  stageOverlayRef,
  stageChildren,
  below,
  ready,
  notReadyReason,
  startLabel = 'Start match',
  onStart,
}: {
  game: GameInfo;
  camera: Camera;
  positioning: string[];
  diagram: ReactNode;
  modelStatus: ModelStatus;
  stageOverlayRef?: React.RefObject<HTMLCanvasElement | null>;
  stageChildren?: ReactNode;
  below?: ReactNode;
  /** Game-specific readiness (e.g. goal marked). Camera + model readiness is checked here. */
  ready: boolean;
  notReadyReason?: string;
  startLabel?: string;
  onStart: () => void;
}) {
  const [quality, setQuality] = useState<FrameQuality | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (camera.status !== 'live') return;
    const id = setInterval(() => camera.videoRef.current && setQuality(assessVideoFrame(camera.videoRef.current)), 700);
    return () => clearInterval(id);
  }, [camera.status, camera.videoRef]);

  const live = camera.status === 'live';
  const canStart = live && modelStatus === 'ready' && ready && confirmed;
  const blocker = !live
    ? 'Turn on the camera first.'
    : modelStatus === 'loading'
      ? 'Loading the referee model…'
      : modelStatus === 'error'
        ? 'The referee model failed to load.'
        : !ready
          ? notReadyReason
          : !confirmed
            ? 'Confirm the camera position.'
            : undefined;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 pb-32">
      <section className="card flex flex-col gap-4 p-5">
        <h2 className="font-display text-xl font-semibold">Set up the referee</h2>
        <div className="grid items-center gap-4 sm:grid-cols-[1fr_200px]">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-ink/85 marker:font-semibold marker:text-teal">
            {positioning.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <div className="mx-auto w-full max-w-[220px]">{diagram}</div>
        </div>
        <p className="flex gap-2 rounded-2xl bg-olive/20 p-3 text-sm text-ink/85">
          <Eye className="mt-0.5 size-4 shrink-0 text-teal" />
          <span>
            <strong>What Hessa watches:</strong> {game.refereeWatches} Video stays on this phone — nothing is recorded or uploaded.
          </span>
        </p>
      </section>

      {!live && (
        <section className="card flex flex-col items-center gap-3 p-6 text-center">
          <CameraIcon className="size-10 text-teal" />
          <p className="max-w-sm text-ink/80">Hessa needs the camera to referee. Your browser will ask for permission.</p>
          {camera.error && (
            <p className="flex max-w-md items-start gap-2 rounded-2xl bg-alert/10 p-3 text-left text-sm text-alert" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {camera.error.message}
            </p>
          )}
          <button className="btn-primary" onClick={() => camera.start()} disabled={camera.status === 'starting'}>
            {camera.status === 'starting' ? <Loader2 className="size-5 animate-spin" /> : <CameraIcon className="size-5" />}
            {camera.error ? 'Try again' : 'Turn on camera'}
          </button>
        </section>
      )}

      {live && (
        <section className="flex flex-col gap-3">
          <CameraStage camera={camera} overlayRef={stageOverlayRef} className="aspect-[3/4] w-full rounded-3xl sm:aspect-video">
            {stageChildren}
            {camera.hasMultiple && (
              <button
                className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-ink/70 text-cream"
                onClick={camera.flip}
                aria-label="Switch camera"
              >
                <SwitchCamera className="size-5" />
              </button>
            )}
          </CameraStage>
          <div className="flex flex-wrap gap-2 text-sm">
            <StatusChip ok={quality?.verdict === 'ok'} icon={<Sun className="size-4" />}>
              {quality ? LIGHT_ADVICE[quality.verdict] : 'Checking light…'}
            </StatusChip>
            <StatusChip ok={modelStatus === 'ready'} icon={modelStatus === 'loading' ? <Loader2 className="size-4 animate-spin" /> : undefined}>
              {modelStatus === 'ready'
                ? 'Referee model ready (runs on this phone)'
                : modelStatus === 'error'
                  ? 'Referee model failed to load'
                  : 'Loading referee model… (first time can take a moment)'}
            </StatusChip>
          </div>
          {modelStatus === 'error' && (
            <button className="btn-secondary self-start" onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" /> Reload and retry
            </button>
          )}
          {below}
          <label className="card flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
            <input type="checkbox" className="size-6 accent-teal" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span className="font-medium">The phone is steady and the camera can see everything described above.</span>
          </label>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-cream/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-ink/70">{blocker ?? 'All set.'}</p>
          <button className="btn-primary" disabled={!canStart} onClick={onStart}>
            {startLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ ok, icon, children }: { ok?: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`chip py-1.5 text-sm ${ok ? 'bg-teal/15 text-ink' : 'bg-dusty/40 text-ink'}`}>
      {icon ?? (ok ? <CheckCircle2 className="size-4 text-teal" /> : <AlertTriangle className="size-4" />)}
      {children}
    </span>
  );
}
