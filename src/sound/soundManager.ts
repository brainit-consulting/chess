export type SoundEffect = 'move' | 'capture' | 'check' | 'checkmate' | 'ui';

type SoundSpec = {
  duration: number;
  cutoff: number;
  gain: number;
  minIntervalMs: number;
};

const SOUND_PREF_KEY = 'chess.soundEnabled';

const SOUND_SPECS: Record<SoundEffect, SoundSpec> = {
  move: { duration: 0.08, cutoff: 1200, gain: 0.08, minIntervalMs: 80 },
  capture: { duration: 0.12, cutoff: 900, gain: 0.12, minIntervalMs: 120 },
  check: { duration: 0.1, cutoff: 700, gain: 0.1, minIntervalMs: 200 },
  checkmate: { duration: 0.18, cutoff: 650, gain: 0.09, minIntervalMs: 400 },
  ui: { duration: 0.06, cutoff: 1400, gain: 0.05, minIntervalMs: 80 }
};

type BufferConfig = {
  buffer: AudioBuffer;
  spec: SoundSpec;
};

export class SoundManager {
  private context: AudioContext | null = null;
  private buffers = new Map<SoundEffect, BufferConfig>();
  private enabled: boolean;
  private unlocked = false;
  private lastPlay = new Map<SoundEffect, number>();

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  static loadEnabled(): boolean {
    if (typeof window === 'undefined') {
      return true;
    }
    try {
      const stored = window.localStorage.getItem(SOUND_PREF_KEY);
      if (stored === null) {
        window.localStorage.setItem(SOUND_PREF_KEY, 'true');
        return true;
      }
      return stored === 'true';
    } catch {
      return true;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SOUND_PREF_KEY, enabled ? 'true' : 'false');
      } catch {
        // ignore storage errors
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  unlock(): void {
    if (this.unlocked) {
      return;
    }
    this.context = new AudioContext();
    this.preloadBuffers(this.context);
    void this.context.resume();
    this.unlocked = true;
  }

  play(effect: SoundEffect): void {
    if (!this.enabled || !this.unlocked || !this.context) {
      return;
    }

    const now = performance.now();
    const last = this.lastPlay.get(effect) ?? 0;
    const spec = SOUND_SPECS[effect];
    if (now - last < spec.minIntervalMs) {
      return;
    }
    this.lastPlay.set(effect, now);

    const config = this.buffers.get(effect);
    if (!config) {
      return;
    }

    const source = this.context.createBufferSource();
    source.buffer = config.buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = spec.cutoff;
    filter.Q.value = 0.8;

    const gain = this.context.createGain();
    gain.gain.value = spec.gain;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);
    source.start();
  }

  private preloadBuffers(context: AudioContext): void {
    for (const effect of Object.keys(SOUND_SPECS) as SoundEffect[]) {
      const spec = SOUND_SPECS[effect];
      const buffer = createNoiseBuffer(context, spec.duration);
      this.buffers.set(effect, { buffer, spec });
    }
  }
}

function createNoiseBuffer(context: AudioContext, duration: number): AudioBuffer {
  const sampleRate = context.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i += 1) {
    const t = i / frameCount;
    const envelope = (1 - t) * (1 - t);
    data[i] = (Math.random() * 2 - 1) * envelope;
  }

  return buffer;
}
