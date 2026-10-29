/**
 * Referee sounds and voice. Whistle synthesis kept from the original FAREEG app;
 * spoken calls use the browser's built-in speech synthesis (no network).
 */

class Announcer {
  private ctx: AudioContext | null = null;
  voiceEnabled = true;

  private audio(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Call from a user gesture (e.g. Start button) so iOS allows later sounds. */
  unlock() {
    this.audio();
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
  }

  whistle(style: 'short' | 'double' = 'short') {
    const ctx = this.audio();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (style === 'double') {
      this.blast(ctx, now, 0.16);
      this.blast(ctx, now + 0.22, 0.32);
    } else this.blast(ctx, now, 0.28);
  }

  beep(freq = 880, duration = 0.12, volume = 0.18) {
    const ctx = this.audio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  chime() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => this.beep(f, 0.3, 0.12), i * 70));
  }

  say(text: string) {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }

  private blast(ctx: AudioContext, start: number, duration: number) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(2850, start);
    osc1.frequency.exponentialRampToValueAtTime(2950, start + duration * 0.4);
    osc1.frequency.exponentialRampToValueAtTime(2800, start + duration);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3120, start);
    osc2.frequency.exponentialRampToValueAtTime(3200, start + duration * 0.4);
    osc2.frequency.exponentialRampToValueAtTime(3080, start + duration);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2980, start);
    filter.Q.setValueAtTime(6, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.28, start + 0.03);
    gain.gain.setValueAtTime(0.25, start + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain).connect(ctx.destination);
    osc1.start(start);
    osc2.start(start);
    osc1.stop(start + duration + 0.05);
    osc2.stop(start + duration + 0.05);
  }
}

export const announcer = new Announcer();
