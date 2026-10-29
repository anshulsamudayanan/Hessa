/**
 * Web Audio API - Synthetic Sports & Traditional Referee Whistle
 * Generates an authentic dual-tone whistle with subtle aerodynamic flutter.
 */

class SoundService {
  private audioCtx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Blast a referee whistle sound
   */
  public playWhistle(style: 'short' | 'double' | 'foul' = 'short') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      if (style === 'double') {
        this.synthesizeWhistleBlast(ctx, now, 0.16);
        this.synthesizeWhistleBlast(ctx, now + 0.22, 0.32);
      } else if (style === 'foul') {
        this.synthesizeWhistleBlast(ctx, now, 0.12);
        this.synthesizeWhistleBlast(ctx, now + 0.16, 0.12);
        this.synthesizeWhistleBlast(ctx, now + 0.34, 0.45);
      } else {
        // Standard single blast
        this.synthesizeWhistleBlast(ctx, now, 0.28);
      }
    } catch (e) {
      console.warn('Audio synthesis failed or blocked by autoplay policy:', e);
    }
  }

  private synthesizeWhistleBlast(ctx: AudioContext, startTime: number, duration: number) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Two close frequencies to create the characteristic acoustic whistle heterodyne 'beat'
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(2850, startTime);
    osc1.frequency.exponentialRampToValueAtTime(2950, startTime + duration * 0.4);
    osc1.frequency.exponentialRampToValueAtTime(2800, startTime + duration);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3120, startTime);
    osc2.frequency.exponentialRampToValueAtTime(3200, startTime + duration * 0.4);
    osc2.frequency.exponentialRampToValueAtTime(3080, startTime + duration);

    // Bandpass filter centered at whistle resonance
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2980, startTime);
    filter.Q.setValueAtTime(6.0, startTime);

    // Attack - Decay - Sustain - Release envelope
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.28, startTime + 0.03); // Quick crisp attack
    gainNode.gain.setValueAtTime(0.25, startTime + duration * 0.7);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration); // Smooth release

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration + 0.05);
    osc2.stop(startTime + duration + 0.05);
  }

  /**
   * Pleasant success chime for confirmed points
   */
  public playScoreChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.15, now + idx * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.4);
      });
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }
}

export const soundEffects = new SoundService();
