const BASE_URL = import.meta.env.BASE_URL;
const MUSIC_URL = `${BASE_URL}assets/audio/a-way-out-294728.mp3`;

const STORAGE_KEYS = {
  enabled: 'chess.musicEnabled',
  volume: 'chess.musicVolume'
};

const DEFAULT_VOLUME = 0.2;

export type MusicManagerOptions = {
  storage?: Storage | null;
  audio?: HTMLAudioElement;
  onUnlockNeeded?: (needed: boolean) => void;
};

export class MusicManager {
  private audio: HTMLAudioElement;
  private enabled = false;
  private volume = DEFAULT_VOLUME;
  private storage: Storage | null;
  private unlockNeeded = false;
  private onUnlockNeeded?: (needed: boolean) => void;
  private unlockHandler = () => this.tryUnlock();
  private unlockListenersAttached = false;

  constructor(options: MusicManagerOptions = {}) {
    this.storage = options.storage ?? getStorage();
    this.onUnlockNeeded = options.onUnlockNeeded;
    this.audio = options.audio ?? new Audio(MUSIC_URL);
    this.audio.loop = true;
    this.audio.preload = 'auto';

    this.loadPreferences();
    this.audio.volume = this.volume;

    if (this.enabled) {
      void this.startPlayback();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.audio.pause();
      });
    }
  }

  setOnUnlockNeeded(handler: (needed: boolean) => void): void {
    this.onUnlockNeeded = handler;
    if (this.unlockNeeded) {
      this.onUnlockNeeded?.(true);
    }
  }

  getMusicEnabled(): boolean {
    return this.enabled;
  }

  getMusicVolume(): number {
    return this.volume;
  }

  getUnlockNeeded(): boolean {
    return this.unlockNeeded;
  }

  setMusicEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.saveEnabled();
    if (!enabled) {
      this.audio.pause();
      this.setUnlockNeeded(false);
      this.detachUnlockListeners();
      return;
    }
    void this.startPlayback();
  }

  setMusicVolume(volume01: number): void {
    this.volume = clamp01(volume01);
    this.audio.volume = this.volume;
    this.saveVolume();
  }

  private async startPlayback(): Promise<void> {
    try {
      await this.audio.play();
      this.setUnlockNeeded(false);
      this.detachUnlockListeners();
    } catch {
      this.setUnlockNeeded(true);
      this.attachUnlockListeners();
    }
  }

  private tryUnlock(): void {
    if (!this.enabled) {
      return;
    }
    void this.startPlayback();
  }

  private setUnlockNeeded(needed: boolean): void {
    if (this.unlockNeeded === needed) {
      return;
    }
    this.unlockNeeded = needed;
    this.onUnlockNeeded?.(needed);
  }

  private attachUnlockListeners(): void {
    if (this.unlockListenersAttached || typeof window === 'undefined') {
      return;
    }
    this.unlockListenersAttached = true;
    window.addEventListener('pointerdown', this.unlockHandler, { once: true });
    window.addEventListener('keydown', this.unlockHandler, { once: true });
  }

  private detachUnlockListeners(): void {
    if (!this.unlockListenersAttached || typeof window === 'undefined') {
      return;
    }
    this.unlockListenersAttached = false;
    window.removeEventListener('pointerdown', this.unlockHandler);
    window.removeEventListener('keydown', this.unlockHandler);
  }

  private loadPreferences(): void {
    if (!this.storage) {
      return;
    }
    const rawEnabled = this.storage.getItem(STORAGE_KEYS.enabled);
    if (rawEnabled !== null) {
      this.enabled = rawEnabled === 'true';
    }
    const rawVolume = this.storage.getItem(STORAGE_KEYS.volume);
    if (rawVolume !== null) {
      const parsed = Number(rawVolume);
      if (Number.isFinite(parsed)) {
        this.volume = clamp01(parsed);
      }
    }

    this.storage.setItem(STORAGE_KEYS.enabled, this.enabled.toString());
    this.storage.setItem(STORAGE_KEYS.volume, this.volume.toString());
  }

  private saveEnabled(): void {
    if (!this.storage) {
      return;
    }
    this.storage.setItem(STORAGE_KEYS.enabled, this.enabled.toString());
  }

  private saveVolume(): void {
    if (!this.storage) {
      return;
    }
    this.storage.setItem(STORAGE_KEYS.volume, this.volume.toString());
  }
}

export function initMusic(options?: MusicManagerOptions): MusicManager {
  return new MusicManager(options);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return DEFAULT_VOLUME;
  }
  return Math.min(1, Math.max(0, value));
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
