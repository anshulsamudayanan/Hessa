import type { ObjectDetector } from '@mediapipe/tasks-vision';
import { Ban, CircleDot, Flag as FlagIcon, Pause, Play, Plus, Shirt, Star, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CameraSetup, type ModelStatus } from '@/components/CameraSetup';
import { CameraStage, prepareOverlay, type Overlay } from '@/components/CameraStage';
import { loadNames, saveNames } from '@/components/PlayerNames';
import { RegionPicker } from '@/components/RegionPicker';
import { ResultScreen } from '@/components/ResultScreen';
import { TopBar } from '@/components/TopBar';
import type { GameInfo } from '@/data/catalog';
import { navigate } from '@/lib/router';
import { announcer } from '@/referee/announcer';
import { BallPerception } from '@/referee/ballPerception';
import type { BallObs } from '@/referee/ballTracker';
import { useCamera, type Camera } from '@/referee/camera';
import { useFrameLoop } from '@/referee/frameLoop';
import {
  addScore,
  amendScore,
  boxScore,
  endMatch,
  formatClock,
  newMatch,
  recordAttempt,
  tick,
  type MatchConfig,
  type MatchState,
  type ScoreSource,
  type TeamIndex,
} from '@/referee/matchRules';
import type { ShotVerdict, ShotWatcher } from '@/referee/shotWatcher';
import {
  attributeShot,
  classifyColor,
  colorDistance,
  largestPerson,
  peopleFromDetections,
  type Lab,
  type PersonSighting,
} from '@/referee/teamColors';
import { loadBallDetector, monotonicClock } from '@/referee/vision';
import type { Rect } from '@/referee/viewport';
import { useWakeLock } from '@/referee/wakeLock';

/**
 * Full-match referee shared by football and basketball:
 * teams → camera, regions (and shirt colours) → live match with clock → box score & MVP.
 * The sport supplies the event detector (ShotWatcher) and how events map to teams.
 */
export interface MatchGameConfig {
  game: GameInfo;
  countryId: string;
  countryName: string;
  regionLabels: string[];
  positioning: string[];
  diagram: ReactNode;
  /** Basketball: tell sides apart by shirt colour. */
  useShirtColors: boolean;
  /** `ballR`: ball size measured inside each region during setup (null = not measured). */
  makeWatcher: (regions: Rect[], ballR: (number | null)[]) => ShotWatcher;
  /** Detect on zoomed-in crops (football) and/or follow the ball's colour between detections. */
  perception: { zoom: boolean; color: boolean; fullFrameEvery?: number };
  /** Measure the ball's apparent size inside each region during setup (football depth check). */
  measureBallInRegions?: boolean;
  durations: number[]; // minutes
  defaultMinutes: number;
  targets: (number | null)[];
  defaultTarget: number | null;
  points: number;
  altPoints?: { label: string; points: number };
  scoreWord: string; // "goal" / "basket"
  limitations: string;
}

interface TeamSetup {
  name: string;
  players: string[];
  shirt: { lab: Lab; css: string } | null;
}

type Phase = 'teams' | 'camera' | 'match' | 'result';

