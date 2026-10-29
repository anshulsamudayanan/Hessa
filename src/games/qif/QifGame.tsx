import { AlertTriangle, Mic, MicOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { loadNames, PlayerNames, saveNames } from '@/components/PlayerNames';
import { ResultScreen } from '@/components/ResultScreen';
import { TopBar } from '@/components/TopBar';
import { GAMES } from '@/data/catalog';
import { navigate } from '@/lib/router';
import { announcer } from '@/referee/announcer';
import { useWakeLock } from '@/referee/wakeLock';
import { currentPlayer, currentRound, newQif, recordTurn, standings, winners, type QifState } from './rules';
import { describeMicError, judgeStop, noiseFloor, QIF_AUDIO, VoiceMeter, type StopVerdict } from './voice';

const GAME = GAMES.qif;

const WINDOWS = [
  { label: 'Relaxed', ms: 900 },
  { label: 'Normal', ms: 600 },
  { label: 'Sharp', ms: 400 },
];

type Stage =
  | { name: 'ready' }
  | { name: 'calibrating' }
  | { name: 'singing' }
  | { name: 'stop' }
  | { name: 'verdict'; verdict: StopVerdict };

export function QifGame() {
  const [phase, setPhase] = useState<'setup' | 'play' | 'result'>('setup');
  const [names, setNames] = useState(() => loadNames(3));
  const [rounds, setRounds] = useState(3);
  const [windowMs, setWindowMs] = useState(600);
  const [state, setState] = useState<QifState | null>(null);
  const meter = useRef<VoiceMeter | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const players = names.map((n, i) => n.trim() || `Player ${i + 1}`);

  useEffect(() => () => meter.current?.stop(), []);

  const exit = () => {
    meter.current?.stop();
    navigate('/country/uae');
  };

  const begin = async () => {
    setStarting(true);
    setMicError(null);
    announcer.unlock();
    try {
      meter.current?.stop();
      const m = new VoiceMeter();
      await m.start();
      meter.current = m;
      saveNames(players);
      setState(newQif(players, rounds));
      setPhase('play');
    } catch (err) {
      setMicError(
        (err as Error).message === 'insecure'
          ? 'The microphone needs a secure connection. Open Hessa over https:// (or on localhost).'
          : (err as Error).message === 'unsupported'
            ? 'This browser can’t use the microphone.'
            : describeMicError(err).message,
      );
    } finally {
      setStarting(false);
    }
  };

  if (phase === 'result' && state) {
    const st = standings(state);
    const win = winners(state);
    return (
      <div className="min-h-dvh">
        <TopBar title="Qif" onBack={exit} backLabel="UAE" />
        <ResultScreen
          headline={win.length > 1 ? 'Shared win!' : `${win[0].name} wins!`}
          scores={st.slice(0, 3).map((s) => ({ name: s.name, score: String(s.points), winner: win.includes(s) }))}
          summary={
            <table className="w-full text-sm">
              <thead className="text-left text-ink/60">
                <tr>
                  <th className="py-1">Player</th>
                  <th className="py-1 text-right">Stops</th>
                  <th className="py-1 text-right">Avg. stop time</th>
                </tr>
              </thead>
              <tbody>
                {st.map((s) => (
                  <tr key={s.player} className="border-t border-ink/10">
                    <td className="py-1.5 font-medium">{s.name}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {s.points}/{state.rounds}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{s.avgReactionMs === null ? '—' : `${(s.avgReactionMs / 1000).toFixed(2)} s`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
          onReplay={() => {
            setState(newQif(players, rounds));
            setPhase('play');
          }}
          onBack={exit}
          backLabel="Back to UAE"
        />
      </div>
    );
  }

  if (phase === 'play' && state && meter.current) {
    return (
      <QifPlay
        meter={meter.current}
        state={state}
        windowMs={windowMs}
        onTurn={(s) => {
          setState(s);
          if (s.finished) setTimeout(() => setPhase('result'), 2500);
        }}
        onExit={() => {
          meter.current?.stop();
          meter.current = null;
          setPhase('setup');
        }}
      />
    );
  }

  return (
    <div className="min-h-dvh">
      <TopBar title="Qif قِف" onBack={exit} backLabel="UAE" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 pb-12">
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-display text-xl font-semibold">How to play</h2>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-ink/85">
            <li>Put the phone on a table near the singer, screen up. Others stay quiet.</li>
            <li>Hessa listens to the room for a moment, then shows SING.</li>
            <li>Sing anything — keep going until you hear the whistle and see QIF!</li>
            <li>Go silent within the reaction window. Still singing after that? Caught.</li>
          </ol>
          <p className="rounded-2xl bg-olive/20 p-3 text-sm text-ink/85">
            <strong>What Hessa listens to:</strong> only the loudness of the voice range, live on this phone. Nothing is recorded, saved or
            uploaded. Background music, TV or other people talking will confuse it.
          </p>
        </section>
        <section className="card flex flex-col gap-4 p-5">
          <h2 className="font-display text-xl font-semibold">Players</h2>
          <PlayerNames names={names} onChange={setNames} min={2} max={6} />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink/75">Rounds</legend>
            <div className="flex gap-2">
              {[1, 3, 5].map((r) => (
                <button key={r} className={r === rounds ? 'btn-primary min-h-11 px-4' : 'btn-secondary min-h-11 px-4'} onClick={() => setRounds(r)}>
                  {r}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink/75">Reaction window</legend>
            <div className="flex flex-wrap gap-2">
              {WINDOWS.map((w) => (
                <button key={w.ms} className={w.ms === windowMs ? 'btn-primary min-h-11 px-4' : 'btn-secondary min-h-11 px-4'} onClick={() => setWindowMs(w.ms)}>
                  {w.label} · {(w.ms / 1000).toFixed(1)} s
                </button>
              ))}
            </div>
          </fieldset>
        </section>
        {micError && (
          <p className="flex items-start gap-2 rounded-2xl bg-alert/10 p-3 text-sm text-alert" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {micError}
          </p>
        )}
        <button className="btn-primary self-end" onClick={begin} disabled={starting}>
          <Mic className="size-5" /> {micError ? 'Try again' : 'Allow microphone & start'}
        </button>
      </div>
    </div>
  );
}

function QifPlay({ meter, state, windowMs, onTurn, onExit }: { meter: VoiceMeter; state: QifState; windowMs: number; onTurn: (s: QifState) => void; onExit: () => void }) {
  const [stage, setStage] = useState<Stage>({ name: 'ready' });
  const [level, setLevel] = useState(0);
  const floor = useRef(-90);
  const timers = useRef<number[]>([]);
  const turnId = useRef(1);
  useWakeLock(true);

  // The meter samples on the audio thread; this loop only drives the on-screen level bar.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const db = meter.level();
      setLevel(Math.max(0, Math.min(1, (db - floor.current) / 45)));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      timers.current.forEach(clearTimeout);
    };
  }, [meter]);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const startTurn = () => {
    setStage({ name: 'calibrating' });
    const calStart = performance.now();
    later(() => {
      floor.current = noiseFloor(meter.frames.filter((f) => f.t >= calStart + 200));
      if (floor.current > QIF_AUDIO.tooNoisyFloorDb) {
        setStage({ name: 'verdict', verdict: { outcome: 'too-noisy' } });
        return;
      }
      setStage({ name: 'singing' });
      announcer.beep(523, 0.15);
      // Random STOP moment: unpredictable, so nobody can anticipate it.
      const singMs = 4000 + Math.random() * 5000;
      later(() => {
        const stopAt = performance.now();
        announcer.whistle('short');
        setStage({ name: 'stop' });
        later(() => {
          const verdict = judgeStop(meter.frames, floor.current, stopAt, windowMs);
          setStage({ name: 'verdict', verdict });
          if (verdict.outcome === 'pass' || verdict.outcome === 'fail') {
            onTurn(recordTurn(state, { id: turnId.current++, passed: verdict.outcome === 'pass', reactionMs: verdict.outcome === 'pass' ? verdict.reactionMs : null }));
          }
        }, windowMs + QIF_AUDIO.judgeWindowMs + 100);
      }, singMs);
    }, 1500);
  };

  const player = state.players[currentPlayer(state)];
  const v = stage.name === 'verdict' ? stage.verdict : null;
  // After a recorded turn, `state` already points at the next player.
  const lastTurn = state.turns[state.turns.length - 1];
  const judged = v && (v.outcome === 'pass' || v.outcome === 'fail') ? state.players[lastTurn.player] : player;

  const bg =
    stage.name === 'stop'
      ? 'bg-alert'
      : stage.name === 'singing'
        ? 'bg-teal'
        : v?.outcome === 'pass'
          ? 'bg-teal'
          : v?.outcome === 'fail'
            ? 'bg-dusty'
            : 'bg-ink';

  return (
    <div className={`fixed inset-0 z-40 flex flex-col text-cream transition-colors duration-150 ${bg}`}>
      <div className="flex items-center justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button className="btn-ghost min-h-11 text-cream" onClick={onExit}>
          End
        </button>
        <div className="text-sm font-semibold text-cream/80">
          Round {Math.min(currentRound(state), state.rounds)} of {state.rounds}
        </div>
        <div className="flex items-center gap-1 text-sm text-cream/80">
          <Mic className="size-4" /> listening
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center" aria-live="assertive">
        {stage.name === 'ready' && (
          <>
            <div className="text-lg text-cream/80">Next up</div>
            <div className="font-display text-5xl font-bold">{player}</div>
            <button className="btn-on-dark mt-4 px-8 text-lg" onClick={startTurn}>
              Start turn
            </button>
          </>
        )}
        {stage.name === 'calibrating' && (
          <>
            <MicOff className="size-12" />
            <div className="font-display text-4xl font-bold">Quiet please…</div>
            <div className="text-cream/80">Listening to the room</div>
          </>
        )}
        {stage.name === 'singing' && (
          <>
            <div className="font-display text-7xl font-bold">SING!</div>
            <div className="text-xl">{player}, keep singing…</div>
          </>
        )}
        {stage.name === 'stop' && (
          <>
            <div className="font-display text-8xl font-bold" lang="ar">
              قِف
            </div>
            <div className="font-display text-6xl font-bold">QIF!</div>
          </>
        )}
        {v && (
          <>
            {v.outcome === 'pass' && (
              <>
                <div className="font-display text-6xl font-bold">Frozen!</div>
                <div className="text-xl">
                  {judged} stopped in {(v.reactionMs / 1000).toFixed(2)} s — +1
                </div>
              </>
            )}
            {v.outcome === 'fail' && (
              <>
                <div className="font-display text-6xl font-bold text-ink">Caught!</div>
                <div className="text-xl text-ink">
                  {judged} was still singing {(v.lastVoiceMs / 1000).toFixed(1)} s after QIF.
                </div>
              </>
            )}
            {v.outcome === 'not-singing' && (
              <>
                <div className="font-display text-4xl font-bold">Didn’t hear singing</div>
                <div className="text-cream/80">Sing louder and closer to the phone. This turn will be replayed.</div>
              </>
            )}
            {v.outcome === 'too-noisy' && (
              <>
                <div className="font-display text-4xl font-bold">Too noisy to judge</div>
                <div className="text-cream/80">Turn off music or TV and ask others to be quiet. This turn will be replayed.</div>
              </>
            )}
            {!state.finished && (
              <button className="btn-on-dark mt-4" onClick={() => setStage({ name: 'ready' })}>
                {v.outcome === 'pass' || v.outcome === 'fail' ? `Next: ${player}` : 'Replay turn'}
              </button>
            )}
          </>
        )}
      </div>

      <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mb-1 text-xs text-cream/70">Voice level</div>
        <div className="h-3 overflow-hidden rounded-full bg-cream/20">
          <div className="h-full rounded-full bg-cream transition-[width] duration-75" style={{ width: `${level * 100}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-cream/70">
          {state.players.map((p, i) => (
            <span key={i}>
              {p}: {state.turns.filter((t) => t.player === i && t.passed).length}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
