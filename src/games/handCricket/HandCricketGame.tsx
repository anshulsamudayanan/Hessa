import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { Hand, Keyboard, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CameraSetup, type ModelStatus } from '@/components/CameraSetup';
import { CameraStage, prepareOverlay } from '@/components/CameraStage';
import { loadNames, PlayerNames, saveNames } from '@/components/PlayerNames';
import { ResultScreen } from '@/components/ResultScreen';
import { TopBar } from '@/components/TopBar';
import { GAMES } from '@/data/catalog';
import { navigate } from '@/lib/router';
import { announcer } from '@/referee/announcer';
import { useCamera } from '@/referee/camera';
import { useFrameLoop } from '@/referee/frameLoop';
import { loadHandLandmarker, monotonicClock } from '@/referee/vision';
import { useWakeLock } from '@/referee/wakeLock';
import { drawHands, observeHands } from './observe';
import { RevealDetector, type RevealOutcome, type Side, type SideResult, type UnclearReason } from './revealDetector';
import { applyBall, newMatch, type HandCricketState, type PlayerIndex } from './rules';

const GAME = GAMES['hand-cricket'];
type Phase = 'players' | 'camera' | 'match' | 'result';

const SIGNS: [string, string][] = [
  ['✊', 'Fist = ready'],
  ['1–4', 'Raise that many fingers'],
  ['5', 'Open hand'],
  ['6', 'Thumb only 👍'],
];

const REASON_TEXT: Record<UnclearReason, string> = {
  missing: 'hand not visible',
  fist: 'still a fist',
  unstable: 'fingers unclear',
  changed: 'changed number mid-reveal',
  'two-hands-one-side': 'two hands on one side',
};