export function MatchGame({ config }: { config: MatchGameConfig }) {
  const camera = useCamera('environment');
  const [phase, setPhase] = useState<Phase>('teams');
  const [teams, setTeams] = useState<[TeamSetup, TeamSetup]>(() => {
    const n = loadNames(2);
    return [
      { name: 'Team A', players: [n[0]], shirt: null },
      { name: 'Team B', players: [n[1]], shirt: null },
    ];
  });
  const [minutes, setMinutes] = useState(config.defaultMinutes);
  const [target, setTarget] = useState<number | null>(config.defaultTarget);
  const [teamAAttacks, setTeamAAttacks] = useState<'left' | 'right'>('right');
  const [regions, setRegions] = useState<(Rect | null)[]>(() => config.regionLabels.map(() => null));
  const [ballR, setBallR] = useState<(number | null)[]>(() => config.regionLabels.map(() => null));
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const detector = useRef<ObjectDetector | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);

  useEffect(() => {
    if (phase !== 'camera' || modelStatus !== 'idle') return;
    setModelStatus('loading');
    loadBallDetector(config.useShirtColors)
      .then((d) => {
        detector.current = d;
        setModelStatus('ready');
      })
      .catch((err) => {
        console.error(err);
        setModelStatus('error');
      });
  }, [phase, modelStatus, config.useShirtColors]);

  const exit = () => {
    camera.stop();
    navigate(`/country/${config.countryId}`);
  };

  const cleanTeams = () =>
    teams.map((t, i) => ({
      ...t,
      name: t.name.trim() || `Team ${i === 0 ? 'A' : 'B'}`,
      players: t.players.map((p, j) => p.trim() || `Player ${j + 1}`),
    })) as [TeamSetup, TeamSetup];

  const matchConfig = (): MatchConfig => {
    const t = cleanTeams();
    return { teams: [{ name: t[0].name, players: t[0].players }, { name: t[1].name, players: t[1].players }], durationMs: minutes * 60_000, targetPoints: target };
  };

  if (phase === 'result' && match) {
    return (
      <div className="min-h-dvh">
        <TopBar title={config.game.name} onBack={exit} backLabel={config.countryName} />
        <ResultScreen
          headline={match.winner === null ? 'It’s a draw!' : `${match.teams[match.winner].name} wins!`}
          scores={[0, 1].map((i) => ({ name: match.teams[i].name, score: String(match.scores[i]), winner: match.winner === i }))}
          summary={<MatchReport match={match} config={config} />}
          onReplay={() => {
            setMatch(newMatch(matchConfig()));
            setPhase('match');
          }}
          onBack={exit}
          backLabel={`Back to ${config.countryName}`}
        />
      </div>
    );
  }

  if (phase === 'match' && match && detector.current && regions.every(Boolean)) {
    const shirts = config.useShirtColors && teams[0].shirt && teams[1].shirt ? ([teams[0].shirt.lab, teams[1].shirt.lab] as [Lab, Lab]) : null;
    return (
      <MatchScreen
        config={config}
        camera={camera}
        detector={detector.current}
        regions={regions as Rect[]}
        ballR={ballR}
        shirts={shirts}
        shirtCss={[teams[0].shirt?.css, teams[1].shirt?.css]}
        teamAAttacks={teamAAttacks}
        match={match}
        setMatch={setMatch}
        onFinished={() => setPhase('result')}
        onExit={() => setPhase('camera')}
      />
    );
  }

  return (
    <div className="min-h-dvh">
      <TopBar
        title={config.game.name}
        onBack={phase === 'camera' ? () => setPhase('teams') : exit}
        backLabel={phase === 'camera' ? 'Teams' : config.countryName}
      />
      {phase === 'teams' && (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 pb-12">
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((ti) => (
              <TeamEditor
                key={ti}
                team={teams[ti]}
                onChange={(t) => setTeams((prev) => (ti === 0 ? [t, prev[1]] : [prev[0], t]))}
              />
            ))}
          </div>
          <section className="card flex flex-col gap-4 p-5">
            <h2 className="font-display text-xl font-semibold">Match rules</h2>
            <Choice label="Match length" options={config.durations.map((m) => ({ value: m, label: `${m} min` }))} value={minutes} onChange={setMinutes} />
            {config.targets.length > 1 && (
              <Choice
                label="Game ends early at"
                options={config.targets.map((t) => ({ value: t, label: t === null ? 'Time only' : `${t} points` }))}
                value={target}
                onChange={setTarget}
              />
            )}
            {config.regionLabels.length === 2 && (
              <Choice
                label={`${teams[0].name || 'Team A'} scores in the…`}
                options={[
                  { value: 'left' as const, label: 'Left goal' },
                  { value: 'right' as const, label: 'Right goal' },
                ]}
                value={teamAAttacks}
                onChange={setTeamAAttacks}
              />
            )}
            <p className="text-sm text-ink/70">
              {config.altPoints
                ? `Baskets count ${config.points}. Tap “${config.altPoints.label}” after a long shot to make it ${config.altPoints.points}.`
                : `Each ${config.scoreWord} counts ${config.points}.`}{' '}
              MVP goes to the player with the most points.
            </p>
          </section>
          <p className="rounded-2xl bg-dusty/30 p-3 text-sm text-ink/85">
            <strong>Experimental referee:</strong> {config.limitations}
          </p>
          <button
            className="btn-primary self-end"
            onClick={() => {
              const t = cleanTeams();
              setTeams(t);
              saveNames([t[0].players[0], t[1].players[0]]);
              setPhase('camera');
            }}
          >
            Next: camera setup
          </button>
        </div>
      )}
      {phase === 'camera' && (
        <MatchCameraSetup
          config={config}
          camera={camera}
          detector={detector}
          modelStatus={modelStatus}
          regions={regions}
          setRegions={(r) => {
            // Moving a region invalidates the ball size measured inside it.
            setBallR((prev) => prev.map((v, i) => (r[i] === regions[i] ? v : null)));
            setRegions(r);
          }}
          ballR={ballR}
          setBallR={setBallR}
          teams={teams}
          setShirt={(ti, shirt) => setTeams((prev) => (ti === 0 ? [{ ...prev[0], shirt }, prev[1]] : [prev[0], { ...prev[1], shirt }]))}
          onStart={() => {
            announcer.unlock();
            setMatch(newMatch(matchConfig()));
            setPhase('match');
          }}
        />
      )}
    </div>
  );
}

