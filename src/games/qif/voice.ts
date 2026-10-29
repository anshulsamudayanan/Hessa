/**
 * Microphone perception for Qif. Measures energy in the human-voice band
 * (85–1000 Hz) on-device with the Web Audio API. Nothing is recorded, stored or
 * uploaded — only a level number per frame is kept, for a few seconds.
 *
 * The referee's own STOP whistle sits around 3 kHz, outside this band, so it
 * doesn't count as "still singing".
 */

export interface LevelFrame {
  t: number;
  db: number;
}

export type MicErrorKind = 'insecure' | 'unsupported' | 'denied' | 'not-found' | 'unknown';

export function describeMicError(err: unknown): { kind: MicErrorKind; message: string } {
  const name = (err as DOMException)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { kind: 'denied', message: 'Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again.' };
  }
  if (name === 'NotFoundError') return { kind: 'not-found', message: 'No microphone was found on this device.' };
  return { kind: 'unknown', message: `The microphone could not start${name ? ` (${name})` : ''}.` };
}

// Runs on the audio thread: emits the mean-square level of every ~1024 samples,
// so sampling keeps going at a steady rate even when the screen refresh is throttled.
const WORKLET = `
class HessaLevel extends AudioWorkletProcessor {
  constructor() { super(); this.sum = 0; this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) this.sum += ch[i] * ch[i];
      this.n += ch.length;
      if (this.n >= 1024) {
        this.port.postMessage({ ms: this.sum / this.n });
        this.sum = 0; this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('hessa-level', HessaLevel);
`;

export class VoiceMeter {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private nodes: AudioNode[] = [];
  /** Rolling ~12 s of voice-band levels (dBFS), timestamped in performance.now() time. */
  readonly frames: LevelFrame[] = [];

  async start() {
    if (!window.isSecureContext) throw Object.assign(new Error('insecure'), { name: 'SecurityError' });
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      video: false,
    });
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    this.ctx = ctx;
    await ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(this.stream);
    // Keep only the voice band (≈85–1000 Hz).
    const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 85, Q: 0.7 });
    const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1000, Q: 0.7 });
    source.connect(hp).connect(lp);
    // Stamp each level when it arrives (every ~21 ms) so it lines up with the STOP signal.
    const push = (meanSquare: number) => {
      const t = performance.now();
      this.frames.push({ t, db: 10 * Math.log10(meanSquare + 1e-12) });
      while (this.frames.length && t - this.frames[0].t > 12_000) this.frames.shift();
    };
    if (ctx.audioWorklet) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(ctx, 'hessa-level');
      node.port.onmessage = (e) => push(e.data.ms);
      lp.connect(node);
      this.nodes = [source, hp, lp, node];
    } else {
      // Older browsers: deprecated but widely supported fallback.
      const sp = ctx.createScriptProcessor(1024, 1, 1);
      sp.onaudioprocess = (e) => {
        const ch = e.inputBuffer.getChannelData(0);
        let s = 0;
        for (let i = 0; i < ch.length; i++) s += ch[i] * ch[i];
        push(s / ch.length);
      };
      const mute = ctx.createGain();
      mute.gain.value = 0;
      lp.connect(sp).connect(mute).connect(ctx.destination); // must reach a destination to run; muted
      this.nodes = [source, hp, lp, sp, mute];
    }
  }

  /** Latest level (dBFS), for the on-screen meter. */
  level(): number {
    return this.frames.length ? this.frames[this.frames.length - 1].db : -120;
  }

  stop() {
    this.nodes.forEach((n) => n.disconnect());
    this.nodes = [];
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
  }
}

// ---------------------------------------------------------------------------
// Event detection (pure, tested)
// ---------------------------------------------------------------------------

export const QIF_AUDIO = {
  marginDb: 14, // above the room's noise floor counts as voice
  singingCheckMs: 2500,
  minSingingRatio: 0.35,
  judgeWindowMs: 1500,
  failVoicedMs: 160,
  minRunMs: 80,
  silenceHoldMs: 200,
  tooNoisyFloorDb: -45,
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : -120;
};

export function noiseFloor(frames: LevelFrame[]): number {
  return median(frames.map((f) => f.db));
}

export type StopVerdict =
  | { outcome: 'pass'; reactionMs: number }
  | { outcome: 'fail'; voicedMs: number; lastVoiceMs: number }
  | { outcome: 'not-singing' }
  | { outcome: 'too-noisy' };

/**
 * Did the player stop singing within `reactionMs` of the STOP signal?
 * Voice that keeps going after the reaction window (beyond short clicks) = caught.
 */
export function judgeStop(frames: LevelFrame[], floorDb: number, stopAt: number, reactionMs: number, cfg = QIF_AUDIO): StopVerdict {
  if (floorDb > cfg.tooNoisyFloorDb) return { outcome: 'too-noisy' };
  const thr = floorDb + cfg.marginDb;
  const voiced = (f: LevelFrame) => f.db > thr;

  const before = frames.filter((f) => f.t >= stopAt - cfg.singingCheckMs && f.t < stopAt);
  if (!before.length || before.filter(voiced).length / before.length < cfg.minSingingRatio) return { outcome: 'not-singing' };

  // Voiced time inside the judging window, counting only runs long enough to be a voice.
  const windowStart = stopAt + reactionMs;
  const win = frames.filter((f) => f.t >= windowStart && f.t <= windowStart + cfg.judgeWindowMs);
  let voicedMs = 0;
  let lastVoice = -1;
  let runStart: number | null = null;
  let prevT = windowStart;
  for (let i = 0; i <= win.length; i++) {
    const f = win[i];
    const on = f ? voiced(f) : false;
    if (on && runStart === null) runStart = f.t;
    if (!on && runStart !== null) {
      const runEnd = prevT;
      if (runEnd - runStart >= cfg.minRunMs) {
        voicedMs += runEnd - runStart;
        lastVoice = runEnd;
      }
      runStart = null;
    }
    if (f) prevT = f.t;
  }
  if (voicedMs >= cfg.failVoicedMs) return { outcome: 'fail', voicedMs, lastVoiceMs: lastVoice - stopAt };

  // Reaction time: when the voice first dropped and stayed quiet.
  const after = frames.filter((f) => f.t >= stopAt);
  let quietSince: number | null = null;
  for (const f of after) {
    if (voiced(f)) quietSince = null;
    else {
      quietSince ??= f.t;
      // Measured stop includes ~50–120 ms of mic/processing latency; never report more than the window it passed.
      if (f.t - quietSince >= cfg.silenceHoldMs) return { outcome: 'pass', reactionMs: Math.min(reactionMs, Math.max(0, quietSince - stopAt)) };
    }
  }
  return { outcome: 'pass', reactionMs: reactionMs };
}
