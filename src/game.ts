import {
  GameState,
  GameStatus,
  Color,
  Move,
  PieceType,
  Square,
  applyMove,
  createInitialState,
  findKingSquare,
  getPieceAt,
  getGameStatus,
  getLegalMovesForSquare,
  sameSquare
} from './rules';
import { AiDifficulty, chooseMove } from './ai/ai';
import { SceneView, PickResult } from './client/scene';
import { GameUI, UiState } from './ui/ui';
import { GameStats } from './gameStats';
import { SoundManager } from './sound/soundManager';
import { GameMode } from './types';
import { createGameSummary } from './gameSummary';

type PlayerNames = {
  white: string;
  black: string;
};

type AiSettings = {
  enabled: boolean;
  difficulty: AiDifficulty;
};

type Preferences = {
  names: PlayerNames;
  ai: AiSettings;
  mode: GameMode;
  aiDelayMs: number;
};

const DEFAULT_NAMES: PlayerNames = { white: 'White', black: 'Black' };
const DEFAULT_AI_DELAY_MS = 700;
const HUMAN_VS_AI_DELAY_MS = 380;
const STORAGE_KEYS = {
  names: 'chess.playerNames',
  ai: 'chess.aiSettings',
  mode: 'chess.gameMode',
  aiDelay: 'chess.aiDelayMs'
};
const AI_LABELS: Record<AiDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard'
};

export class GameController {
  private state: GameState;
  private scene: SceneView;
  private ui: GameUI;
  private stats: GameStats;
  private sound: SoundManager;
  private selected: Square | null = null;
  private legalMoves: Move[] = [];
  private pendingPromotion: Move[] | null = null;
  private gameOver = false;
  private mode: GameMode = 'hvai';
  private aiDifficulty: AiDifficulty = 'medium';
  private aiSeed: number | undefined;
  private aiDelayMs = DEFAULT_AI_DELAY_MS;
  private aiTimeout: number | null = null;
  private aiRequestId = 0;
  private summaryShown = false;
  private baseNames: PlayerNames = { ...DEFAULT_NAMES };