function Choice<T>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink/75">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.label} className={o.value === value ? 'btn-primary min-h-11 px-4' : 'btn-secondary min-h-11 px-4'} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function TeamEditor({ team, onChange }: { team: TeamSetup; onChange: (t: TeamSetup) => void }) {
  return (
    <section className="card flex flex-col gap-3 p-5">
      <input className="field font-display text-xl font-semibold" value={team.name} maxLength={16} onChange={(e) => onChange({ ...team, name: e.target.value })} aria-label="Team name" />
      {team.players.map((p, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="field"
            value={p}
            maxLength={16}
            aria-label={`Player ${i + 1}`}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange({ ...team, players: team.players.map((x, j) => (j === i ? e.target.value : x)) })}
          />
          {team.players.length > 1 && (
            <button className="btn-ghost min-h-12 px-3" aria-label={`Remove ${p}`} onClick={() => onChange({ ...team, players: team.players.filter((_, j) => j !== i) })}>
              <X className="size-4" />
            </button>
          )}
        </div>
      ))}
      {team.players.length < 3 && (
        <button className="btn-secondary min-h-11 self-start px-3" onClick={() => onChange({ ...team, players: [...team.players, `Player ${team.players.length + 1}`] })}>
          <Plus className="size-4" /> Add player
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function drawScene(o: Overlay, regions: Rect[], labels: string[], trail: BallObs[], people: (PersonSighting & { team: TeamIndex | null })[], shirtCss: (string | undefined)[]) {
  const { ctx, px, rect } = o;
  regions.forEach((r, i) => {
    const a = px({ x: r.x, y: r.y });
    ctx.save();
    ctx.setLineDash([10, 6]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(234,224,204,0.9)';
    ctx.strokeRect(a.x, a.y, r.w * rect.w, r.h * rect.h);
    ctx.restore();
    ctx.fillStyle = 'rgba(234,224,204,0.95)';
    ctx.font = '600 12px "Plus Jakarta Sans", system-ui';
    const w = ctx.measureText(labels[i]).width;
    ctx.fillText(labels[i], Math.min(Math.max(a.x + 4, rect.x + 4), rect.x + rect.w - w - 4), Math.max(a.y - 6, rect.y + 14));
  });
  for (const p of people) {
    const a = px({ x: p.box.x, y: p.box.y });
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.team === null ? 'rgba(234,224,204,0.35)' : shirtCss[p.team] ?? '#EAE0CC';
    ctx.strokeRect(a.x, a.y, p.box.w * rect.w, p.box.h * rect.h);
  }
  trail.forEach((b, i) => {
    const p = px(b);
    const last = i === trail.length - 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, last ? Math.max(8, b.r * rect.h) : 4, 0, Math.PI * 2);
    ctx.strokeStyle = last ? '#EAE0CC' : 'rgba(201,173,161,0.8)';
    ctx.lineWidth = last ? 3 : 2;
    // Dashed = followed by colour between detections.
    ctx.setLineDash(last && b.source === 'color' ? [5, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function MatchCameraSetup({
  config,
  camera,
  detector,
  modelStatus,
  regions,
  setRegions,
  ballR,
  setBallR,
  teams,
  setShirt,
  onStart,
}: {
  config: MatchGameConfig;
  camera: Camera;
  detector: React.RefObject<ObjectDetector | null>;
  modelStatus: ModelStatus;
  regions: (Rect | null)[];
  setRegions: (r: (Rect | null)[]) => void;
  ballR: (number | null)[];
  setBallR: (r: (number | null)[]) => void;
  teams: [TeamSetup, TeamSetup];
  setShirt: (team: TeamIndex, shirt: TeamSetup['shirt']) => void;
  onStart: () => void;
}) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const clock = useRef(monotonicClock());
  const perception = useRef<BallPerception | null>(null);
  const people = useRef<PersonSighting[]>([]);
  // Ball sizes seen inside each region, for the depth check.
  const sizeSamples = useRef<{ t: number; r: number }[][]>(config.regionLabels.map(() => []));
  const ballRRef = useRef(ballR);
  ballRRef.current = ballR;
  const [active, setActive] = useState(0);
  const [seenAt, setSeenAt] = useState(0);
  const [ballCss, setBallCss] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [shirtMsg, setShirtMsg] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(id);
  }, []);

  useFrameLoop(
    camera.videoRef,
    camera.status === 'live' && modelStatus === 'ready',
    (video, t) => {
      perception.current ??= new BallPerception(detector.current!, config.perception);
      const p = perception.current;
      p.setFocusRegions(regions.filter((r): r is Rect => !!r));
      const { ball, fullFrame } = p.process(video, t, camera.mirrored, clock.current());
      if (config.useShirtColors && fullFrame) people.current = peopleFromDetections(fullFrame, video, camera.mirrored);
      const o = prepareOverlay(overlayRef.current, video);
      if (o) drawScene(o, [], [], ball ? [ball] : [], people.current.map((x) => ({ ...x, team: null })), []);
      if (ball) setSeenAt(t);
      if (p.colorCss) setBallCss((c) => c ?? p.colorCss);

      // Measure the ball's apparent size when it rests (detector-confirmed) inside a region.
      if (config.measureBallInRegions && ball?.source === 'detector') {
        regions.forEach((reg, i) => {
          if (!reg || ballRRef.current[i] !== null) return;
          const inReg = ball.x >= reg.x && ball.x <= reg.x + reg.w && ball.y >= reg.y && ball.y <= reg.y + reg.h;
          const s = (sizeSamples.current[i] = inReg ? [...sizeSamples.current[i].filter((x) => t - x.t < 1000), { t, r: ball.r }] : []);
          const rs = s.map((x) => x.r).sort((a, b) => a - b);
          if (rs.length >= 6 && rs[rs.length - 1] / rs[0] < 1.35) {
            const next = [...ballRRef.current];
            next[i] = rs[Math.floor(rs.length / 2)];
            setBallR(next);
            announcer.beep(880, 0.12);
          }
        });
      }
    },
    20,
  );

  const capture = (ti: TeamIndex) => {
    const p = largestPerson(people.current);
    if (!p) {
      setShirtMsg('No one detected — stand fully in view, facing the camera.');
      return;
    }
    const other = teams[ti === 0 ? 1 : 0].shirt;
    if (other && colorDistance(p.color, other.lab) < 25) {
      setShirtMsg('That shirt looks too similar to the other team’s. Use clearly different colours (bibs work great).');
      return;
    }
    setShirt(ti, { lab: p.color, css: p.css });
    setShirtMsg(null);
  };

  const ballVisible = seenAt > 0 && now - seenAt < 1500;
  const regionsDone = regions.every(Boolean);
  const shirtsDone = !config.useShirtColors || (teams[0].shirt && teams[1].shirt);

  return (
    <CameraSetup
      game={config.game}
      camera={camera}
      modelStatus={modelStatus}
      positioning={config.positioning}
      diagram={config.diagram}
      stageOverlayRef={overlayRef}
      stageChildren={
        <RegionPicker
          video={camera.videoRef}
          regions={config.regionLabels.map((label, i) => ({ label, rect: regions[i] }))}
          active={active}
          onChange={(i, r) => {
            const next = regions.map((x, j) => (j === i ? r : x));
            setRegions(next);
            const firstEmpty = next.findIndex((x) => !x);
            if (firstEmpty >= 0) setActive(firstEmpty);
          }}
        />
      }
      below={
        <div className="card flex flex-col gap-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2">
            {config.regionLabels.map((label, i) => (
              <button key={label} className={i === active ? 'btn-primary min-h-11 px-3' : 'btn-secondary min-h-11 px-3'} onClick={() => setActive(i)}>
                {regions[i] ? '✓ ' : ''}
                {regions[i] ? `Redraw ${label.toLowerCase()}` : `Mark ${label.toLowerCase()}`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <CircleDot className={`size-5 ${ballVisible ? 'text-teal' : 'text-ink/40'}`} />
            <span className="font-semibold">{ballVisible ? 'Ball detected ✓' : 'Hold the ball up in view to test detection'}</span>
            {config.perception.color && (
              <span className="ml-auto flex items-center gap-1.5 text-ink/70">
                <span className="size-4 rounded-full ring-2 ring-ink/20" style={{ background: ballCss ?? 'transparent' }} />
                {ballCss ? 'Ball colour learned' : 'Learning ball colour…'}
              </span>
            )}
          </div>
          {config.measureBallInRegions && (
            <div className="flex flex-col gap-1.5 border-t border-ink/10 pt-3">
              <div className="font-semibold">Ball size at each goal (recommended)</div>
              <p className="text-ink/70">
                Put the ball on the goal line inside each goal for a second. Hessa measures how big it looks there, so it can tell a real goal
                from a ball passing in front of or behind the goal.
              </p>
              {config.regionLabels.map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${ballR[i] ? 'bg-teal' : 'bg-dusty'}`} />
                  {label}: {ballR[i] ? 'measured ✓' : regions[i] ? 'place the ball inside it' : 'mark it first'}
                  {ballR[i] && (
                    <button className="ml-auto text-teal underline" onClick={() => setBallR(ballR.map((v, j) => (j === i ? null : v)))}>
                      Re-measure
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {config.useShirtColors && (
            <div className="flex flex-col gap-2 border-t border-ink/10 pt-3">
              <div className="flex items-center gap-2 font-semibold">
                <Shirt className="size-5 text-teal" /> Team shirts
              </div>
              <p className="text-ink/70">One player from each team stands alone in the middle of the picture, then tap that team’s button.</p>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((ti) => (
                  <button key={ti} className="btn-secondary min-h-12 px-3" onClick={() => capture(ti as TeamIndex)}>
                    <span className="size-5 shrink-0 rounded-full ring-2 ring-ink/20" style={{ background: teams[ti].shirt?.css ?? 'transparent' }} />
                    <span className="truncate">
                      {teams[ti].shirt ? 'Recapture' : 'Capture'} {teams[ti].name}
                    </span>
                  </button>
                ))}
              </div>
              {shirtMsg && <p className="text-alert">{shirtMsg}</p>}
            </div>
          )}
        </div>
      }
      ready={regionsDone && !!shirtsDone}
      notReadyReason={!regionsDone ? `Mark the ${config.regionLabels.join(' and ').toLowerCase()} on the picture.` : 'Capture both teams’ shirt colours.'}
      onStart={onStart}
    />
  );
}

// ---------------------------------------------------------------------------

type Pending =
  | { kind: 'uncertain'; verdict: ShotVerdict; team: TeamIndex | null }
  | { kind: 'which-team'; verdict: ShotVerdict }
  | { kind: 'manual' };

function MatchScreen({
  config,
  camera,
  detector,
  regions,
  ballR,
  shirts,
  shirtCss,
  teamAAttacks,
  match,
  setMatch,
  onFinished,
  onExit,
}: {
  config: MatchGameConfig;
  camera: Camera;
  detector: ObjectDetector;
  regions: Rect[];
  ballR: (number | null)[];
  shirts: [Lab, Lab] | null;
  shirtCss: (string | undefined)[];
  teamAAttacks: 'left' | 'right';
  match: MatchState;
  setMatch: (s: MatchState) => void;
  onFinished: () => void;
  onExit: () => void;
}) {
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const clock = useRef(monotonicClock());
  const perception = useRef<BallPerception>(null!);
  perception.current ??= new BallPerception(detector, { ...config.perception, focusRegions: regions });
  const watcher = useRef<ShotWatcher>(config.makeWatcher(regions, ballR));
  const trail = useRef<BallObs[]>([]);
  const peopleFrames = useRef<{ t: number; people: PersonSighting[] }[]>([]);
  const matchRef = useRef(match);
  matchRef.current = match;
  const manualId = useRef(1_000_000);
  const [status, setStatus] = useState('Getting ready…');
  const [paused, setPaused] = useState(false);
  const [voice, setVoice] = useState(announcer.voiceEnabled);
  const [pending, setPending] = useState<Pending | null>(null);
  const [lastId, setLastId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useWakeLock(!paused && !match.finished);

  const update = (s: MatchState) => {
    matchRef.current = s;
    setMatch(s);
  };

  // Match clock: runs only while the referee is actively watching.
  useEffect(() => {
    if (paused || pending || match.finished) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const before = matchRef.current;
      const after = tick(before, now - last);
      last = now;
      if (after !== before) update(after);
      if (after.finished && !before.finished) {
        announcer.whistle('double');
        announcer.say(`Full time. ${after.winner === null ? 'It’s a draw' : `${after.teams[after.winner].name} wins`}`);
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, pending, match.finished]);

  useEffect(() => {
    if (!match.finished) return;
    const id = setTimeout(onFinished, 4000);
    return () => clearTimeout(id);
  }, [match.finished, onFinished]);

  const score = (eventId: number, team: TeamIndex, source: ScoreSource, label: string) => {
    const { state, applied } = addScore(matchRef.current, { id: eventId, team, points: config.points, label, source });
    if (!applied) return;
    update(state);
    setLastId(eventId);
    setNotice(null);
    announcer.chime();
    const name = state.teams[team].name;
    announcer.say(state.finished ? `${label}! ${name} wins!` : `${label}, ${name}. ${state.scores[0]} ${state.scores[1]}`);
  };

  const teamForGoal = (goal: 'left' | 'right'): TeamIndex => (goal === teamAAttacks ? 0 : 1);

  const handleVerdict = (v: ShotVerdict) => {
    const shooter = shirts && v.startedAt !== undefined ? attributeShot(v.startedAt, trail.current, peopleFrames.current, shirts) : null;
    if (config.regionLabels.length === 1) {
      // Basketball: log the attempt whatever happened.
      if (v.outcome !== 'uncertain') update(recordAttempt(matchRef.current, { id: v.id, team: shooter, made: v.outcome === 'scored' }));
    }
    if (v.outcome === 'not-scored') {
      setNotice(`${v.label}${shooter !== null ? ` — ${matchRef.current.teams[shooter].name}` : ''}. ${v.reason}`);
      return;
    }
    if (v.outcome === 'uncertain') {
      setPending({ kind: 'uncertain', verdict: v, team: v.goal ? teamForGoal(v.goal) : shooter });
      announcer.beep(330, 0.25);
      announcer.say('Not sure. Did it go in?');
      return;
    }
    const team = v.goal ? teamForGoal(v.goal) : shooter;
    if (team === null) {
      setPending({ kind: 'which-team', verdict: v });
      announcer.say(`${v.label}. Which side scored?`);
      return;
    }
    score(v.id, team, 'camera', v.label);
  };

  useFrameLoop(
    camera.videoRef,
    !paused && !pending && !match.finished,
    (video, t) => {
      const { ball, fullFrame } = perception.current.process(video, t, camera.mirrored, clock.current());
      if (ball) trail.current = [...trail.current.filter((b) => t - b.t < 1500), ball];
      let people: (PersonSighting & { team: TeamIndex | null })[] = [];
      if (shirts && fullFrame) {
        const seen = peopleFromDetections(fullFrame, video, camera.mirrored);
        peopleFrames.current = [...peopleFrames.current.filter((f) => t - f.t < 1500), { t, people: seen }];
        people = seen.map((p) => ({ ...p, team: classifyColor(p.color, shirts) }));
      }
      const o = prepareOverlay(overlayRef.current, video);
      if (o) drawScene(o, regions, config.regionLabels, trail.current.filter((b) => t - b.t < 600), people, shirtCss);
      const u = watcher.current.update(t, ball);
      setStatus((s) => (s === u.status ? s : u.status));
      if (u.verdict) handleVerdict(u.verdict);
    },
    30,
  );

  const resumeWatching = () => {
    watcher.current.reset();
    perception.current.reset();
    trail.current = [];
  };

  const last = match.events.find((e) => e.id === lastId) ?? null;
  const lastTeam = last ? match.teams[last.team] : null;
  const timeLeft = match.durationMs - match.clockMs;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink text-cream">
      <div className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button className="grid size-11 place-items-center rounded-full bg-cream/10" onClick={onExit} aria-label="Leave match">
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="text-xs font-semibold tracking-wide text-cream/70 tabular-nums">
            {formatClock(timeLeft)} left{match.targetPoints ? ` · first to ${match.targetPoints}` : ''}
          </div>
          <div className="flex items-center justify-center gap-3 font-display text-2xl font-bold tabular-nums">
            <TeamTag name={match.teams[0].name} css={shirtCss[0]} />
            {match.scores[0]} – {match.scores[1]}
            <TeamTag name={match.teams[1].name} css={shirtCss[1]} />
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
        <button
          className="grid size-11 place-items-center rounded-full bg-cream/10"
          onClick={() => {
            resumeWatching();
            setPaused((p) => !p);
          }}
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
        </button>
      </div>

      <CameraStage camera={camera} overlayRef={overlayRef} className="min-h-0 flex-1">
        {paused && (
          <div className="absolute inset-0 grid place-items-center bg-ink/60">
            <div className="flex flex-col items-center gap-3">
              <button className="btn-on-dark" onClick={() => setPaused(false)}>
                <Play className="size-5" /> Resume (clock stopped)
              </button>
              <button className="btn btn-secondary bg-cream/90" onClick={() => update(endMatch(matchRef.current))}>
                <FlagIcon className="size-5" /> End match now
              </button>
            </div>
          </div>
        )}
      </CameraStage>

      <div className="flex flex-col gap-2 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]" aria-live="polite">
        <div className="flex items-center gap-2 text-sm text-cream/80">
          <span className={`size-2.5 rounded-full ${paused || pending ? 'bg-dusty' : 'animate-pulse bg-olive'}`} />
          {paused ? 'Referee paused' : match.finished ? 'Full time' : pending ? 'Waiting for players — clock stopped' : status}
        </div>

        {pending ? (
          <div className="rounded-2xl bg-cream px-4 py-3 text-ink">
            <div className="font-bold">
              {pending.kind === 'uncertain'
                ? pending.verdict.goal
                  ? `Was that a goal in the ${pending.verdict.goal} goal?`
                  : `Hessa couldn’t be sure — did it go in?`
                : pending.kind === 'which-team'
                  ? `${pending.verdict.label}! Which side scored?`
                  : `Add a ${config.scoreWord} (players’ call)`}
            </div>
            <div className="text-sm text-ink/70">
              {pending.kind === 'uncertain'
                ? pending.verdict.reason
                : pending.kind === 'which-team'
                  ? 'Couldn’t tell the shooter’s shirt colour clearly.'
                  : 'Use this if the camera missed one. It’s recorded as a players’ call.'}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {/* Football already knows which goal, so the only question is "was it a goal?". */}
              {(pending.kind === 'uncertain' && pending.verdict.goal && pending.team !== null ? [pending.team] : [0, 1]).map((ti, _, list) => (
                <button
                  key={ti}
                  className={`btn-primary ${list.length === 1 ? 'col-span-2' : ''}`}
                  onClick={() => {
                    const id = pending.kind === 'manual' ? manualId.current++ : pending.verdict.id;
                    const label = pending.kind === 'manual' ? config.scoreWord.toUpperCase() : pending.verdict.label === 'Not sure' ? config.scoreWord.toUpperCase() : pending.verdict.label;
                    const source: ScoreSource = pending.kind === 'which-team' ? 'camera' : 'players';
                    if (config.regionLabels.length === 1 && pending.kind === 'uncertain') {
                      update(recordAttempt(matchRef.current, { id: pending.verdict.id, team: ti as TeamIndex, made: true }));
                    }
                    score(id, ti as TeamIndex, source, label);
                    setPending(null);
                    resumeWatching();
                  }}
                >
                  {pending.kind === 'uncertain' ? (list.length === 1 ? `Yes — goal for ${match.teams[ti].name}` : `Yes — ${match.teams[ti].name}`) : match.teams[ti].name}
                </button>
              ))}
              <button
                className="btn-secondary col-span-2"
                onClick={() => {
                  if (pending.kind === 'uncertain' && config.regionLabels.length === 1) {
                    update(recordAttempt(matchRef.current, { id: pending.verdict.id, team: pending.team, made: false }));
                  }
                  setPending(null);
                  resumeWatching();
                }}
              >
                {pending.kind === 'manual' ? 'Cancel' : 'No — it didn’t count'}
              </button>
            </div>
          </div>
        ) : (
          <div className={`min-h-16 rounded-2xl px-4 py-3 ${last && !notice ? 'bg-teal' : 'bg-cream/10'}`}>
            {notice ? (
              <div className="text-base font-semibold">{notice}</div>
            ) : last && lastTeam ? (
              <>
                <div className="text-lg leading-snug font-bold">
                  {last.label}! {lastTeam.name}
                  {last.scorer !== null && lastTeam.players.length > 1 ? ` — ${lastTeam.players[last.scorer]}` : ''} (+{last.points})
                  {last.source === 'players' && <span className="text-sm font-medium opacity-80"> · players’ call</span>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lastTeam.players.length > 1 &&
                    lastTeam.players.map((p, i) => (
                      <button
                        key={p + i}
                        className={`chip py-2 ${last.scorer === i ? 'bg-cream text-ink' : 'bg-cream/20 text-cream'}`}
                        onClick={() => update(amendScore(matchRef.current, last.id, { scorer: i }))}
                      >
                        <Star className="size-3.5" /> {p}
                      </button>
                    ))}
                  {config.altPoints && (
                    <button
                      className={`chip py-2 ${last.points === config.altPoints.points ? 'bg-cream text-ink' : 'bg-cream/20 text-cream'}`}
                      onClick={() =>
                        update(amendScore(matchRef.current, last.id, { points: last.points === config.altPoints!.points ? config.points : config.altPoints!.points }))
                      }
                    >
                      {config.altPoints.label}
                    </button>
                  )}
                  <button
                    className="chip bg-cream/20 py-2 text-cream"
                    onClick={() => {
                      update(amendScore(matchRef.current, last.id, { disallow: true }));
                      setLastId(null);
                      setNotice(`${last.label} disallowed.`);
                    }}
                  >
                    <Ban className="size-3.5" /> Disallow
                  </button>
                </div>
                {lastTeam.players.length > 1 && last.scorer === null && <div className="mt-1 text-xs opacity-80">Tap who scored to credit them for MVP.</div>}
              </>
            ) : (
              <div className="text-lg font-bold">Play! Hessa is watching.</div>
            )}
          </div>
        )}

        {!pending && !match.finished && (
          <button className="chip self-end bg-cream/15 py-2 text-cream" onClick={() => setPending({ kind: 'manual' })}>
            <Plus className="size-4" /> Camera missed one?
          </button>
        )}
      </div>
    </div>
  );
}

function TeamTag({ name, css }: { name: string; css?: string }) {
  return (
    <span className="flex max-w-[28vw] items-center gap-1.5 truncate font-sans text-sm font-semibold">
      {css && <span className="size-3 shrink-0 rounded-full ring-1 ring-cream/50" style={{ background: css }} />}
      <span className="truncate">{name}</span>
    </span>
  );
}

function MatchReport({ match, config }: { match: MatchState; config: MatchGameConfig }) {
  const box = boxScore(match);
  const byPlayers = match.events.filter((e) => e.source === 'players').length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl bg-teal p-4 text-cream">
        <Star className="size-8 shrink-0" />
        <div>
          <div className="text-xs font-semibold tracking-wide uppercase opacity-80">MVP</div>
          {box.mvp.length ? (
            <div className="font-display text-2xl font-bold">
              {box.mvp.map((p) => p.name).join(' & ')} <span className="font-sans text-base font-medium">· {box.mvp[0].points} pt{box.mvp[0].points === 1 ? "" : "s"}</span>
            </div>
          ) : (
            <div className="font-display text-xl font-bold">No one credited with points</div>
          )}
        </div>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-ink/60">
          <tr>
            <th className="py-1 font-semibold">Player</th>
            <th className="py-1 font-semibold">Team</th>
            <th className="py-1 text-right font-semibold">{config.scoreWord === 'goal' ? 'Goals' : 'Baskets'}</th>
            <th className="py-1 text-right font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {box.players.map((p) => (
            <tr key={p.team + p.name} className="border-t border-ink/10">
              <td className="py-1.5 font-medium">{p.name}</td>
              <td className="py-1.5 text-ink/70">{match.teams[p.team].name}</td>
              <td className="py-1.5 text-right tabular-nums">{p.scores}</td>
              <td className="py-1.5 text-right font-bold tabular-nums">{p.points}</td>
            </tr>
          ))}
          {[0, 1].map((ti) =>
            box.uncredited[ti] > 0 ? (
              <tr key={`u${ti}`} className="border-t border-ink/10 text-ink/60">
                <td className="py-1.5" colSpan={3}>
                  {match.teams[ti].name} — not credited to a player
                </td>
                <td className="py-1.5 text-right tabular-nums">{box.uncredited[ti]}</td>
              </tr>
            ) : null,
          )}
        </tbody>
      </table>

      {config.regionLabels.length === 1 && (
        <p className="text-sm text-ink/75">
          Shooting:{' '}
          {[0, 1]
            .map((ti) => `${match.teams[ti].name} ${box.attempts[ti].made}/${box.attempts[ti].total}`)
            .join(' · ')}
          {match.attempts.some((a) => a.team === null) && ' (some shots couldn’t be assigned to a side)'}
        </p>
      )}

      {match.events.length > 0 && (
        <div>
          <div className="mb-1 text-sm font-semibold">Scoring timeline</div>
          <ul className="flex flex-col gap-0.5 text-sm text-ink/80">
            {match.events.map((e) => (
              <li key={e.id}>
                <span className="inline-block w-12 tabular-nums text-ink/60">{formatClock(e.atMs)}</span>
                {match.teams[e.team].name}
                {e.scorer !== null && match.teams[e.team].players.length > 1 ? ` (${match.teams[e.team].players[e.scorer]})` : ''} +{e.points}
                {e.source === 'players' ? ' · players’ call' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-ink/60">
        {match.endReason === 'target' ? 'Won by reaching the target.' : match.endReason === 'time' ? 'Ended at full time.' : 'Ended early.'}{' '}
        {byPlayers > 0 ? `${byPlayers} score${byPlayers === 1 ? ' was a players’ call' : 's were players’ calls'}.` : 'Every score was called by the camera.'}
      </p>
    </div>
  );
}
