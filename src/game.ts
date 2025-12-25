import {
  GameState,
  GameStatus,
  Color,
  Move,
  Piece,
  PieceType,
  Square,
  applyMove,
  createInitialState,
  findKingSquare,
  getPieceAt,
  getGameStatus,
  getLegalMovesForSquare,
  getPositionKey,
  sameSquare
} from './rules';
import {
  AiDifficulty,
  MAX_THINKING_AI_VS_AI_MS,
  MAX_THINKING_DEPTH_CAP,
  MAX_THINKING_HUMAN_VS_AI_MS,
  chooseMove
} from './ai/ai';
import { explainMove } from './ai/aiExplain';
import {
  AiExplainOptions,
  AiExplainResult,
  AiWorkerRequest,
  AiWorkerResponse
} from './ai/aiWorkerTypes';
import {
  shouldApplyAiResponse,
  shouldApplyExplainResponse,
  shouldApplyHintResponse,
  shouldPauseForExplanation,
  shouldRequestHint,
  shouldResumeAfterExplanation,
  selectWorkerForRequest
} from './ai/aiWorkerClient';
import { SceneView, PickResult } from './client/scene';
import { GameUI, UiState } from './ui/ui';
import { GameStats } from './gameStats';
import { GameHistory } from './history/gameHistory';
import { GameClock } from './history/gameClock';
import { copyToClipboard } from './ui/clipboard';
import {
  buildPlainEnglishHtml,
  buildPlainEnglishLines,
  buildPlainEnglishText
} from './history/plainEnglish';
import { SoundManager } from './sound/soundManager';
import { initMusic, MusicManager } from './audio/musicManager';
import { GameMode, PieceSet } from './types';
import { createGameSummary } from './gameSummary';
import { buildPgn, buildSanLine, PgnMove } from './pgn/pgn';
import { ANALYZER_OPTIONS, AnalyzerChoice, DEFAULT_ANALYZER } from './analyzer';

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
  pieceSet: PieceSet;
  playForWinAiVsAi: boolean;
  hintMode: boolean;
  analyzerChoice: AnalyzerChoice;
  showCoordinates: boolean;
  humanColor: Color;
  autoSnapHumanView: boolean;
};

const DEFAULT_NAMES: PlayerNames = { white: 'White', black: 'Black' };
const DEFAULT_AI_DELAY_MS = 700;
const HUMAN_VS_AI_DELAY_MS = 380;
const EXPLAIN_TIMEOUT_MS = 10000;
const STORAGE_KEYS = {
  names: 'chess.playerNames',
  ai: 'chess.aiSettings',
  mode: 'chess.gameMode',
  aiDelay: 'chess.aiDelayMs',
  pieceSet: 'chess.pieceSet',
  playForWinAiVsAi: 'chess.playForWinAiVsAi',
  hintMode: 'chess.hintMode',
  analyzerChoice: 'chess.analyzerChoice',
  showCoordinates: 'chess.showCoordinates',
  humanColor: 'chess.humanColor',
  autoSnapHumanView: 'chess.autoSnapHumanView'
};
const AI_LABELS: Record<AiDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  max: 'Max Thinking'
};

export class GameController {
  private state: GameState;
  private scene: SceneView;
  private ui: GameUI;
  private stats: GameStats;
  private history = new GameHistory();
  private clock = new GameClock();
  private timerInterval: number | null = null;
  private sound: SoundManager;
  private music: MusicManager;
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
  private lastStatus: GameStatus | null = null;
  private lastPgnText: string | null = null;
  private lastPlainText: string | null = null;
  private lastPlainHtml: string | null = null;
  private lastPlainView: string | null = null;
  private aiVsAiStarted = false;
  private aiVsAiRunning = false;
  private aiVsAiPaused = false;
  private baseNames: PlayerNames = { ...DEFAULT_NAMES };
  private pieceSet: PieceSet = 'scifi';
  private playForWinAiVsAi = true;
  private recentPositions: string[] = [];
  private hintMode = false;
  private analyzerChoice: AnalyzerChoice = DEFAULT_ANALYZER;
  private showCoordinates = true;
  private humanColor: Color = 'w';
  private autoSnapHumanView = true;
  private hintMove: Move | null = null;
  private hintRequestId = 0;
  private hintPositionKey: string | null = null;
  private lastAiMove: Move | null = null;
  private lastAiPositionKey: string | null = null;
  private lastAiMoveSignature: string | null = null;
  private lastAiExplanation: AiExplainResult | null = null;
  private explainRequestId = 0;
  private explainLoading = false;
  private explainPaused = false;
  private explainTimeoutId: number | null = null;
  private explainCache = new Map<string, AiExplainResult>();
  private aiWorker: Worker | null = null;
  private explainWorker: Worker | null = null;
  private aiPendingApplyAt = 0;

