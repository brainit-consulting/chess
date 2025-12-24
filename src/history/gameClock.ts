type NowFn = () => number;

export class GameClock {
  private now: NowFn;
  private accumulatedMs = 0;
  private running = false;
  private started = false;
  private lastStartAt: number | null = null;

  constructor(now: NowFn = () => Date.now()) {
    this.now = now;
  }

  start(): void {
    if (this.running) {
      return;
    }
    if (this.started) {
      this.resume();
      return;
    }
    this.started = true;
    this.running = true;
    this.lastStartAt = this.now();
  }

  pause(): void {
    if (!this.running || this.lastStartAt === null) {
      return;
    }
    this.accumulatedMs += this.now() - this.lastStartAt;
    this.running = false;
    this.lastStartAt = null;
  }

  resume(): void {
    if (this.running) {
      return;
    }
    if (!this.started) {
      this.start();
      return;
    }
    this.running = true;
    this.lastStartAt = this.now();
  }

  stop(): void {
    if (this.running) {
      this.pause();
    }
  }

  reset(): void {
    this.accumulatedMs = 0;
    this.running = false;
    this.started = false;
    this.lastStartAt = null;
  }

  getElapsedMs(): number {
    if (this.running && this.lastStartAt !== null) {
      return this.accumulatedMs + (this.now() - this.lastStartAt);
    }
    return this.accumulatedMs;
  }

  isRunning(): boolean {
    return this.running;
  }

  hasStarted(): boolean {
    return this.started;
  }
}