export function HandCricketGame() {
  const camera = useCamera('environment');
  const [phase, setPhase] = useState<Phase>('players');
  const [names, setNames] = useState(() => loadNames(2));
  const [firstBatter, setFirstBatter] = useState<PlayerIndex>(0);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const landmarker = useRef<HandLandmarker | null>(null);
  const [match, setMatch] = useState<HandCricketState | null>(null);

  useEffect(() => {
    if (phase !== 'camera' || modelStatus !== 'idle') return;
    setModelStatus('loading');
    loadHandLandmarker()
      .then((l) => {
        landmarker.current = l;
        setModelStatus('ready');
      })
      .catch((err) => {
        console.error(err);
        setModelStatus('error');
      });
  }, [phase, modelStatus]);

  const exit = () => {
    camera.stop();
    navigate('/country/india');
  };

  const players = names.map((n, i) => n.trim() || `Player ${i + 1}`) as [string, string];

  if (phase === 'result' && match?.result) {
    const first = match.balls[0]?.batter ?? 0;
    return (
      <div className="min-h-dvh">
        <TopBar title={GAME.name} onBack={exit} backLabel="India" />
        <ResultScreen
          headline={match.result.winner === null ? 'It’s a tie!' : `${match.players[match.result.winner]} wins!`}
          scores={[0, 1].map((i) => ({ name: match.players[i], score: String(match.scores[i]), winner: match.result!.winner === i }))}
          summary={<MatchSummary match={match} firstBatter={first} />}
          onReplay={() => {
            setMatch(newMatch(players, firstBatter === 0 ? 1 : 0));
            setFirstBatter((f) => (f === 0 ? 1 : 0));
            setPhase('match');
          }}
          onBack={exit}
        />
      </div>
    );
  }

  if (phase === 'match' && match && landmarker.current) {
    return (
      <MatchScreen
        camera={camera}
        landmarker={landmarker.current}
        match={match}
        setMatch={setMatch}
        onFinished={() => setPhase('result')}
        onExit={() => setPhase('camera')}
      />
    );
  }

  return (
    <div className="min-h-dvh">
      <TopBar title={GAME.name} onBack={phase === 'camera' ? () => setPhase('players') : exit} backLabel={phase === 'camera' ? 'Players' : 'India'} />
      {phase === 'players' && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 pb-12">
          <section className="card flex flex-col gap-4 p-5">
            <h2 className="font-display text-xl font-semibold">Players</h2>
            <PlayerNames names={names} onChange={setNames} labels={['Stands on the LEFT of the screen', 'Stands on the RIGHT of the screen']} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold text-ink/75">Who bats first?</legend>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1].map((i) => (
                  <button
                    key={i}
                    className={firstBatter === i ? 'btn-primary px-2' : 'btn-secondary px-2'}
                    onClick={() => setFirstBatter(i as PlayerIndex)}
                  >
                    <span className="truncate">{players[i]}</span>
                  </button>
                ))}
                <button className="btn-secondary px-2" onClick={() => setFirstBatter(Math.random() < 0.5 ? 0 : 1)}>
                  Toss
                </button>
              </div>
            </fieldset>
          </section>
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="font-display text-xl font-semibold">How to play</h2>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-ink/85">
              <li>Both players hold up a fist. Hessa counts down: 3, 2, 1, SHOW.</li>
              <li>On SHOW, both reveal a number and hold it still for a second.</li>
              <li>Different numbers: the batter scores their number. Same number: OUT.</li>
              <li>After an out, swap roles. The second batter chases the target.</li>
              <li>Fists again to start the next ball.</li>
            </ol>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SIGNS.map(([sign, label]) => (
                <div key={label} className="rounded-2xl bg-olive/20 p-3 text-center">
                  <div className="text-2xl font-bold">{sign}</div>
                  <div className="text-xs text-ink/75">{label}</div>
                </div>
              ))}
            </div>
          </section>
          <button
            className="btn-primary self-end"
            onClick={() => {
              saveNames(players);
              setPhase('camera');
            }}
          >
            Next: camera setup
          </button>
        </div>
      )}
      {phase === 'camera' && (
        <CameraPractice
          camera={camera}
          landmarker={landmarker}
          modelStatus={modelStatus}
          players={players}
          onStart={() => {
            announcer.unlock();
            setMatch(newMatch(players, firstBatter));
            setPhase('match');
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function PositionDiagram() {
  return (
    <svg viewBox="0 0 200 170" className="w-full" role="img" aria-label="Two players side by side about 1.5 metres in front of the phone, hands at chest height">
      <path d="M100 150 20 40h160z" fill="#A0A083" opacity="0.25" />
      <rect x="88" y="140" width="24" height="22" rx="4" fill="#1F3133" />
      <circle cx="100" cy="146" r="3" fill="#EAE0CC" />
      {[60, 140].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="40" r="16" fill={i === 0 ? '#C9ADA1' : '#A0A083'} />
          <rect x={x - 6} y="62" width="12" height="16" rx="5" fill="#4D6A6D" />
          <text x={x} y="45" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1F3133">
            {i === 0 ? 'L' : 'R'}
          </text>
        </g>
      ))}
      <line x1="100" y1="20" x2="100" y2="130" stroke="#1F3133" strokeDasharray="4 4" opacity="0.4" />
      <text x="100" y="105" textAnchor="middle" fontSize="11" fill="#1F3133">≈ 1–1.5 m</text>
    </svg>
  );
}

function CameraPractice({
  camera,
  landmarker,
  modelStatus,
  players,
  onStart,
}: {
  camera: ReturnType<typeof useCamera>;
  landmarker: React.RefObject<HandLandmarker | null>;
  modelStatus: ModelStatus;
  players: [string, string];
  onStart: () => void;
}) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const clock = useRef(monotonicClock());
  const [readings, setReadings] = useState<Record<Side, number | null | undefined>>({ left: undefined, right: undefined });
  const last = useRef('');
  const live = camera.status === 'live' && modelStatus === 'ready';

  useFrameLoop(
    camera.videoRef,
    live,
    (video) => {
      const res = landmarker.current!.detectForVideo(video, clock.current());
      const { obs, hands } = observeHands(res, camera.mirrored, performance.now());
      const o = prepareOverlay(overlayRef.current, video);
      if (o) drawHands(o, hands);
      const next = { left: obs.left ? obs.left.count : undefined, right: obs.right ? obs.right.count : undefined };
      const key = JSON.stringify(next);
      if (key !== last.current) {
        last.current = key;
        setReadings(next);
      }
    },
    20,
  );

  const bothVisible = readings.left !== undefined && readings.right !== undefined;

  return (
    <CameraSetup
      game={GAME}
      camera={camera}
      modelStatus={modelStatus}
      positioning={[
        'Lean the phone against something steady at about chest height, camera facing you.',
        'Stand or sit side by side, about 1–1.5 m away. Left player on the left of the screen.',
        'Hold one hand each at chest height, palm toward the camera, inside your half of the picture.',
        'Use a bright room and avoid a window behind you.',
      ]}
      diagram={<PositionDiagram />}
      stageOverlayRef={overlayRef}
      below={
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <Hand className="size-5 text-teal" /> Test the referee: show some numbers
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['left', 'right'] as const).map((side, i) => (
              <div key={side} className="rounded-2xl bg-olive/20 p-3 text-center">
                <div className="truncate text-sm text-ink/75">{players[i]}</div>
                <div className="font-display text-4xl font-bold">
                  {readings[side] === undefined ? '—' : readings[side] === null ? '?' : readings[side] === 0 ? '✊' : readings[side]}
                </div>
                <div className="text-xs text-ink/60">
                  {readings[side] === undefined ? 'no hand seen' : readings[side] === null ? 'not sure — adjust hand' : 'read'}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-ink/70">
            If a number keeps reading wrong, spread your fingers clearly, face your palm to the camera, and move a little closer.
          </p>
        </div>
      }
      ready={bothVisible}
      notReadyReason="Both players: hold up a hand so Hessa can see it."
      onStart={onStart}
    />
  );
}

// ---------------------------------------------------------------------------

interface Banner {
  tone: 'runs' | 'out' | 'unclear' | 'info';
  text: string;
  detail?: string;
}

function MatchScreen({
  camera,
  landmarker,
  match,
  setMatch,
  onFinished,
  onExit,
}: {
  camera: ReturnType<typeof useCamera>;
  landmarker: HandLandmarker;
  match: HandCricketState;
  setMatch: (m: HandCricketState) => void;
  onFinished: () => void;
  onExit: () => void;
}) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const detector = useRef(new RevealDetector());
  const clock = useRef(monotonicClock());
  const matchRef = useRef(match);
  matchRef.current = match;
  const [paused, setPaused] = useState(false);
  const [voice, setVoice] = useState(announcer.voiceEnabled);
  const [hud, setHud] = useState<{ phase: string; beat?: number }>({ phase: 'need-neutral' });
  const [banner, setBanner] = useState<Banner | null>(null);
  const [unclearStreak, setUnclearStreak] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const manualId = useRef(1_000_000);
  const finished = !!match.result;
  useWakeLock(!paused && !finished);

  useEffect(() => {
    if (finished) {
      const id = setTimeout(onFinished, 3500);
      return () => clearTimeout(id);
    }
  }, [finished, onFinished]);

  const batterSide: Side = match.batting === 0 ? 'left' : 'right';

  const applyNumbers = (batterShow: number, bowlerShow: number, eventId: number, source: 'camera' | 'manual') => {
    const { state, decision } = applyBall(matchRef.current, { eventId, batterShow, bowlerShow, source });
    if (!decision.applied) return;
    matchRef.current = state;
    setMatch(state);
    setUnclearStreak(0);
    const prefix = source === 'manual' ? 'Entered manually: ' : 'Detected: ';
    setBanner({
      tone: decision.out ? 'out' : 'runs',
      text: prefix + decision.message,
      detail: source === 'manual' ? 'Not camera-verified.' : undefined,
    });
    if (decision.out) {
      announcer.whistle('double');
      announcer.say(decision.matchOver ? `Out! ${state.result?.text}` : `Out! ${state.players[state.batting]} needs ${state.target} to win.`);
    } else {
      announcer.chime();
      announcer.say(decision.matchOver ? `${decision.runs}. ${state.result?.text}` : `${decision.runs} run${decision.runs === 1 ? '' : 's'}`);
    }
  };

  const handleOutcome = (o: RevealOutcome) => {
    if (o.kind === 'reveal') {
      const bat = batterSide === 'left' ? o.left : o.right;
      const bowl = batterSide === 'left' ? o.right : o.left;
      applyNumbers(bat, bowl, o.id, 'camera');
      return;
    }
    const describe = (r: SideResult, who: string) => (r.ok ? `${who}: ${r.value}` : `${who}: ${REASON_TEXT[r.reason]}`);
    const m = matchRef.current;
    const left = describe(o.left, m.players[0]);
    const right = describe(o.right, m.players[1]);
    setBanner({ tone: 'unclear', text: 'Couldn’t identify both numbers — please try again', detail: `${left} · ${right}` });
    setUnclearStreak((n) => n + 1);
    announcer.beep(330, 0.25);
    announcer.say('Try again');
  };

  useFrameLoop(
    camera.videoRef,
    !paused && !finished && !manualOpen,
    (video) => {
      const res = landmarker.detectForVideo(video, clock.current());
      const { obs, hands } = observeHands(res, camera.mirrored, performance.now());
      const o = prepareOverlay(overlayRef.current, video);
      if (o) drawHands(o, hands);
      const u = detector.current.update(obs);
      if (u.events.includes('beat')) announcer.beep(660, 0.1);
      if (u.events.includes('show')) announcer.beep(1320, 0.22, 0.25);
      if (u.events.includes('abort')) setBanner({ tone: 'info', text: 'Countdown stopped — keep both hands in view.' });
      if (u.outcome) handleOutcome(u.outcome);
      setHud((prev) => (prev.phase === u.phase && prev.beat === u.beat ? prev : { phase: u.phase, beat: u.beat }));
    },
    30,
  );

  const togglePause = () => {
    detector.current.reset();
    setPaused((p) => !p);
  };

  const batter = match.players[match.batting];
  const bowler = match.players[match.batting === 0 ? 1 : 0];
  const inningsBalls = match.balls.filter((b) => b.innings === match.innings);

  const prompt =
    hud.phase === 'countdown'
      ? String(hud.beat ?? '')
      : hud.phase === 'reveal'
        ? 'SHOW!'
        : hud.phase === 'need-neutral' && !finished && !paused
          ? null
          : null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink text-cream">
      {/* Scoreboard */}
      <div className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button className="grid size-11 place-items-center rounded-full bg-cream/10" onClick={onExit} aria-label="End match">
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-xs font-semibold tracking-wide text-cream/70 uppercase">
            Innings {match.innings} · {batter} batting
          </div>
          <div className="font-display text-2xl leading-tight font-bold tabular-nums">
            {match.scores[match.batting]}
            {match.target !== null && <span className="ml-2 text-base font-medium text-cream/75">/ target {match.target}</span>}
          </div>
        </div>
        <button
          className="grid size-11 place-items-center rounded-full bg-cream/10"
          onClick={() => {
            announcer.voiceEnabled = !voice;
            setVoice(!voice);
          }}
          aria-label={voice ? 'Mute voice calls' : 'Unmute voice calls'}
        >
          {voice ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </button>
        <button className="grid size-11 place-items-center rounded-full bg-cream/10" onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'}>
          {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
        </button>
      </div>

      <CameraStage camera={camera} overlayRef={overlayRef} className="min-h-0 flex-1">
        {/* Roles per side */}
        {(['left', 'right'] as const).map((side) => {
          const isBat = side === batterSide;
          const name = side === 'left' ? match.players[0] : match.players[1];
          return (
            <div key={side} className={`absolute bottom-3 ${side === 'left' ? 'left-3' : 'right-3'} max-w-[45%]`}>
              <div className={`chip text-sm ${isBat ? 'bg-dusty text-ink' : 'bg-olive text-ink'}`}>
                {isBat ? 'BAT' : 'BOWL'} · <span className="truncate">{name}</span>
              </div>
            </div>
          );
        })}
        {prompt && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="font-display text-8xl font-bold text-cream drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">{prompt}</div>
          </div>
        )}
        {paused && (
          <div className="absolute inset-0 grid place-items-center bg-ink/60">
            <button className="btn-on-dark" onClick={togglePause}>
              <Play className="size-5" /> Resume
            </button>
          </div>
        )}
      </CameraStage>

      {/* Referee panel */}
      <div className="flex flex-col gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-cream/80">
          <span className={`size-2.5 rounded-full ${paused ? 'bg-dusty' : 'animate-pulse bg-olive'}`} />
          {paused
            ? 'Referee paused'
            : finished
              ? 'Match over'
              : hud.phase === 'need-neutral'
                ? 'Both players: show a fist to start the ball'
                : hud.phase === 'countdown'
                  ? 'Get ready…'
                  : hud.phase === 'reveal'
                    ? 'Hold your numbers still'
                    : 'Fists down — next ball soon'}
          <span className="ml-auto text-cream/60">
            {bowler} bowling · ball {inningsBalls.length + 1}
          </span>
        </div>
        <div
          className={`min-h-16 rounded-2xl px-4 py-3 ${
            banner?.tone === 'out' ? 'bg-dusty text-ink' : banner?.tone === 'runs' ? 'bg-teal text-cream' : banner ? 'bg-cream/15' : 'bg-cream/5'
          }`}
        >
          <div className="text-lg leading-snug font-bold">{banner?.text ?? 'Waiting for the first ball.'}</div>
          {banner?.detail && <div className="text-sm opacity-80">{banner.detail}</div>}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {inningsBalls.slice(-12).map((b) => (
            <span
              key={b.eventId}
              className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${b.out ? 'bg-dusty text-ink' : 'bg-cream/15'}`}
              title={b.source === 'manual' ? 'Entered manually' : 'Camera'}
            >
              {b.out ? 'W' : b.runs}
            </span>
          ))}
          {unclearStreak >= 2 && !finished && (
            <button className="ml-auto chip shrink-0 bg-cream/90 py-2 text-ink" onClick={() => setManualOpen(true)}>
              <Keyboard className="size-4" /> Enter ball manually
            </button>
          )}
        </div>
      </div>

      {manualOpen && (
        <ManualEntry
          batter={batter}
          bowler={bowler}
          onCancel={() => {
            detector.current.reset();
            setManualOpen(false);
          }}
          onSubmit={(bat, bowl) => {
            detector.current.reset();
            setManualOpen(false);
            applyNumbers(bat, bowl, manualId.current++, 'manual');
          }}
        />
      )}
    </div>
  );
}

function ManualEntry({ batter, bowler, onSubmit, onCancel }: { batter: string; bowler: string; onSubmit: (bat: number, bowl: number) => void; onCancel: () => void }) {
  const [bat, setBat] = useState<number | null>(null);
  const [bowl, setBowl] = useState<number | null>(null);
  return (
    <div className="absolute inset-0 z-50 grid place-items-end bg-ink/70 sm:place-items-center" role="dialog" aria-modal="true" aria-label="Enter ball manually">
      <div className="w-full max-w-md rounded-t-3xl bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink sm:rounded-3xl">
        <h2 className="font-display text-xl font-semibold">Enter this ball manually</h2>
        <p className="mt-1 text-sm text-ink/70">The camera couldn’t read the last reveals. Agree on what both players showed — this ball will be marked as not camera-verified.</p>
        {[
          [batter + ' (batting)', bat, setBat],
          [bowler + ' (bowling)', bowl, setBowl],
        ].map(([label, value, set]) => (
          <div key={label as string} className="mt-4">
            <div className="mb-2 text-sm font-semibold">{label as string}</div>
            <div className="grid grid-cols-6 gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} className={value === n ? 'btn-primary px-0' : 'btn-secondary px-0'} onClick={() => (set as (n: number) => void)(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="mt-5 flex gap-2">
          <button className="btn-secondary flex-1" onClick={onCancel}>
            Back to camera
          </button>
          <button className="btn-primary flex-1" disabled={bat === null || bowl === null} onClick={() => onSubmit(bat!, bowl!)}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchSummary({ match, firstBatter }: { match: HandCricketState; firstBatter: PlayerIndex }) {
  const manual = match.balls.filter((b) => b.source === 'manual').length;
  return (
    <div className="flex flex-col gap-3">
      {[1, 2].map((inn) => {
        const balls = match.balls.filter((b) => b.innings === inn);
        if (!balls.length) return null;
        const who = inn === 1 ? firstBatter : firstBatter === 0 ? 1 : 0;
        return (
          <div key={inn}>
            <div className="text-sm font-semibold">
              Innings {inn}: {match.players[who]} — {match.scores[who]} off {balls.length} ball{balls.length === 1 ? '' : 's'}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {balls.map((b) => (
                <span key={b.eventId} className={`grid size-7 place-items-center rounded-full text-xs font-bold ${b.out ? 'bg-dusty' : 'bg-olive/30'}`}>
                  {b.out ? 'W' : b.runs}
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-sm text-ink/70">{match.result?.text}</p>
      {manual > 0 && <p className="text-sm text-ink/70">{manual} ball{manual === 1 ? ' was' : 's were'} entered manually.</p>}
    </div>
  );
}
