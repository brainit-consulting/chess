import { spawn } from 'node:child_process';
import readline from 'node:readline';

export type StockfishConfig = {
  path: string;
  threads?: number;
  hashMb?: number;
  ponder?: boolean;
};

type Pending = {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

export class StockfishClient {
  private proc: ReturnType<typeof spawn>;
  private rl: readline.Interface;
  private stderr: readline.Interface | null = null;
  private stderrBuffer: string[] = [];
  private ready: Pending | null = null;
  private uciReady: Pending | null = null;
  private bestMove: Pending | null = null;
  private quitting = false;

  constructor(private config: StockfishConfig) {
    this.proc = spawn(this.config.path, [], { stdio: 'pipe' });
    this.rl = readline.createInterface({ input: this.proc.stdout });
    if (this.proc.stderr) {
      this.stderr = readline.createInterface({ input: this.proc.stderr });
      this.stderr.on('line', (line) => this.captureStderr(line));
    }
    this.proc.on('error', (error) => {
      this.rejectAll(error);
    });
    this.proc.on('exit', (code, signal) => {
      if (this.quitting) {
        return;
      }
      this.rejectAll(this.buildExitError(code, signal));
    });
    this.rl.on('line', (line) => this.handleLine(line));
  }

  async init(): Promise<void> {
    this.send('uci');
    await this.waitForUciOk();
    this.send(`setoption name Threads value ${this.config.threads ?? 1}`);
    this.send(`setoption name Hash value ${this.config.hashMb ?? 64}`);
    this.send(`setoption name Ponder value ${this.config.ponder ? 'true' : 'false'}`);
    await this.isReady();
  }

  async getBestMove(fen: string, movetimeMs: number): Promise<string | null> {
    this.send(`position fen ${fen}`);
    this.send(`go movetime ${movetimeMs}`);
    const line = await this.waitForBestMove();
    const parts = line.split(/\s+/);
    const best = parts[1];
    if (!best || best === '(none)') {
      return null;
    }
    return best;
  }

  stopSearch(): void {
    this.send('stop');
  }

  async isReady(): Promise<void> {
    this.send('isready');
    await this.waitForReadyOk();
  }

  quit(): void {
    this.quitting = true;
    this.send('quit');
    this.rl.close();
    this.stderr?.close();
    this.proc.kill();
  }

  private send(command: string): void {
    this.proc.stdin.write(`${command}\n`);
  }

  private handleLine(line: string): void {
    if (line.startsWith('uciok')) {
      this.uciReady?.resolve(line);
      this.uciReady = null;
      return;
    }
    if (line.startsWith('readyok')) {
      this.ready?.resolve(line);
      this.ready = null;
      return;
    }
    if (line.startsWith('bestmove')) {
      this.bestMove?.resolve(line);
      this.bestMove = null;
    }
  }

  private waitForUciOk(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.uciReady = { resolve, reject };
    });
  }

  private waitForReadyOk(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.ready = { resolve, reject };
    });
  }

  private waitForBestMove(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.bestMove = { resolve, reject };
    });
  }

  private captureStderr(line: string): void {
    this.stderrBuffer.push(line);
    if (this.stderrBuffer.length > 20) {
      this.stderrBuffer.shift();
    }
  }

  private buildExitError(code: number | null, signal: NodeJS.Signals | null): Error {
    const details: string[] = [];
    if (code !== null) {
      details.push(`code=${code}`);
    }
    if (signal) {
      details.push(`signal=${signal}`);
    }
    if (this.stderrBuffer.length > 0) {
      details.push(`stderr=${this.stderrBuffer.join(' | ')}`);
    }
    const suffix = details.length > 0 ? ` (${details.join(', ')})` : '';
    return new Error(`Stockfish process exited${suffix}`);
  }

  private rejectAll(error: Error): void {
    this.uciReady?.reject(error);
    this.ready?.reject(error);
    this.bestMove?.reject(error);
    this.uciReady = null;
    this.ready = null;
    this.bestMove = null;
  }
}
