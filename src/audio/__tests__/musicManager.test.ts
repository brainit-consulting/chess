import { describe, expect, it } from 'vitest';
import { MusicManager } from '../musicManager';

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

class MockAudio {
  loop = false;
  preload = '';
  volume = 1;
  playCount = 0;

  play(): Promise<void> {
    this.playCount += 1;
    return Promise.resolve();
  }

  pause(): void {
    // no-op
  }
}

describe('MusicManager', () => {
  it('persists enabled and volume preferences', () => {
    const storage = new MemoryStorage();
    const audio = new MockAudio();
    const manager = new MusicManager({ storage, audio: audio as unknown as HTMLAudioElement });

    manager.setMusicEnabled(true);
    manager.setMusicVolume(0.35);

    expect(storage.getItem('chess.musicEnabled')).toBe('true');
    expect(storage.getItem('chess.musicVolume')).toBe('0.35');
  });

  it('clamps volume between 0 and 1', () => {
    const storage = new MemoryStorage();
    const audio = new MockAudio();
    const manager = new MusicManager({ storage, audio: audio as unknown as HTMLAudioElement });

    manager.setMusicVolume(2);
    expect(manager.getMusicVolume()).toBe(1);

    manager.setMusicVolume(-1);
    expect(manager.getMusicVolume()).toBe(0);
  });
});
