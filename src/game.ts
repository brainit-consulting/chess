import {
  GameState,
  GameStatus,
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

type PlayerNames = {
  white: string;
  black: string;
};

type AiSettings = {
  enabled: boolean;
  difficulty: AiDifficulty;
};

const DEFAULT_NAMES: PlayerNames = { white: 'White', black: 'Black' };
const STORAGE_KEYS = {
  names: 'chess.playerNames',
  ai: 'chess.aiSettings'
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
  private aiEnabled = true;
  private aiDifficulty: AiDifficulty = 'medium';
  private aiSeed: number | undefined;
  private aiTimeout: number | null = null;
  private aiRequestId = 0;
  private baseNames: PlayerNames = { ...DEFAULT_NAMES };

  constructor(sceneRoot: HTMLElement, uiRoot: HTMLElement) {
    this.state = createInitialState();
    const preferences = this.loadPreferences();
    this.aiEnabled = preferences.ai.enabled;
    this.aiDifficulty = preferences.ai.difficulty;
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
      onDifficultyChange: (difficulty) => this.setAiDifficulty(difficulty),
      onToggleSound: (enabled) => this.setSoundEnabled(enabled),
      onUiStateChange: (state) => this.handleUiStateChange(state)
    }, {
      aiEnabled: this.aiEnabled,
      aiDifficulty: this.aiDifficulty,
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

    if (this.aiEnabled && this.state.activeColor === 'b') {
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
    if (!this.aiEnabled) {
      return;
    }
    if (this.gameOver) {
      return;
    }
    if (this.state.activeColor !== 'b') {
      return;
    }
    this.scheduleAiMove();
  }

  private scheduleAiMove(): void {
    this.cancelAiMove();
    const requestId = this.aiRequestId;
    const delayMs = 380;

    this.aiTimeout = window.setTimeout(() => {
      if (requestId !== this.aiRequestId) {
        return;
      }
      if (!this.aiEnabled || this.gameOver || this.state.activeColor !== 'b') {
        return;
      }

      const move = chooseMove(this.state, {
        color: 'b',
        difficulty: this.aiDifficulty,
        seed: this.aiSeed
      });

      if (!move) {
        this.sync();
        return;
      }

      this.applyAndAdvance(move);
    }, delayMs);
  }

  private cancelAiMove(): void {
    this.aiRequestId += 1;
    if (this.aiTimeout !== null) {
      window.clearTimeout(this.aiTimeout);
      this.aiTimeout = null;
    }
  }

  private setAiEnabled(enabled: boolean): void {
    this.aiEnabled = enabled;
    this.persistPreferences();
    this.updatePlayerNames();
    this.cancelAiMove();
    this.maybeScheduleAiMove();
  }

  private setAiDifficulty(difficulty: AiDifficulty): void {
    this.aiDifficulty = difficulty;
    this.persistPreferences();
    this.updatePlayerNames();
  }

  private setSoundEnabled(enabled: boolean): void {
    this.sound.setEnabled(enabled);
  }

  private handleUiStateChange(state: UiState): void {
    this.scene.setUiState(state);
    this.sound.play('ui');
  }

  private updatePlayerNames(): void {
    if (this.aiEnabled) {
      this.ui.setPlayerNames({
        white: 'You',
        black: `AI (${AI_LABELS[this.aiDifficulty]})`
      });
      return;
    }

    this.ui.setPlayerNames({ ...this.baseNames });
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

  private loadPreferences(): { names: PlayerNames; ai: AiSettings } {
    const storage = this.getStorage();
    let names = { ...DEFAULT_NAMES };
    let ai: AiSettings = { enabled: true, difficulty: 'medium' };

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

      storage.setItem(STORAGE_KEYS.names, JSON.stringify(names));
      storage.setItem(STORAGE_KEYS.ai, JSON.stringify(ai));
    }

    return { names, ai };
  }

  private persistPreferences(): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    storage.setItem(STORAGE_KEYS.names, JSON.stringify(this.baseNames));
    storage.setItem(
      STORAGE_KEYS.ai,
      JSON.stringify({ enabled: this.aiEnabled, difficulty: this.aiDifficulty })
    );
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