  constructor(sceneRoot: HTMLElement, uiRoot: HTMLElement) {
    this.state = createInitialState();
    const preferences = this.loadPreferences();
    this.mode = preferences.mode;
    this.aiDifficulty = preferences.ai.difficulty;
    this.aiDelayMs = preferences.aiDelayMs;
    this.baseNames = preferences.names;
    const soundEnabled = SoundManager.loadEnabled();
    this.sound = new SoundManager(soundEnabled);
    this.scene = new SceneView(sceneRoot, {
      onPick: (pick) => this.handlePick(pick),
      onCancel: () => this.clearSelection()
    });
    this.ui = new GameUI(uiRoot, {
      onRestart: () => this.reset(),
      onSnap: (view) => this.scene.snapView(view),
      onPromotionChoice: (type) => this.resolvePromotion(type),
      onToggleAi: (enabled) => this.setAiEnabled(enabled),
      onModeChange: (mode) => this.setMode(mode),
      onDifficultyChange: (difficulty) => this.setAiDifficulty(difficulty),
      onToggleSound: (enabled) => this.setSoundEnabled(enabled),
      onAiDelayChange: (delayMs) => this.setAiDelay(delayMs),
      onUiStateChange: (state) => this.handleUiStateChange(state)
    }, {
      mode: this.mode,
      aiEnabled: this.mode !== 'hvh',
      aiDifficulty: this.aiDifficulty,
      aiDelayMs: this.aiDelayMs,
      soundEnabled
    });
    this.stats = new GameStats();
    this.stats.reset(this.state);
    this.ui.setScores(this.stats.getScores());
    this.updatePlayerNames();
    this.scene.setUiState(this.ui.getUiState());
    this.setupSoundUnlock();

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.clearSelection();
      }
    });
  }

  start(): void {
    void this.scene.ready().then(() => {
      this.sync();
      this.maybeScheduleAiMove();
    });
  }

  private reset(): void {
    this.cancelAiMove();
    this.state = createInitialState();
    this.selected = null;
    this.legalMoves = [];
    this.pendingPromotion = null;
    this.gameOver = false;
    this.summaryShown = false;
    this.ui.hideSummary();
    this.stats.reset(this.state);
    this.ui.setScores(this.stats.getScores());
    this.sync();
    this.maybeScheduleAiMove();
  }

  private sync(statusOverride?: GameStatus): void {
    this.scene.setState(this.state);

    const status = statusOverride ?? getGameStatus(this.state);
    this.gameOver = status.status === 'checkmate' || status.status === 'stalemate';
    this.ui.setTurn(this.state.activeColor);
    this.ui.setStatus(status);
    this.maybeShowSummary(status);

    const checkSquare =
      status.status === 'check' || status.status === 'checkmate'
        ? findKingSquare(this.state, this.state.activeColor)
        : null;

    this.scene.setHighlights({
      selected: this.selected,
      legalMoves: this.legalMoves,
      lastMove: this.state.lastMove,
      checkSquare
    });
  }

  private handlePick(pick: PickResult): void {
    if (this.gameOver || this.pendingPromotion) {
      return;
    }

    if (this.isAiControlled(this.state.activeColor)) {
      return;
    }

    if (pick.type === 'piece' && typeof pick.pieceId === 'number') {
      const piece = this.state.pieces.get(pick.pieceId);
      if (!piece) {
        return;
      }

      if (piece.color === this.state.activeColor) {
        this.selectSquare(pick.square);
        return;
      }
    }

    if (this.selected) {
      this.tryMoveTo(pick.square);
      return;
    }

    const pieceAtSquare = getPieceAt(this.state, pick.square);
    if (pieceAtSquare && pieceAtSquare.color === this.state.activeColor) {
      this.selectSquare(pick.square);
    }
  }

  private selectSquare(square: Square): void {
    this.selected = square;
    this.legalMoves = getLegalMovesForSquare(this.state, square);
    this.sync();
  }

  private clearSelection(): void {
    this.selected = null;
    this.legalMoves = [];
    this.pendingPromotion = null;
    this.ui.hidePromotion();
    this.sync();
  }

  private tryMoveTo(target: Square): void {
    const candidates = this.legalMoves.filter((move) => sameSquare(move.to, target));
    if (candidates.length === 0) {
      return;
    }

    if (candidates.length > 1) {
      this.pendingPromotion = candidates;
      this.ui.showPromotion();
      return;
    }

    this.applyAndAdvance(candidates[0]);
  }

  private resolvePromotion(type: PieceType): void {
    if (!this.pendingPromotion) {
      return;
    }

    const move =
      this.pendingPromotion.find((candidate) => candidate.promotion === type) ||
      this.pendingPromotion[0];
    this.pendingPromotion = null;
    this.ui.hidePromotion();
    this.applyAndAdvance(move);
  }

  private applyAndAdvance(move: Move): void {
    this.cancelAiMove();
    const moverColor = this.state.activeColor;
    applyMove(this.state, move);
    this.stats.updateAfterMove(this.state, moverColor);
    this.ui.setScores(this.stats.getScores());
    this.selected = null;
    this.legalMoves = [];
    const status = getGameStatus(this.state);
    const isCapture = move.capturedId !== undefined || move.isEnPassant;
    this.sound.play(isCapture ? 'capture' : 'move');
    if (status.status === 'checkmate') {
      this.sound.play('checkmate');
      this.scene.settleCheckmate();
    } else if (status.status === 'check') {
      this.sound.play('check');
    }
    this.scene.nudgeTurnChange();
    this.sync(status);
    this.maybeScheduleAiMove();
  }

  private maybeScheduleAiMove(): void {
    if (this.gameOver) {
      this.ui.setAiThinking(false);
      return;
    }
    if (!this.isAiControlled(this.state.activeColor)) {
      this.ui.setAiThinking(false);
      return;
    }
    this.scheduleAiMove(this.state.activeColor);
  }

  private scheduleAiMove(color: Color): void {
    this.cancelAiMove();
    const requestId = this.aiRequestId;
    const delayMs = this.getAiDelayMs();
    const thinkingColor = this.mode === 'aivai' ? color : undefined;
    this.ui.setAiThinking(true, thinkingColor);

    this.aiTimeout = window.setTimeout(() => {
      if (requestId !== this.aiRequestId) {
        return;
      }
      if (this.gameOver || !this.isAiControlled(this.state.activeColor)) {
        this.ui.setAiThinking(false);
        return;
      }

      const move = chooseMove(this.state, {
        color: this.state.activeColor,
        difficulty: this.aiDifficulty,
        seed: this.aiSeed
      });

      if (!move) {
        this.ui.setAiThinking(false);
        this.sync();
        return;
      }

      this.ui.setAiThinking(false);
      this.applyAndAdvance(move);
    }, delayMs);
  }

  private cancelAiMove(): void {
    this.aiRequestId += 1;
    if (this.aiTimeout !== null) {
      window.clearTimeout(this.aiTimeout);
      this.aiTimeout = null;
    }
    this.ui.setAiThinking(false);
  }

  private setAiEnabled(enabled: boolean): void {
    this.setMode(enabled ? 'hvai' : 'hvh');
  }

  private setMode(mode: GameMode): void {
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    this.persistPreferences();
    this.ui.setMode(mode);
    this.updatePlayerNames();
    this.cancelAiMove();
    this.maybeScheduleAiMove();
  }

  private setAiDifficulty(difficulty: AiDifficulty): void {
    this.aiDifficulty = difficulty;
    this.persistPreferences();
    this.updatePlayerNames();
  }

  private setAiDelay(delayMs: number): void {
    this.aiDelayMs = delayMs;
    this.persistPreferences();
  }

  private setSoundEnabled(enabled: boolean): void {
    this.sound.setEnabled(enabled);
  }

  private handleUiStateChange(state: UiState): void {
    this.scene.setUiState(state);
    this.sound.play('ui');
  }

  private updatePlayerNames(): void {
    if (this.mode === 'hvh') {
      this.ui.setPlayerNames({ ...this.baseNames });
      return;
    }

    if (this.mode === 'hvai') {
      this.ui.setPlayerNames({
        white: 'You',
        black: `AI (${AI_LABELS[this.aiDifficulty]})`
      });
      return;
    }

    const label = `AI (${AI_LABELS[this.aiDifficulty]})`;
    this.ui.setPlayerNames({ white: label, black: label });
  }

  private isAiControlled(color: Color): boolean {
    if (this.mode === 'hvh') {
      return false;
    }
    if (this.mode === 'hvai') {
      return color === 'b';
    }
    return true;
  }

  private getAiDelayMs(): number {
    return this.mode === 'aivai' ? this.aiDelayMs : HUMAN_VS_AI_DELAY_MS;
  }

  private maybeShowSummary(status: GameStatus): void {
    if (this.summaryShown) {
      return;
    }
    if (status.status !== 'checkmate' && status.status !== 'stalemate') {
      return;
    }
    const summary = createGameSummary(this.state, status, this.stats.getScores());
    if (!summary) {
      return;
    }
    this.ui.showSummary(summary);
    this.summaryShown = true;
  }

  private setupSoundUnlock(): void {
    const unlock = () => {
      this.sound.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private loadPreferences(): Preferences {
    const storage = this.getStorage();
    let names = { ...DEFAULT_NAMES };
    let ai: AiSettings = { enabled: true, difficulty: 'medium' };
    let mode: GameMode = ai.enabled ? 'hvai' : 'hvh';
    let aiDelayMs = DEFAULT_AI_DELAY_MS;

    if (storage) {
      const rawNames = storage.getItem(STORAGE_KEYS.names);
      if (rawNames) {
        try {
          const parsed = JSON.parse(rawNames) as PlayerNames;
          if (parsed.white && parsed.black) {
            names = parsed;
          }
        } catch {
          // ignore malformed storage values
        }
      }

      const rawAi = storage.getItem(STORAGE_KEYS.ai);
      if (rawAi) {
        try {
          const parsed = JSON.parse(rawAi) as AiSettings;
          if (typeof parsed.enabled === 'boolean') {
            ai.enabled = parsed.enabled;
          }
          if (parsed.difficulty && AI_LABELS[parsed.difficulty]) {
            ai.difficulty = parsed.difficulty;
          }
        } catch {
          // ignore malformed storage values
        }
      }

      const rawMode = storage.getItem(STORAGE_KEYS.mode);
      if (rawMode === 'hvh' || rawMode === 'hvai' || rawMode === 'aivai') {
        mode = rawMode;
      } else {
        mode = ai.enabled ? 'hvai' : 'hvh';
      }

      const rawDelay = storage.getItem(STORAGE_KEYS.aiDelay);
      if (rawDelay) {
        const parsed = Number(rawDelay);
        if (Number.isFinite(parsed) && parsed >= 400) {
          aiDelayMs = parsed;
        }
      }

      storage.setItem(STORAGE_KEYS.names, JSON.stringify(names));
      storage.setItem(STORAGE_KEYS.ai, JSON.stringify(ai));
      storage.setItem(STORAGE_KEYS.mode, mode);
      storage.setItem(STORAGE_KEYS.aiDelay, aiDelayMs.toString());
    }

    return { names, ai, mode, aiDelayMs };
  }

  private persistPreferences(): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    const aiEnabled = this.mode !== 'hvh';
    storage.setItem(STORAGE_KEYS.names, JSON.stringify(this.baseNames));
    storage.setItem(
      STORAGE_KEYS.ai,
      JSON.stringify({ enabled: aiEnabled, difficulty: this.aiDifficulty })
    );
    storage.setItem(STORAGE_KEYS.mode, this.mode);
    storage.setItem(STORAGE_KEYS.aiDelay, this.aiDelayMs.toString());
  }

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
}
