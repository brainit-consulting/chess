import { describe, expect, it } from 'vitest';
import { GameClock } from '../gameClock';

describe('GameClock', () => {
  it('excludes paused time from elapsed', () => {
    let now = 0;
    const clock = new GameClock(() => now);

    clock.start();
    now += 1500;
    clock.pause();

    now += 2000;
    clock.resume();
    now += 500;
    clock.stop();

    expect(clock.getElapsedMs()).toBe(2000);
  });
});