  constructor(sceneRoot: HTMLElement, uiRoot: HTMLElement) {
    this.state = createInitialState();
    const preferences = this.loadPreferences();
    this.mode = preferences.mode;
    this.aiDifficulty = preferences.ai.difficulty;
    this.aiDelayMs = preferences.aiDelayMs;
    this.baseNames = preferences.names;
    this.pieceSet = preferences.pieceSet;
    this.playForWinAiVsAi = preferences.playForWinAiVsAi;
    this.hintMode = preferences.hintMode;
    this.analyzerChoice = preferences.analyzerChoice;
    this.showCoordinates = preferences.showCoordinates;
    this.humanColor = preferences.humanColor;
    this.autoSnapHumanView = preferences.autoSnapHumanView;
    const soundEnabled = SoundManager.loadEnabled();
    this.sound = new SoundManager(soundEnabled);
    this.music = initMusic();
    this.scene = new SceneView(sceneRoot, {
      onPick: (pick) => this.handlePick(pick),
      onCancel: () => this.clearSelection()
    }, this.pieceSet);
    this.scene.setCoordinatesVisible(this.showCoordinates);
    this.initAiWorker();
    this.ui = new GameUI(uiRoot, {
      onRestart: () => this.reset(),
      onSnap: (view) => this.scene.snapView(view),
      onPromotionChoice: (type) => this.resolvePromotion(type),
      onToggleAi: (enabled) => this.setAiEnabled(enabled),
      onModeChange: (mode) => this.setMode(mode),
      onDifficultyChange: (difficulty) => this.setAiDifficulty(difficulty),
      onToggleSound: (enabled) => this.setSoundEnabled(enabled),
      onToggleMusic: (enabled) => this.setMusicEnabled(enabled),
      onMusicVolumeChange: (volume) => this.setMusicVolume(volume),
      onAiDelayChange: (delayMs) => this.setAiDelay(delayMs),
      onStartAiVsAi: () => this.startAiVsAi(),
      onToggleAiVsAiRunning: (running) => this.setAiVsAiRunning(running),
      onPieceSetChange: (pieceSet) => this.setPieceSet(pieceSet),
      onTogglePlayForWin: (enabled) => this.setPlayForWinAiVsAi(enabled),
      onToggleHintMode: (enabled) => this.setHintMode(enabled),
      onHumanColorChange: (color) => this.setHumanColor(color),
      onToggleAutoSnap: (enabled) => this.setAutoSnapHumanView(enabled),
      onShowAiExplanation: () => this.showAiExplanation(),
      onHideAiExplanation: () => this.hideAiExplanation(),
      onExportPgn: () => this.exportPgn(),
      onCopyPgn: () => void this.copyPgn(),
      onExportPlainHistory: () => this.exportPlainHistory(),
      onExportPlainHistoryHtml: () => this.exportPlainHistoryHtml(),
      onCopyPlainHistory: () => this.copyPlainHistory(),
      onAnalyzerChange: (choice) => this.setAnalyzerChoice(choice),
      onAnalyzeGame: () => this.openAnalyzer(),
      onToggleCoordinates: (enabled) => this.setShowCoordinates(enabled),
      onUiStateChange: (state) => this.handleUiStateChange(state)
    }, {
      mode: this.mode,
      aiEnabled: this.mode !== 'hvh',
      aiDifficulty: this.aiDifficulty,
      aiDelayMs: this.aiDelayMs,
      soundEnabled,
      musicEnabled: this.music.getMusicEnabled(),
      musicVolume: this.music.getMusicVolume(),
      pieceSet: this.pieceSet,
      playForWin: this.playForWinAiVsAi,
      hintMode: this.hintMode,
      analyzerChoice: this.analyzerChoice,
      showCoordinates: this.showCoordinates,
      humanColor: this.humanColor,
      autoSnapHumanView: this.autoSnapHumanView
    });
    this.stats = new GameStats();
    this.stats.reset(this.state);
    this.ui.setScores(this.stats.getScores());
    this.ui.setHistoryRows(this.history.getRows());
    this.ui.setGameTime(this.clock.getElapsedMs());
    this.ui.setPgnExportAvailable(false);
    this.ui.setPlainHistoryActionsAvailable(false);
    this.ui.setSummaryHistoryContent('', '', false);
    this.updatePlayerNames();
    this.scene.setUiState(this.ui.getUiState());
    this.syncAiVsAiState();
    this.setupSoundUnlock();
    this.music.setOnUnlockNeeded((needed) => this.ui.setMusicUnlockHint(needed));
    if (this.music.getUnlockNeeded()) {
      this.ui.setMusicUnlockHint(true);
    }
    this.resetPositionHistory();
    this.clearHint();
    this.clearAiExplanation();
    this.startTimerUpdates();

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.clearSelection();
      }
    });
  }

  start(): void {
    void this.scene.ready().then(() => {
      this.scene.snapView(this.getDefaultView());
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
    this.aiVsAiStarted = false;
    this.aiVsAiRunning = false;
    this.aiVsAiPaused = false;
    this.clearHint();
    this.clearAiExplanation();
    this.history.reset();
    this.lastPgnText = null;
    this.lastPlainText = null;
    this.lastPlainHtml = null;
    this.lastPlainView = null;
    this.ui.setHistoryRows(this.history.getRows());
    this.ui.setPgnExportAvailable(false);
    this.ui.setPlainHistoryActionsAvailable(false);
    this.ui.setSummaryHistoryContent('', '', false);
    this.syncAiVsAiState();
    this.ui.hideSummary();
    this.stats.reset(this.state);
    this.ui.setScores(this.stats.getScores());
    this.clock.reset();
    this.ui.setGameTime(this.clock.getElapsedMs());
    this.resetPositionHistory();
    this.sync();
    this.maybeAutoSnapView();
    this.maybeScheduleAiMove();
  }

  private sync(statusOverride?: GameStatus): void {
    this.scene.setState(this.state);

    const status = statusOverride ?? getGameStatus(this.state);
    this.gameOver =
      status.status === 'checkmate' || status.status === 'stalemate' || status.status === 'draw';
    this.lastStatus = status;
    const hasHistory = this.history.hasMoves();
    this.ui.setPgnExportAvailable(this.gameOver && hasHistory);
    this.ui.setPlainHistoryActionsAvailable(this.gameOver && hasHistory);
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
      checkSquare,
      hintMove: this.hintMove
    });

    this.maybeRequestHint();
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
    this.clearHint();
    this.clearAiExplanation();
    this.startClockIfNeeded();
    this.history.addMove(this.state, move);
    const moverColor = this.state.activeColor;
    applyMove(this.state, move);
    this.recordPositionKey();
    this.stats.updateAfterMove(this.state, moverColor);
    this.ui.setScores(this.stats.getScores());
    this.ui.setHistoryRows(this.history.getRows());
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
    this.maybeAutoSnapView();
    this.maybeScheduleAiMove();
  }

  private maybeScheduleAiMove(): void {
    if (this.gameOver) {
      this.ui.setAiThinking(false);
      return;
    }
    if (
      this.mode === 'aivai' &&
      (!this.aiVsAiStarted || this.aiVsAiPaused || !this.aiVsAiRunning)
    ) {
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
    this.aiPendingApplyAt = performance.now() + delayMs;

    const playForWin = this.mode === 'aivai' && this.playForWinAiVsAi;
    const maxTimeMs =
      this.aiDifficulty === 'max'
        ? this.mode === 'aivai'
          ? MAX_THINKING_AI_VS_AI_MS
          : MAX_THINKING_HUMAN_VS_AI_MS
        : undefined;
    const maxDepth = this.aiDifficulty === 'max' ? MAX_THINKING_DEPTH_CAP : undefined;
    const request: AiWorkerRequest = {
      kind: 'move',
      requestId,
      state: this.state,
      color: this.state.activeColor,
      difficulty: this.aiDifficulty,
      seed: this.aiSeed,
      playForWin,
      recentPositions: playForWin ? this.getRecentPositionKeys() : undefined,
      maxTimeMs,
      maxDepth
    };

    this.postAiRequest(request);
  }

  private cancelAiMove(): void {
    this.aiRequestId += 1;
    if (this.aiTimeout !== null) {
      window.clearTimeout(this.aiTimeout);
      this.aiTimeout = null;
    }
    this.aiPendingApplyAt = 0;
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
    this.aiVsAiStarted = false;
    this.aiVsAiRunning = false;
    this.aiVsAiPaused = false;
    this.persistPreferences();
    this.ui.setMode(mode);
    this.updatePlayerNames();
    this.syncAiVsAiState();
    this.clearHint();
    this.clearAiExplanation();
    this.cancelAiMove();
    this.maybeAutoSnapView();
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

  private setPieceSet(pieceSet: PieceSet): void {
    if (this.pieceSet === pieceSet) {
      return;
    }
    this.pieceSet = pieceSet;
    this.persistPreferences();
    this.ui.setPieceSet(pieceSet);
    void this.scene.setPieceSet(pieceSet);
  }

  private setPlayForWinAiVsAi(enabled: boolean): void {
    this.playForWinAiVsAi = enabled;
    this.persistPreferences();
    this.ui.setPlayForWin(enabled);
  }

  private setHintMode(enabled: boolean): void {
    this.hintMode = enabled;
    this.persistPreferences();
    this.ui.setHintMode(enabled);
    this.clearHint();
    this.maybeRequestHint();
  }

  private setHumanColor(color: Color): void {
    if (this.humanColor === color) {
      return;
    }
    this.humanColor = color;
    this.persistPreferences();
    this.ui.setHumanColor(color);
    this.updatePlayerNames();
    this.cancelAiMove();
    this.clearHint();
    this.clearAiExplanation();
    if (this.mode === 'hvai') {
      this.maybeAutoSnapView();
      this.ui.showTemporaryNotice(`You are now ${color === 'w' ? 'White' : 'Black'}.`);
    }
    this.maybeScheduleAiMove();
  }

  private setAutoSnapHumanView(enabled: boolean): void {
    this.autoSnapHumanView = enabled;
    this.persistPreferences();
    this.ui.setAutoSnapEnabled(enabled);
    if (enabled) {
      this.maybeAutoSnapView();
    }
  }

  private setSoundEnabled(enabled: boolean): void {
    this.sound.setEnabled(enabled);
  }

  private setMusicEnabled(enabled: boolean): void {
    this.music.setMusicEnabled(enabled);
    this.ui.setMusicEnabled(enabled);
  }

  private setMusicVolume(volume: number): void {
    this.music.setMusicVolume(volume);
  }

  private setAnalyzerChoice(choice: AnalyzerChoice): void {
    this.analyzerChoice = choice;
    this.persistPreferences();
    this.ui.setAnalyzerChoice(choice);
  }

  private setShowCoordinates(enabled: boolean): void {
    this.showCoordinates = enabled;
    this.persistPreferences();
    this.ui.setCoordinatesEnabled(enabled);
    this.scene.setCoordinatesVisible(enabled);
  }

  private openAnalyzer(): void {
    if (typeof window === 'undefined') {
      return;
    }
    const option = ANALYZER_OPTIONS[this.analyzerChoice] ?? ANALYZER_OPTIONS.buddy;
    window.open(option.url, '_blank', 'noopener,noreferrer');
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
      if (this.humanColor === 'w') {
        this.ui.setPlayerNames({
          white: 'You',
          black: `AI (${AI_LABELS[this.aiDifficulty]})`
        });
      } else {
        this.ui.setPlayerNames({
          white: `AI (${AI_LABELS[this.aiDifficulty]})`,
          black: 'You'
        });
      }
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
      return color !== this.humanColor;
    }
    return true;
  }

  private getAiDelayMs(): number {
    return this.mode === 'aivai' ? this.aiDelayMs : HUMAN_VS_AI_DELAY_MS;
  }

  private getDefaultView(): 'white' | 'black' {
    return this.mode === 'hvai' && this.humanColor === 'b' ? 'black' : 'white';
  }

  private maybeAutoSnapView(): void {
    if (this.mode !== 'hvai' || !this.autoSnapHumanView) {
      return;
    }
    this.scene.snapView(this.getDefaultView());
  }

  private startAiVsAi(): void {
    if (this.mode !== 'aivai') {
      return;
    }
    if (this.gameOver) {
      return;
    }
    this.aiVsAiStarted = true;
    this.aiVsAiRunning = true;
    this.aiVsAiPaused = false;
    this.clock.start();
    this.ui.setGameTime(this.clock.getElapsedMs());
    this.syncAiVsAiState();
    this.maybeScheduleAiMove();
  }

  private setAiVsAiRunning(running: boolean): void {
    if (this.mode !== 'aivai') {
      return;
    }
    if (!this.aiVsAiStarted) {
      return;
    }
    if (running && this.gameOver) {
      return;
    }
    this.aiVsAiRunning = running;
    this.aiVsAiPaused = !running;
    this.syncAiVsAiState();
    if (!running) {
      this.cancelAiMove();
      this.clock.pause();
      this.ui.setGameTime(this.clock.getElapsedMs());
      return;
    }
    this.clock.resume();
    this.ui.setGameTime(this.clock.getElapsedMs());
    this.maybeScheduleAiMove();
  }

  private syncAiVsAiState(): void {
    if (this.mode !== 'aivai') {
      this.ui.setAiVsAiState({ started: false, running: false });
      return;
    }
    this.ui.setAiVsAiState({
      started: this.aiVsAiStarted,
      running: this.aiVsAiRunning
    });
  }

  private maybeShowSummary(status: GameStatus): void {
    if (this.summaryShown) {
      return;
    }
    if (
      status.status !== 'checkmate' &&
      status.status !== 'stalemate' &&
      status.status !== 'draw'
    ) {
      return;
    }
    this.clearHint();
    this.clearAiExplanation();
    this.clock.stop();
    this.ui.setGameTime(this.clock.getElapsedMs());
    this.prepareHistoryExports(status);
    if (this.mode === 'aivai') {
      this.aiVsAiStarted = false;
      this.aiVsAiRunning = false;
      this.aiVsAiPaused = false;
      this.syncAiVsAiState();
      this.cancelAiMove();
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
    let pieceSet: PieceSet = 'scifi';
    let playForWinAiVsAi = true;
    let hintMode = false;
    let analyzerChoice: AnalyzerChoice = DEFAULT_ANALYZER;
    let showCoordinates = true;
    let humanColor: Color = 'w';
    let autoSnapHumanView = true;

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

      const rawPieceSet = storage.getItem(STORAGE_KEYS.pieceSet);
      if (rawPieceSet === 'scifi' || rawPieceSet === 'standard') {
        pieceSet = rawPieceSet;
      }

      const rawPlayForWin = storage.getItem(STORAGE_KEYS.playForWinAiVsAi);
      if (rawPlayForWin !== null) {
        playForWinAiVsAi = rawPlayForWin === 'true';
      }

      const rawHintMode = storage.getItem(STORAGE_KEYS.hintMode);
      if (rawHintMode !== null) {
        hintMode = rawHintMode === 'true';
      }

      const rawAnalyzer = storage.getItem(STORAGE_KEYS.analyzerChoice);
      if (rawAnalyzer && rawAnalyzer in ANALYZER_OPTIONS) {
        analyzerChoice = rawAnalyzer as AnalyzerChoice;
      }

      const rawCoords = storage.getItem(STORAGE_KEYS.showCoordinates);
      if (rawCoords !== null) {
        showCoordinates = rawCoords === 'true';
      }

      const rawHumanColor = storage.getItem(STORAGE_KEYS.humanColor);
      if (rawHumanColor === 'w' || rawHumanColor === 'b') {
        humanColor = rawHumanColor;
      }

      const rawAutoSnap = storage.getItem(STORAGE_KEYS.autoSnapHumanView);
      if (rawAutoSnap !== null) {
        autoSnapHumanView = rawAutoSnap === 'true';
      }

      storage.setItem(STORAGE_KEYS.names, JSON.stringify(names));
      storage.setItem(STORAGE_KEYS.ai, JSON.stringify(ai));
      storage.setItem(STORAGE_KEYS.mode, mode);
      storage.setItem(STORAGE_KEYS.aiDelay, aiDelayMs.toString());
      storage.setItem(STORAGE_KEYS.pieceSet, pieceSet);
      storage.setItem(STORAGE_KEYS.playForWinAiVsAi, playForWinAiVsAi.toString());
      storage.setItem(STORAGE_KEYS.hintMode, hintMode.toString());
      storage.setItem(STORAGE_KEYS.analyzerChoice, analyzerChoice);
      storage.setItem(STORAGE_KEYS.showCoordinates, showCoordinates.toString());
      storage.setItem(STORAGE_KEYS.humanColor, humanColor);
      storage.setItem(STORAGE_KEYS.autoSnapHumanView, autoSnapHumanView.toString());
    }

    return {
      names,
      ai,
      mode,
      aiDelayMs,
      pieceSet,
      playForWinAiVsAi,
      hintMode,
      analyzerChoice,
      showCoordinates,
      humanColor,
      autoSnapHumanView
    };
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
    storage.setItem(STORAGE_KEYS.pieceSet, this.pieceSet);
    storage.setItem(STORAGE_KEYS.playForWinAiVsAi, this.playForWinAiVsAi.toString());
    storage.setItem(STORAGE_KEYS.hintMode, this.hintMode.toString());
    storage.setItem(STORAGE_KEYS.analyzerChoice, this.analyzerChoice);
    storage.setItem(STORAGE_KEYS.showCoordinates, this.showCoordinates.toString());
    storage.setItem(STORAGE_KEYS.humanColor, this.humanColor);
    storage.setItem(STORAGE_KEYS.autoSnapHumanView, this.autoSnapHumanView.toString());
  }

  private resetPositionHistory(): void {
    this.recentPositions = [getPositionKey(this.state)];
  }

  private recordPositionKey(): void {
    this.recentPositions.push(getPositionKey(this.state));
    const max = 10;
    if (this.recentPositions.length > max) {
      this.recentPositions.splice(0, this.recentPositions.length - max);
    }
  }

  private getRecentPositionKeys(): string[] {
    return [...this.recentPositions];
  }

  private initAiWorker(): void {
    if (typeof Worker === 'undefined') {
      return;
    }
    this.aiWorker = new Worker(new URL('./ai/aiWorker.ts', import.meta.url), {
      type: 'module'
    });
    this.aiWorker.onmessage = (event: MessageEvent<AiWorkerResponse>) => {
      this.handleAiWorkerMessage(event.data);
    };
    this.explainWorker = new Worker(new URL('./ai/aiWorker.ts', import.meta.url), {
      type: 'module'
    });
    this.explainWorker.onmessage = (event: MessageEvent<AiWorkerResponse>) => {
      this.handleAiWorkerMessage(event.data);
    };
  }

  private postAiRequest(request: AiWorkerRequest): void {
    const worker = selectWorkerForRequest(request, this.aiWorker, this.explainWorker);
    if (worker) {
      worker.postMessage(request);
      return;
    }
    let response: AiWorkerResponse;
    if (request.kind === 'hint') {
      response = {
        kind: 'hint',
        requestId: request.requestId,
        positionKey: request.positionKey,
        move: chooseMove(request.state, {
          color: request.color,
          difficulty: 'easy',
          depthOverride: request.depthOverride,
          seed: request.seed
        })
      };
    } else if (request.kind === 'explain') {
      response = {
        kind: 'explain',
        requestId: request.requestId,
        positionKey: request.positionKey,
        moveSignature: request.moveSignature,
        explanation: explainMove(request.state, request.move, request.options)
      };
    } else {
      response = {
        kind: 'move',
        requestId: request.requestId,
        move: chooseMove(request.state, {
          color: request.color,
          difficulty: request.difficulty,
          seed: request.seed,
          playForWin: request.playForWin,
          recentPositions: request.recentPositions,
          depthOverride: request.depthOverride,
          maxTimeMs: request.maxTimeMs,
          maxDepth: request.maxDepth
        })
      };
    }
    this.handleAiWorkerMessage(response);
  }

  private handleAiWorkerMessage(response: AiWorkerResponse): void {
    if (response.kind === 'hint') {
      this.handleHintWorkerResponse(response);
      return;
    }
    if (response.kind === 'explain') {
      this.handleExplainWorkerResponse(response);
      return;
    }

    if (
      !shouldApplyAiResponse({
        requestId: response.requestId,
        currentRequestId: this.aiRequestId,
        gameOver: this.gameOver,
        mode: this.mode,
        aiVsAiStarted: this.aiVsAiStarted,
        aiVsAiRunning: this.aiVsAiRunning,
        aiVsAiPaused: this.aiVsAiPaused,
        isAiControlled: this.isAiControlled(this.state.activeColor)
      })
    ) {
      return;
    }

    if (!response.move) {
      this.ui.setAiThinking(false);
      this.sync();
      return;
    }

    const applyMove = () => {
      if (
        !shouldApplyAiResponse({
          requestId: response.requestId,
          currentRequestId: this.aiRequestId,
          gameOver: this.gameOver,
          mode: this.mode,
          aiVsAiStarted: this.aiVsAiStarted,
          aiVsAiRunning: this.aiVsAiRunning,
          aiVsAiPaused: this.aiVsAiPaused,
          isAiControlled: this.isAiControlled(this.state.activeColor)
        })
      ) {
        return;
      }
      const preMoveState = this.cloneState(this.state);
      const recentPositions = this.getRecentPositionKeys();
      const playForWin = this.mode === 'aivai' && this.playForWinAiVsAi;
      this.ui.setAiThinking(false);
      this.applyAndAdvance(response.move);
      this.setLastAiMove(preMoveState, response.move, {
        playForWin,
        recentPositions: playForWin ? recentPositions : undefined
      });
    };

    const remaining = this.aiPendingApplyAt - performance.now();
    if (remaining > 5) {
      this.aiTimeout = window.setTimeout(() => {
        this.aiTimeout = null;
        applyMove();
      }, remaining);
      return;
    }

    applyMove();
  }

  private handleHintWorkerResponse(response: AiWorkerResponse): void {
    if (response.kind !== 'hint') {
      return;
    }
    const currentKey = getPositionKey(this.state);
    if (
      !shouldApplyHintResponse({
        requestId: response.requestId,
        currentRequestId: this.hintRequestId,
        positionKey: response.positionKey,
        currentPositionKey: currentKey,
        mode: this.mode,
        hintMode: this.hintMode,
        activeColor: this.state.activeColor,
        humanColor: this.humanColor,
        gameOver: this.gameOver
      })
    ) {
      return;
    }

    this.hintMove = response.move;
    this.hintPositionKey = response.positionKey;
    this.sync();
  }

  private handleExplainWorkerResponse(response: AiWorkerResponse): void {
    if (response.kind !== 'explain') {
      return;
    }
    if (!this.lastAiPositionKey || !this.lastAiMoveSignature) {
      return;
    }
    if (
      !shouldApplyExplainResponse({
        requestId: response.requestId,
        currentRequestId: this.explainRequestId,
        positionKey: response.positionKey,
        currentPositionKey: this.lastAiPositionKey,
        moveSignature: response.moveSignature,
        currentMoveSignature: this.lastAiMoveSignature,
        gameOver: this.gameOver
      })
    ) {
      return;
    }

    this.explainLoading = false;
    this.clearExplainTimeout();
    this.ui.setAiExplanationLoadingMessage('Analyzing...');
    this.lastAiExplanation = response.explanation;
    const cacheKey = this.getExplainCacheKey(
      response.positionKey,
      response.moveSignature
    );
    this.explainCache.set(cacheKey, response.explanation);
    this.ui.updateAiExplanation(response.explanation, false);
  }

  private maybeRequestHint(): void {
    const key = getPositionKey(this.state);
    if (
      !shouldRequestHint({
        mode: this.mode,
        hintMode: this.hintMode,
        activeColor: this.state.activeColor,
        humanColor: this.humanColor,
        gameOver: this.gameOver,
        pendingPromotion: Boolean(this.pendingPromotion)
      })
    ) {
      if (this.hintMove || this.hintPositionKey) {
        this.clearHint();
      }
      return;
    }

    if (this.hintPositionKey === key) {
      return;
    }

    this.hintRequestId += 1;
    this.hintPositionKey = key;

    const request: AiWorkerRequest = {
      kind: 'hint',
      requestId: this.hintRequestId,
      positionKey: key,
      state: this.state,
      color: this.humanColor,
      depthOverride: 2,
      seed: this.aiSeed
    };
    this.postAiRequest(request);
  }

  private clearHint(): void {
    this.hintMove = null;
    this.hintPositionKey = null;
    this.hintRequestId += 1;
    this.scene.setHintMove(null);
  }

  private startClockIfNeeded(): void {
    if (this.clock.hasStarted()) {
      return;
    }
    if (this.mode === 'aivai' && !this.aiVsAiStarted) {
      return;
    }
    this.clock.start();
    this.ui.setGameTime(this.clock.getElapsedMs());
  }

  private startTimerUpdates(): void {
    if (this.timerInterval !== null) {
      return;
    }
    this.timerInterval = window.setInterval(() => {
      this.ui.setGameTime(this.clock.getElapsedMs());
    }, 1000);
  }

  private showAiExplanation(): void {
    if (!this.lastAiMove) {
      return;
    }
    if (
      shouldPauseForExplanation({
        mode: this.mode,
        aiVsAiStarted: this.aiVsAiStarted,
        aiVsAiRunning: this.aiVsAiRunning,
        gameOver: this.gameOver
      })
    ) {
      this.explainPaused = true;
      this.setAiVsAiRunning(false);
    }
    const loading = this.explainLoading && !this.lastAiExplanation;
    if (loading) {
      this.startExplainTimeout();
    } else {
      this.clearExplainTimeout();
    }
    this.ui.showAiExplanation(this.lastAiExplanation, loading);
  }

  private hideAiExplanation(): void {
    this.ui.hideAiExplanation();
    this.clearExplainTimeout();
    this.ui.setAiExplanationLoadingMessage('Analyzing...');
    if (!this.explainPaused) {
      return;
    }
    this.explainPaused = false;
    if (
      shouldResumeAfterExplanation({
        mode: this.mode,
        aiVsAiStarted: this.aiVsAiStarted,
        gameOver: this.gameOver
      })
    ) {
      this.setAiVsAiRunning(true);
    }
  }

  private exportPgn(): void {
    const status = this.lastStatus ?? getGameStatus(this.state);
    const pgnText = this.getPgnText(status);
    if (!pgnText) {
      return;
    }
    const timestamp = new Date();
    const filename = `chess-game-${formatStamp(timestamp)}.pgn`;
    downloadTextFile(pgnText, filename, 'application/x-chess-pgn');
  }

  private async copyPgn(): Promise<void> {
    const status = this.lastStatus ?? getGameStatus(this.state);
    const pgnText = this.getPgnText(status);
    if (!pgnText) {
      return;
    }
    const success = await copyToClipboard(pgnText);
    if (success) {
      this.ui.showPgnCopyStatus('Copied!');
      return;
    }
    this.ui.showPgnCopyStatus('Copy failed - select and copy manually.', true);
  }

  private exportPlainHistory(): void {
    const status = this.lastStatus ?? getGameStatus(this.state);
    const text = this.getPlainHistoryText(status);
    if (!text) {
      return;
    }
    const timestamp = new Date();
    const filename = `game-history-plain-english-${formatStamp(timestamp)}.txt`;
    downloadTextFile(text, filename, 'text/plain');
  }

  private exportPlainHistoryHtml(): void {
    const status = this.lastStatus ?? getGameStatus(this.state);
    const html = this.getPlainHistoryHtml(status);
    if (!html) {
      return;
    }
    const timestamp = new Date();
    const filename = `game-history-plain-english-${formatStamp(timestamp)}.html`;
    downloadTextFile(html, filename, 'text/html');
  }

  private copyPlainHistory(): void {
    const status = this.lastStatus ?? getGameStatus(this.state);
    const text = this.getPlainHistoryText(status);
    if (!text) {
      return;
    }
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }

  private setLastAiMove(
    state: GameState,
    move: Move,
    options: AiExplainOptions
  ): void {
    this.lastAiMove = move;
    const positionKey = getPositionKey(state);
    const moveSignature = this.getMoveSignature(move);
    this.lastAiPositionKey = positionKey;
    this.lastAiMoveSignature = moveSignature;
    this.ui.setAiExplanationAvailable(true);

    const cacheKey = this.getExplainCacheKey(positionKey, moveSignature);
    const cached = this.explainCache.get(cacheKey);
    if (cached) {
      this.lastAiExplanation = cached;
      this.explainLoading = false;
      this.ui.updateAiExplanation(cached, false);
      return;
    }

    this.lastAiExplanation = null;
    this.explainLoading = true;
    this.requestAiExplanation(state, move, positionKey, moveSignature, options);
  }

  private requestAiExplanation(
    state: GameState,
    move: Move,
    positionKey: string,
    moveSignature: string,
    options: AiExplainOptions
  ): void {
    this.explainRequestId += 1;
    const request: AiWorkerRequest = {
      kind: 'explain',
      requestId: this.explainRequestId,
      positionKey,
      moveSignature,
      state,
      move,
      options
    };
    this.postAiRequest(request);
  }

  private clearAiExplanation(): void {
    this.lastAiMove = null;
    this.lastAiPositionKey = null;
    this.lastAiMoveSignature = null;
    this.lastAiExplanation = null;
    this.explainLoading = false;
    this.explainPaused = false;
    this.clearExplainTimeout();
    this.ui.setAiExplanationLoadingMessage('Analyzing...');
    this.explainRequestId += 1;
    this.ui.setAiExplanationAvailable(false);
    this.ui.hideAiExplanation();
  }

  private getExplainCacheKey(positionKey: string, moveSignature: string): string {
    return `${positionKey}|${moveSignature}`;
  }

  private startExplainTimeout(): void {
    this.clearExplainTimeout();
    this.ui.setAiExplanationLoadingMessage('Analyzing...');
    this.explainTimeoutId = window.setTimeout(() => {
      this.explainTimeoutId = null;
      if (this.explainLoading && !this.lastAiExplanation) {
        this.ui.setAiExplanationLoadingMessage(
          'Analysis is taking longer - close to resume.'
        );
        this.ui.updateAiExplanation(null, true);
      }
    }, EXPLAIN_TIMEOUT_MS);
  }

  private clearExplainTimeout(): void {
    if (this.explainTimeoutId === null) {
      return;
    }
    window.clearTimeout(this.explainTimeoutId);
    this.explainTimeoutId = null;
  }

  private getMoveSignature(move: Move): string {
    const promo = move.promotion ? `=${move.promotion}` : '';
    const castle = move.isCastle ? 'c' : '';
    const ep = move.isEnPassant ? 'e' : '';
    return `${move.from.file}${move.from.rank}-${move.to.file}${move.to.rank}${promo}${castle}${ep}`;
  }

  private getDisplayNames(): { white: string; black: string } {
    if (this.mode === 'hvh') {
      return { ...this.baseNames };
    }
    if (this.mode === 'hvai') {
      if (this.humanColor === 'w') {
        return {
          white: 'You',
          black: `AI (${AI_LABELS[this.aiDifficulty]})`
        };
      }
      return {
        white: `AI (${AI_LABELS[this.aiDifficulty]})`,
        black: 'You'
      };
    }
    const label = `AI (${AI_LABELS[this.aiDifficulty]})`;
    return { white: label, black: label };
  }

  private prepareHistoryExports(status: GameStatus): void {
    const pgnText = this.getPgnText(status);
    const plainText = this.getPlainHistoryText(status);
    if (!pgnText || !plainText) {
      this.lastPgnText = null;
      this.lastPlainText = null;
      this.lastPlainHtml = null;
      this.lastPlainView = null;
      this.ui.setSummaryHistoryContent('', '', false);
      return;
    }
    const plainView = buildPlainEnglishLines(this.history.getMoves()).join('\n');
    this.lastPlainView = plainView;
    this.ui.setSummaryHistoryContent(pgnText, plainView, true);
  }

  private getPgnText(status: GameStatus): string | null {
    if (!this.history.hasMoves()) {
      return null;
    }
    if (
      status.status !== 'checkmate' &&
      status.status !== 'stalemate' &&
      status.status !== 'draw'
    ) {
      return null;
    }
    if (this.lastPgnText) {
      return this.lastPgnText;
    }
    const result = getPgnResult(status);
    const names = this.getDisplayNames();
    const site =
      typeof window !== 'undefined' && window.location
        ? window.location.href
        : 'Local';
    const moves = this.toPgnMoves();
    const pgn = buildPgn({
      moves,
      white: names.white,
      black: names.black,
      result,
      site,
      date: new Date()
    });
    this.lastPgnText = pgn;
    return pgn;
  }

  private getPlainHistoryText(status: GameStatus): string | null {
    if (!this.history.hasMoves()) {
      return null;
    }
    if (
      status.status !== 'checkmate' &&
      status.status !== 'stalemate' &&
      status.status !== 'draw'
    ) {
      return null;
    }
    if (this.lastPlainText) {
      return this.lastPlainText;
    }
    const result = getPgnResult(status);
    const sanLine = buildSanLine(this.toPgnMoves(), result);
    const durationLabel = formatDuration(this.clock.getElapsedMs());
    const dateLabel = new Date().toLocaleString();
    const text = buildPlainEnglishText({
      moves: this.history.getMoves(),
      dateLabel,
      durationLabel,
      sanLine
    });
    this.lastPlainText = text;
    return text;
  }

  private getPlainHistoryHtml(status: GameStatus): string | null {
    if (!this.history.hasMoves()) {
      return null;
    }
    if (
      status.status !== 'checkmate' &&
      status.status !== 'stalemate' &&
      status.status !== 'draw'
    ) {
      return null;
    }
    if (this.lastPlainHtml) {
      return this.lastPlainHtml;
    }
    const result = getPgnResult(status);
    const sanLine = buildSanLine(this.toPgnMoves(), result);
    const durationLabel = formatDuration(this.clock.getElapsedMs());
    const dateLabel = new Date().toLocaleString();
    const html = buildPlainEnglishHtml({
      moves: this.history.getMoves(),
      dateLabel,
      durationLabel,
      sanLine
    });
    this.lastPlainHtml = html;
    return html;
  }

  private toPgnMoves(): PgnMove[] {
    return this.history.getMoves().map((move) => ({
      moveNumber: move.moveNumber,
      color: move.color,
      san: move.san
    }));
  }

  private cloneState(state: GameState): GameState {
    const board = state.board.map((row) => row.slice());
    const pieces = new Map<number, Piece>();
    for (const [id, piece] of state.pieces) {
      pieces.set(id, { ...piece });
    }
    return {
      board,
      pieces,
      activeColor: state.activeColor,
      castlingRights: { ...state.castlingRights },
      enPassantTarget: state.enPassantTarget ? { ...state.enPassantTarget } : null,
      halfmoveClock: state.halfmoveClock,
      fullmoveNumber: state.fullmoveNumber,
      lastMove: state.lastMove ? { ...state.lastMove } : null
    };
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

function getPgnResult(status: GameStatus): string {
  if (status.status === 'checkmate') {
    return status.winner === 'w' ? '1-0' : '0-1';
  }
  if (status.status === 'stalemate' || status.status === 'draw') {
    return '1/2-1/2';
  }
  return '*';
}

function formatStamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
