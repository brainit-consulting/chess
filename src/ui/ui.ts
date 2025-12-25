import type { AiDifficulty } from '../ai/ai';
import type { AiExplainResult } from '../ai/aiWorkerTypes';
import type { HistoryRow } from '../history/gameHistory';
import { GameStatus, Color } from '../rules';
import { GameSummary } from '../gameSummary';
import { GameMode, PieceSet, SnapView } from '../types';
import { PieceType } from '../rules';

const PLAYER_GUIDE_URL = `${import.meta.env.BASE_URL}player-user-guide.md`;
const ANALYSIS_URL = 'https://chessanalysis.pro/';
const LIVE_URL = 'https://brainit-consulting.github.io/chess/';
const APP_VERSION = 'v1.1.27';

export type UiState = {
  visible: boolean;
  collapsed: boolean;
  historyVisible: boolean;
};

type UIHandlers = {
  onRestart: () => void;
  onSnap: (view: SnapView) => void;
  onPromotionChoice: (type: PieceType) => void;
  onToggleAi: (enabled: boolean) => void;
  onModeChange: (mode: GameMode) => void;
  onDifficultyChange: (difficulty: AiDifficulty) => void;
  onToggleSound: (enabled: boolean) => void;
  onToggleMusic: (enabled: boolean) => void;
  onMusicVolumeChange: (volume: number) => void;
  onAiDelayChange: (delayMs: number) => void;
  onStartAiVsAi: () => void;
  onToggleAiVsAiRunning: (running: boolean) => void;
  onPieceSetChange: (pieceSet: PieceSet) => void;
  onTogglePlayForWin: (enabled: boolean) => void;
  onToggleHintMode: (enabled: boolean) => void;
  onShowAiExplanation: () => void;
  onHideAiExplanation: () => void;
  onExportPgn: () => void;
  onCopyPgn: () => void;
  onAnalyzeGame: () => void;
  onExportPlainHistory: () => void;
  onExportPlainHistoryHtml: () => void;
  onCopyPlainHistory: () => void;
  onUiStateChange: (state: UiState) => void;
};

type UIOptions = {
  mode?: GameMode;
  aiEnabled?: boolean;
  aiDifficulty?: AiDifficulty;
  aiDelayMs?: number;
  soundEnabled?: boolean;
  musicEnabled?: boolean;
  musicVolume?: number;
  pieceSet?: PieceSet;
  playForWin?: boolean;
  hintMode?: boolean;
};

const UI_STATE_KEY = 'chess.uiState';

export class GameUI {
  private root: HTMLElement;
  private hud: HTMLDivElement;
  private panel: HTMLDivElement;
  private turnEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private noticeEl: HTMLDivElement;
  private aiStatusEl: HTMLDivElement;
  private aiStatusText: HTMLSpanElement;
  private aiStatusDots: HTMLSpanElement;
  private explainButton: HTMLButtonElement;
  private historyPanel: HTMLDivElement;
  private historyListEl: HTMLDivElement;
  private historyTimerEl: HTMLDivElement;
  private historyExportButton: HTMLButtonElement;
  private historyCopyButton: HTMLButtonElement;
  private historyPlainExportButton: HTMLButtonElement;
  private historyPlainHtmlExportButton: HTMLButtonElement;
  private historyPlainCopyButton: HTMLButtonElement;
  private historyHideButton: HTMLButtonElement;
  private historyShowButton: HTMLButtonElement;
  private historyCopyStatusEl: HTMLDivElement;
  private historyAutoScroll = true;
  private modal: HTMLDivElement;
  private summaryModal: HTMLDivElement;
  private summaryTitleEl: HTMLHeadingElement;
  private summaryOutcomeEl: HTMLParagraphElement;
  private summaryMaterialEl: HTMLParagraphElement;
  private summaryDetailEl: HTMLParagraphElement;
  private summaryExportButton: HTMLButtonElement;
  private summaryCopyButton: HTMLButtonElement;
  private summaryPlainHtmlExportButton: HTMLButtonElement;
  private summaryAnalyzeButton: HTMLButtonElement;
  private summaryCopyStatusEl: HTMLDivElement;
  private summaryHistoryTabs: HTMLDivElement;
  private summaryHistoryPgnButton: HTMLButtonElement;
  private summaryHistoryPlainButton: HTMLButtonElement;
  private summaryHistoryText: HTMLPreElement;
  private summaryHistoryPgn = '';
  private summaryHistoryPlain = '';
  private summaryHistoryView: 'pgn' | 'plain' = 'pgn';
  private explainModal: HTMLDivElement;
  private explainMoveEl: HTMLParagraphElement;
  private explainSummaryEl: HTMLParagraphElement;
  private explainListEl: HTMLUListElement;
  private explainLoadingEl: HTMLParagraphElement;
  private explainLoadingMessage = 'Analyzing...';
  private aiVsAiRow: HTMLDivElement;
  private aiVsAiStartButton: HTMLButtonElement;
  private aiVsAiPauseButton: HTMLButtonElement;
  private aiVsAiResumeButton: HTMLButtonElement;
  private aiThinking = false;
  private aiThinkingColor?: Color;
  private aiVsAiReady = false;
  private aiVsAiStarted = false;
  private aiVsAiRunning = false;
  private modeButtons: Record<GameMode, HTMLButtonElement>;
  private delayRow: HTMLDivElement;
  private delayValueEl: HTMLSpanElement;
  private delayInput: HTMLInputElement;
  private mode: GameMode;
  private aiToggle: HTMLInputElement;
  private difficultySelect: HTMLSelectElement;
  private pieceSetSelect: HTMLSelectElement;
  private playForWinRow: HTMLDivElement;
  private playForWinToggle: HTMLInputElement;
  private hintRow: HTMLDivElement;
  private hintToggle: HTMLInputElement;
  private soundToggle: HTMLInputElement;
  private musicToggle: HTMLInputElement;
  private musicVolumeRow: HTMLDivElement;
  private musicVolumeValueEl: HTMLSpanElement;
  private musicVolumeInput: HTMLInputElement;
  private musicHintEl: HTMLDivElement;
  private nameWhiteEl: HTMLSpanElement;
  private nameBlackEl: HTMLSpanElement;
  private scoreWhiteEl: HTMLSpanElement;
  private scoreBlackEl: HTMLSpanElement;
  private hideButton: HTMLButtonElement;
  private showButton: HTMLButtonElement;
  private collapseButton: HTMLButtonElement;
  private helpButton: HTMLButtonElement;
  private expandButton: HTMLButtonElement;
  private handlers: UIHandlers;
  private uiState: UiState;
  private pgnCopyTimer: number | null = null;

  constructor(root: HTMLElement, handlers: UIHandlers, options: UIOptions = {}) {
    this.root = root;
    this.handlers = handlers;

    root.innerHTML = '';

    this.hud = document.createElement('div');
    this.hud.className = 'hud-stack';

    this.panel = document.createElement('div');
    this.panel.className = 'panel ui-panel';

    this.uiState = this.loadUiState();

    const header = document.createElement('div');
    header.className = 'panel-header';

    const title = document.createElement('h1');
    title.className = 'expand-only';
    title.textContent = '3D Chess';

    const headerActions = document.createElement('div');
    headerActions.className = 'panel-actions expand-only';

    this.helpButton = this.makeButton('ⓘ', () => {
      window.open(PLAYER_GUIDE_URL, '_blank', 'noopener');
    });
    this.helpButton.classList.add('ghost', 'info-button');
    this.helpButton.setAttribute('aria-label', 'Player Guide');
    this.helpButton.title = 'Player Guide';

    this.hideButton = this.makeButton('Hide UI', () => this.setUiVisible(false));
    this.hideButton.classList.add('ghost');

    this.collapseButton = this.makeButton('Collapse', () => this.setUiCollapsed(true));
    this.collapseButton.classList.add('ghost');

    headerActions.append(this.helpButton, this.collapseButton, this.hideButton);
    header.append(title, headerActions);

    this.turnEl = document.createElement('div');
    this.turnEl.className = 'turn';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'status expand-only';

    this.noticeEl = document.createElement('div');
    this.noticeEl.className = 'notice expand-only';

    this.aiStatusEl = document.createElement('div');
    this.aiStatusEl.className = 'ai-status expand-only';
    this.aiStatusText = document.createElement('span');
    this.aiStatusDots = document.createElement('span');
    this.aiStatusDots.className = 'ai-thinking-dots';
    this.explainButton = this.makeButton('Why this move?', () =>
      this.handlers.onShowAiExplanation()
    );
    this.explainButton.classList.add('ghost', 'ai-explain-button');
    this.explainButton.disabled = true;
    this.explainButton.title = 'Why this move?';
    this.aiStatusEl.append(this.aiStatusText, this.aiStatusDots, this.explainButton);

    const modeTitle = document.createElement('div');
    modeTitle.className = 'section-title expand-only';
    modeTitle.textContent = 'Mode';

    const modeRow = document.createElement('div');
    modeRow.className = 'segmented control-row expand-only';

    this.modeButtons = {
      hvh: this.makeModeButton('Human vs Human', 'hvh'),
      hvai: this.makeModeButton('Human vs AI', 'hvai'),
      aivai: this.makeModeButton('AI vs AI', 'aivai')
    };

    modeRow.append(
      this.modeButtons.hvh,
      this.modeButtons.hvai,
      this.modeButtons.aivai
    );

    const aiRow = document.createElement('div');
    aiRow.className = 'control-row expand-only';

    const aiLabel = document.createElement('label');
    aiLabel.className = 'toggle';

    this.aiToggle = document.createElement('input');
    this.aiToggle.type = 'checkbox';
    const initialAiEnabled = options.aiEnabled ?? true;
    const initialMode = options.mode ?? (initialAiEnabled ? 'hvai' : 'hvh');
    const initialDifficulty = options.aiDifficulty ?? 'medium';
    const initialDelay = options.aiDelayMs ?? 700;
    const initialSoundEnabled = options.soundEnabled ?? true;
    const initialMusicEnabled = options.musicEnabled ?? false;
    const initialMusicVolume = options.musicVolume ?? 0.2;
    const initialPieceSet = options.pieceSet ?? 'scifi';
    const initialPlayForWin = options.playForWin ?? true;
    const initialHintMode = options.hintMode ?? false;
    this.aiToggle.checked = initialAiEnabled;
    this.aiToggle.addEventListener('change', () => {
      const enabled = this.aiToggle.checked;
      this.difficultySelect.disabled = !enabled;
      this.handlers.onToggleAi(enabled);
    });

    const aiText = document.createElement('span');
    aiText.textContent = 'Play vs AI';
    aiLabel.append(this.aiToggle, aiText);

    this.difficultySelect = document.createElement('select');
    this.difficultySelect.innerHTML = `
      <option value="easy">Easy</option>
      <option value="medium">Medium</option>
      <option value="hard">Hard</option>
    `;
    this.difficultySelect.value = initialDifficulty;
    this.difficultySelect.disabled = !initialAiEnabled;
    this.difficultySelect.addEventListener('change', () => {
      this.handlers.onDifficultyChange(this.difficultySelect.value as AiDifficulty);
    });

    aiRow.append(aiLabel, this.difficultySelect);

    const pieceSetTitle = document.createElement('div');
    pieceSetTitle.className = 'section-title expand-only';
    pieceSetTitle.textContent = 'Piece Set';

    const pieceSetRow = document.createElement('div');
    pieceSetRow.className = 'control-row expand-only';

    this.pieceSetSelect = document.createElement('select');
    this.pieceSetSelect.innerHTML = `
      <option value="scifi">Sci-Fi</option>
      <option value="standard">Standard</option>
    `;
    this.pieceSetSelect.value = initialPieceSet;
    this.pieceSetSelect.addEventListener('change', () => {
      this.handlers.onPieceSetChange(this.pieceSetSelect.value as PieceSet);
    });
    pieceSetRow.append(this.pieceSetSelect);

    this.delayRow = document.createElement('div');
    this.delayRow.className = 'control-row expand-only';

    const delayLabel = document.createElement('span');
    delayLabel.className = 'stat-label';
    delayLabel.textContent = 'AI Move Delay';

    this.delayValueEl = document.createElement('span');
    this.delayValueEl.className = 'stat-value';

    this.delayInput = document.createElement('input');
    this.delayInput.type = 'range';
    this.delayInput.min = '400';
    this.delayInput.max = '1200';
    this.delayInput.step = '50';
    this.delayInput.value = initialDelay.toString();
    this.delayInput.addEventListener('input', () => {
      const value = Number(this.delayInput.value);
      this.setAiDelay(value);
      this.handlers.onAiDelayChange(value);
    });

    const delayRowMeta = document.createElement('div');
    delayRowMeta.className = 'stat-row';
    delayRowMeta.append(delayLabel, this.delayValueEl);

    const delayStack = document.createElement('div');
    delayStack.className = 'delay-stack';
    delayStack.append(delayRowMeta, this.delayInput);
    this.delayRow.append(delayStack);

    this.aiVsAiRow = document.createElement('div');
    this.aiVsAiRow.className = 'control-row expand-only';

    this.aiVsAiStartButton = this.makeButton('Start Game', () =>
      this.handlers.onStartAiVsAi()
    );

    this.aiVsAiPauseButton = this.makeButton('Pause', () =>
      this.handlers.onToggleAiVsAiRunning(false)
    );

    this.aiVsAiResumeButton = this.makeButton('Resume', () =>
      this.handlers.onToggleAiVsAiRunning(true)
    );

    this.aiVsAiRow.append(
      this.aiVsAiStartButton,
      this.aiVsAiPauseButton,
      this.aiVsAiResumeButton
    );

    this.playForWinRow = document.createElement('div');
    this.playForWinRow.className = 'control-row expand-only';

    const playForWinLabel = document.createElement('label');
    playForWinLabel.className = 'toggle';

    this.playForWinToggle = document.createElement('input');
    this.playForWinToggle.type = 'checkbox';
    this.playForWinToggle.checked = initialPlayForWin;
    this.playForWinToggle.addEventListener('change', () => {
      this.handlers.onTogglePlayForWin(this.playForWinToggle.checked);
    });

    const playForWinText = document.createElement('span');
    playForWinText.textContent = 'Play for Win';
    playForWinLabel.append(this.playForWinToggle, playForWinText);
    this.playForWinRow.append(playForWinLabel);

    this.hintRow = document.createElement('div');
    this.hintRow.className = 'control-row expand-only';

    const hintLabel = document.createElement('label');
    hintLabel.className = 'toggle';

    this.hintToggle = document.createElement('input');
    this.hintToggle.type = 'checkbox';
    this.hintToggle.checked = initialHintMode;
    this.hintToggle.addEventListener('change', () => {
      this.handlers.onToggleHintMode(this.hintToggle.checked);
    });

    const hintText = document.createElement('span');
    hintText.textContent = 'Hint Mode';
    hintLabel.append(this.hintToggle, hintText);
    this.hintRow.append(hintLabel);

    const soundRow = document.createElement('div');
    soundRow.className = 'control-row expand-only';

    const soundLabel = document.createElement('label');
    soundLabel.className = 'toggle';

    this.soundToggle = document.createElement('input');
    this.soundToggle.type = 'checkbox';
    this.soundToggle.checked = initialSoundEnabled;
    this.soundToggle.addEventListener('change', () => {
      this.handlers.onToggleSound(this.soundToggle.checked);
    });

    const soundText = document.createElement('span');
    soundText.textContent = 'Sound';
    soundLabel.append(this.soundToggle, soundText);
    soundRow.append(soundLabel);

    const musicRow = document.createElement('div');
    musicRow.className = 'control-row expand-only';

    const musicLabel = document.createElement('label');
    musicLabel.className = 'toggle';

    this.musicToggle = document.createElement('input');
    this.musicToggle.type = 'checkbox';
    this.musicToggle.checked = initialMusicEnabled;
    this.musicToggle.addEventListener('change', () => {
      const enabled = this.musicToggle.checked;
      this.setMusicEnabled(enabled);
      this.handlers.onToggleMusic(enabled);
    });

    const musicText = document.createElement('span');
    musicText.textContent = 'Music';
    musicLabel.append(this.musicToggle, musicText);
    musicRow.append(musicLabel);

    this.musicVolumeRow = document.createElement('div');
    this.musicVolumeRow.className = 'control-row expand-only';

    const volumeLabel = document.createElement('span');
    volumeLabel.className = 'stat-label';
    volumeLabel.textContent = 'Music Volume';

    this.musicVolumeValueEl = document.createElement('span');
    this.musicVolumeValueEl.className = 'stat-value';

    this.musicVolumeInput = document.createElement('input');
    this.musicVolumeInput.type = 'range';
    this.musicVolumeInput.min = '0';
    this.musicVolumeInput.max = '100';
    this.musicVolumeInput.step = '1';
    this.musicVolumeInput.value = Math.round(initialMusicVolume * 100).toString();
    this.musicVolumeInput.addEventListener('input', () => {
      const value = Number(this.musicVolumeInput.value) / 100;
      this.setMusicVolume(value);
      this.handlers.onMusicVolumeChange(value);
    });

    const musicVolumeMeta = document.createElement('div');
    musicVolumeMeta.className = 'stat-row';
    musicVolumeMeta.append(volumeLabel, this.musicVolumeValueEl);

    const musicVolumeStack = document.createElement('div');
    musicVolumeStack.className = 'delay-stack';
    musicVolumeStack.append(musicVolumeMeta, this.musicVolumeInput);
    this.musicVolumeRow.append(musicVolumeStack);

    this.musicHintEl = document.createElement('div');
    this.musicHintEl.className = 'music-hint expand-only';
    this.musicHintEl.textContent = 'Click anywhere to enable music';

    const namesTitle = document.createElement('div');
    namesTitle.className = 'section-title expand-only';
    namesTitle.textContent = 'Player names';

    const namesBlock = document.createElement('div');
    namesBlock.className = 'stat-block expand-only';
    const nameWhiteRow = this.makeStatRow('White');
    const nameBlackRow = this.makeStatRow('Black');
    this.nameWhiteEl = nameWhiteRow.value;
    this.nameBlackEl = nameBlackRow.value;
    namesBlock.append(nameWhiteRow.row, nameBlackRow.row);

    const scoreTitle = document.createElement('div');
    scoreTitle.className = 'section-title';
    scoreTitle.textContent = 'Score';

    const scoreBlock = document.createElement('div');
    scoreBlock.className = 'stat-block';
    const scoreWhiteRow = this.makeStatRow('White');
    const scoreBlackRow = this.makeStatRow('Black');
    this.scoreWhiteEl = scoreWhiteRow.value;
    this.scoreBlackEl = scoreBlackRow.value;
    scoreBlock.append(scoreWhiteRow.row, scoreBlackRow.row);

    this.expandButton = this.makeButton('Expand', () => this.setUiCollapsed(false));
    this.expandButton.classList.add('ghost', 'collapse-only');

    const helpTitle = document.createElement('div');
    helpTitle.className = 'section-title expand-only';
    helpTitle.textContent = 'Help';

    const helpNote = document.createElement('div');
    helpNote.className = 'help-note expand-only';
    helpNote.append(
      document.createTextNode('Analyze games: export PGN and paste into ')
    );
    const helpLink = document.createElement('a');
    helpLink.href = ANALYSIS_URL;
    helpLink.textContent = 'chessanalysis.pro';
    helpLink.target = '_blank';
    helpLink.rel = 'noopener';
    helpNote.append(helpLink, document.createTextNode('.'));

    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row expand-only';

    const whiteBtn = this.makeButton('White View', () => handlers.onSnap('white'));
    const blackBtn = this.makeButton('Black View', () => handlers.onSnap('black'));
    const isoBtn = this.makeButton('Isometric', () => handlers.onSnap('iso'));
    const topBtn = this.makeButton('Top-Down', () => handlers.onSnap('top'));
    const restartBtn = this.makeButton('Restart', () => handlers.onRestart());

    buttonRow.append(whiteBtn, blackBtn, isoBtn, topBtn, restartBtn);

    const versionNote = document.createElement('div');
    versionNote.className = 'ui-version expand-only';
    versionNote.textContent = APP_VERSION;

    this.panel.append(
      header,
      this.turnEl,
      this.statusEl,
      this.noticeEl,
      this.aiStatusEl,
      modeTitle,
      modeRow,
      pieceSetTitle,
      pieceSetRow,
      namesTitle,
      namesBlock,
      scoreTitle,
      scoreBlock,
      this.expandButton,
      soundRow,
      musicRow,
      this.musicVolumeRow,
      this.musicHintEl,
      this.delayRow,
      this.aiVsAiRow,
      this.playForWinRow,
      this.hintRow,
      aiRow,
      helpTitle,
      helpNote,
      buttonRow,
      versionNote
    );
    this.hud.append(this.panel);
    root.append(this.hud);

    this.historyPanel = this.buildHistoryPanel();
    root.append(this.historyPanel);

    this.historyShowButton = this.makeButton('Show History', () => this.setHistoryVisible(true));
    this.historyShowButton.classList.add('history-show-button', 'ghost');
    root.append(this.historyShowButton);

    this.showButton = this.makeButton('Show UI', () => this.setUiVisible(true));
    this.showButton.classList.add('ui-show-button');
    root.append(this.showButton);

    this.modal = this.buildPromotionModal();
    root.append(this.modal);

    this.summaryModal = this.buildSummaryModal();
    root.append(this.summaryModal);

    this.explainModal = this.buildExplainModal();
    root.append(this.explainModal);

    this.mode = initialMode;
    this.setAiDelay(initialDelay);
    this.setMode(initialMode);
    this.setPieceSet(initialPieceSet);
    this.setPlayForWin(initialPlayForWin);
    this.setHintMode(initialHintMode);
    this.setMusicVolume(initialMusicVolume);
    this.setMusicEnabled(initialMusicEnabled);
    this.setMusicUnlockHint(false);
    this.setAiVsAiState({ started: false, running: false });
    this.applyUiState();
  }

  setTurn(color: Color): void {
    this.turnEl.textContent = color === 'w' ? 'White to move' : 'Black to move';
  }

  getUiState(): UiState {
    return { ...this.uiState };
  }

  setPlayerNames(names: { white: string; black: string }): void {
    this.nameWhiteEl.textContent = names.white;
    this.nameBlackEl.textContent = names.black;
  }

  setScores(scores: { w: number; b: number }): void {
    this.scoreWhiteEl.textContent = scores.w.toString();
    this.scoreBlackEl.textContent = scores.b.toString();
  }

  setStatus(status: GameStatus): void {
    if (status.status === 'checkmate') {
      this.statusEl.textContent =
        status.winner === 'w' ? 'Checkmate - White wins' : 'Checkmate - Black wins';
      this.noticeEl.textContent = 'Game over.';
      this.noticeEl.className = 'notice danger';
      return;
    }

    if (status.status === 'draw') {
      const reason = status.reason ? ` - ${status.reason}` : '';
      this.statusEl.textContent = `Draw${reason}`;
      this.noticeEl.textContent = 'Game over.';
      this.noticeEl.className = 'notice';
      return;
    }

    if (status.status === 'stalemate') {
      this.statusEl.textContent = 'Draw - Stalemate';
      this.noticeEl.textContent = 'Game over.';
      this.noticeEl.className = 'notice';
      return;
    }

    if (status.status === 'check') {
      this.statusEl.textContent = 'Check';
      this.noticeEl.textContent = 'King is under attack.';
      this.noticeEl.className = 'notice check';
      return;
    }

    this.statusEl.textContent = ' ';
    this.noticeEl.textContent = ' ';
    this.noticeEl.className = 'notice';
  }

  setAiThinking(thinking: boolean, color?: Color): void {
    this.aiThinking = thinking;
    this.aiThinkingColor = color;
    this.renderAiStatus();
  }

  setAiExplanationAvailable(available: boolean): void {
    this.explainButton.disabled = !available;
    this.explainButton.classList.toggle('hidden', !available);
  }

  showAiExplanation(explanation: AiExplainResult | null, loading: boolean): void {
    this.updateAiExplanation(explanation, loading);
    this.explainModal.classList.add('open');
  }

  updateAiExplanation(explanation: AiExplainResult | null, loading: boolean): void {
    if (loading) {
      this.explainLoadingEl.textContent = this.explainLoadingMessage;
      this.explainLoadingEl.classList.remove('hidden');
      this.explainMoveEl.textContent = ' ';
      this.explainSummaryEl.textContent = ' ';
      this.explainSummaryEl.classList.add('hidden');
      this.explainListEl.innerHTML = '';
      return;
    }

    if (!explanation) {
      this.explainLoadingEl.textContent = 'No explanation available.';
      this.explainLoadingEl.classList.remove('hidden');
      this.explainMoveEl.textContent = ' ';
      this.explainSummaryEl.textContent = ' ';
      this.explainSummaryEl.classList.add('hidden');
      this.explainListEl.innerHTML = '';
      return;
    }

    this.explainLoadingEl.classList.add('hidden');
    this.explainMoveEl.textContent = explanation.moveLabel;
    if (explanation.summary) {
      this.explainSummaryEl.textContent = explanation.summary;
      this.explainSummaryEl.classList.remove('hidden');
    } else {
      this.explainSummaryEl.textContent = ' ';
      this.explainSummaryEl.classList.add('hidden');
    }

    this.explainListEl.innerHTML = '';
    for (const bullet of explanation.bullets) {
      const item = document.createElement('li');
      item.textContent = bullet;
      this.explainListEl.append(item);
    }
  }

  hideAiExplanation(): void {
    this.explainModal.classList.remove('open');
  }

  setAiExplanationLoadingMessage(message: string): void {
    this.explainLoadingMessage = message;
  }

  private setSummaryHistoryView(view: 'pgn' | 'plain'): void {
    this.summaryHistoryView = view;
    const isPgn = view === 'pgn';
    this.summaryHistoryPgnButton.classList.toggle('active', isPgn);
    this.summaryHistoryPlainButton.classList.toggle('active', !isPgn);
    this.summaryHistoryText.textContent = isPgn
      ? this.summaryHistoryPgn
      : this.summaryHistoryPlain;
  }

  setMode(mode: GameMode): void {
    this.mode = mode;
    this.syncModeControls();
  }

  setAiDelay(delayMs: number): void {
    this.delayInput.value = delayMs.toString();
    this.delayValueEl.textContent = `${delayMs}ms`;
  }

  setPieceSet(pieceSet: PieceSet): void {
    this.pieceSetSelect.value = pieceSet;
  }

  setPlayForWin(enabled: boolean): void {
    this.playForWinToggle.checked = enabled;
  }

  setHintMode(enabled: boolean): void {
    this.hintToggle.checked = enabled;
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicToggle.checked = enabled;
    this.musicVolumeRow.classList.toggle('hidden', !enabled);
  }

  setMusicVolume(volume: number): void {
    const percent = Math.round(volume * 100);
    this.musicVolumeInput.value = percent.toString();
    this.musicVolumeValueEl.textContent = `${percent}%`;
  }

  setMusicUnlockHint(visible: boolean): void {
    this.musicHintEl.classList.toggle('hidden', !visible);
  }

  setAiVsAiState(state: { started: boolean; running: boolean }): void {
    this.aiVsAiStarted = state.started;
    this.aiVsAiRunning = state.running;
    this.aiVsAiReady = this.mode === 'aivai' && !this.aiVsAiStarted;
    this.updateAiVsAiControls();
    this.renderAiStatus();
  }

  showSummary(summary: GameSummary): void {
    this.summaryTitleEl.textContent = summary.title;
    this.summaryOutcomeEl.textContent = summary.outcome;
    this.summaryMaterialEl.textContent = summary.material;
    this.summaryDetailEl.textContent = summary.detail;
    this.summaryModal.classList.add('open');
  }

  hideSummary(): void {
    this.summaryModal.classList.remove('open');
  }

  setHistoryRows(rows: HistoryRow[]): void {
    const shouldScroll = this.historyAutoScroll;
    this.historyListEl.innerHTML = '';

    for (const row of rows) {
      const line = document.createElement('div');
      line.className = 'history-row';
      const white = document.createElement('span');
      white.className = 'history-cell history-white';
      white.textContent = row.white ? `${row.moveNumber}. ${row.white}` : `${row.moveNumber}.`;

      const black = document.createElement('span');
      black.className = 'history-cell history-black';
      black.textContent = row.black ?? '';

      line.append(white, black);
      this.historyListEl.append(line);
    }

    if (shouldScroll) {
      this.historyListEl.scrollTop = this.historyListEl.scrollHeight;
    }
  }

  setGameTime(elapsedMs: number): void {
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    this.historyTimerEl.textContent = `Game Time: ${label}`;
  }

  setPgnExportAvailable(available: boolean): void {
    this.historyExportButton.disabled = !available;
    this.historyExportButton.classList.toggle('hidden', !available);
    this.historyCopyButton.disabled = !available;
    this.historyCopyButton.classList.toggle('hidden', !available);
    this.summaryExportButton.disabled = !available;
    this.summaryExportButton.classList.toggle('hidden', !available);
    this.summaryCopyButton.disabled = !available;
    this.summaryCopyButton.classList.toggle('hidden', !available);
  }

  setPlainHistoryActionsAvailable(available: boolean): void {
    this.historyPlainExportButton.disabled = !available;
    this.historyPlainExportButton.classList.toggle('hidden', !available);
    this.historyPlainHtmlExportButton.disabled = !available;
    this.historyPlainHtmlExportButton.classList.toggle('hidden', !available);
    this.historyPlainCopyButton.disabled = !available;
    this.historyPlainCopyButton.classList.toggle('hidden', !available);
    this.summaryPlainHtmlExportButton.disabled = !available;
    this.summaryPlainHtmlExportButton.classList.toggle('hidden', !available);
  }

  setSummaryHistoryContent(pgnText: string, plainText: string, available: boolean): void {
    this.summaryHistoryPgn = pgnText;
    this.summaryHistoryPlain = plainText;
    this.summaryHistoryView = 'pgn';
    this.summaryHistoryTabs.classList.toggle('hidden', !available);
    this.summaryHistoryText.classList.toggle('hidden', !available);
    if (available) {
      this.setSummaryHistoryView('pgn');
    } else {
      this.summaryHistoryText.textContent = '';
    }
  }

  showPgnCopyStatus(message: string, isError = false): void {
    if (this.pgnCopyTimer !== null) {
      window.clearTimeout(this.pgnCopyTimer);
      this.pgnCopyTimer = null;
    }
    this.summaryCopyStatusEl.textContent = message;
    this.historyCopyStatusEl.textContent = message;
    this.summaryCopyStatusEl.classList.toggle('error', isError);
    this.historyCopyStatusEl.classList.toggle('error', isError);
    this.summaryCopyStatusEl.classList.add('active');
    this.historyCopyStatusEl.classList.add('active');
    this.pgnCopyTimer = window.setTimeout(() => {
      this.summaryCopyStatusEl.classList.remove('active');
      this.historyCopyStatusEl.classList.remove('active');
      this.pgnCopyTimer = null;
    }, 1600);
  }

  showPromotion(): void {
    this.modal.classList.add('open');
  }

  hidePromotion(): void {
    this.modal.classList.remove('open');
  }

  private buildPromotionModal(): HTMLDivElement {
    const modal = document.createElement('div');
    modal.className = 'modal';

    const card = document.createElement('div');
    card.className = 'modal-card';

    const title = document.createElement('h2');
    title.textContent = 'Choose promotion';

    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row';

    const options: { label: string; type: PieceType }[] = [
      { label: 'Queen', type: 'queen' },
      { label: 'Rook', type: 'rook' },
      { label: 'Bishop', type: 'bishop' },
      { label: 'Knight', type: 'knight' }
    ];

    for (const option of options) {
      const button = this.makeButton(option.label, () =>
        this.handlers.onPromotionChoice(option.type)
      );
      buttonRow.append(button);
    }

    card.append(title, buttonRow);
    modal.append(card);
    return modal;
  }

  private buildSummaryModal(): HTMLDivElement {
    const modal = document.createElement('div');
    modal.className = 'modal summary-modal';

    const card = document.createElement('div');
    card.className = 'modal-card summary-card';

    this.summaryTitleEl = document.createElement('h2');
    this.summaryTitleEl.textContent = 'Game Over';

    const body = document.createElement('div');
    body.className = 'summary-body';

    this.summaryOutcomeEl = document.createElement('p');
    this.summaryOutcomeEl.className = 'summary-line';

    this.summaryMaterialEl = document.createElement('p');
    this.summaryMaterialEl.className = 'summary-line';

    this.summaryDetailEl = document.createElement('p');
    this.summaryDetailEl.className = 'summary-detail';

    const summaryAnalysisEl = document.createElement('p');
    summaryAnalysisEl.className = 'summary-note';
    summaryAnalysisEl.append(
      document.createTextNode('Analyze this game by exporting PGN and pasting it into ')
    );
    const summaryLink = document.createElement('a');
    summaryLink.href = ANALYSIS_URL;
    summaryLink.textContent = 'chessanalysis.pro';
    summaryLink.target = '_blank';
    summaryLink.rel = 'noopener';
    summaryAnalysisEl.append(summaryLink, document.createTextNode('.'));

    const summaryLiveEl = document.createElement('p');
    summaryLiveEl.className = 'summary-note';
    summaryLiveEl.append(document.createTextNode('Play online: '));
    const liveLink = document.createElement('a');
    liveLink.href = LIVE_URL;
    liveLink.textContent = 'brainit-consulting.github.io/chess';
    liveLink.target = '_blank';
    liveLink.rel = 'noopener';
    summaryLiveEl.append(liveLink, document.createTextNode('.'));

    body.append(
      this.summaryOutcomeEl,
      this.summaryMaterialEl,
      this.summaryDetailEl,
      summaryAnalysisEl,
      summaryLiveEl
    );

    this.summaryHistoryTabs = document.createElement('div');
    this.summaryHistoryTabs.className = 'history-tabs hidden';

    this.summaryHistoryPgnButton = this.makeButton('PGN / SAN', () => {
      this.setSummaryHistoryView('pgn');
    });
    this.summaryHistoryPgnButton.classList.add('ghost', 'active');

    this.summaryHistoryPlainButton = this.makeButton('Plain English', () => {
      this.setSummaryHistoryView('plain');
    });
    this.summaryHistoryPlainButton.classList.add('ghost');

    this.summaryHistoryTabs.append(
      this.summaryHistoryPgnButton,
      this.summaryHistoryPlainButton
    );

    this.summaryHistoryText = document.createElement('pre');
    this.summaryHistoryText.className = 'summary-history hidden';
    this.summaryHistoryText.textContent = '';

    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row';

    const closeBtn = this.makeButton('Close', () => this.hideSummary());
    this.summaryExportButton = this.makeButton('Export PGN', () =>
      this.handlers.onExportPgn()
    );
    this.summaryExportButton.classList.add('ghost', 'hidden');
    this.summaryExportButton.disabled = true;
    this.summaryCopyButton = this.makeButton('Copy PGN', () =>
      this.handlers.onCopyPgn()
    );
    this.summaryCopyButton.classList.add('ghost', 'hidden');
    this.summaryCopyButton.disabled = true;
    this.summaryAnalyzeButton = this.makeButton('Analyze Game', () =>
      this.handlers.onAnalyzeGame()
    );
    this.summaryAnalyzeButton.classList.add('ghost');
    this.summaryAnalyzeButton.title = 'Analyze in Chess Game Buddy';
    this.summaryAnalyzeButton.setAttribute('aria-label', 'Analyze in Chess Game Buddy');
    this.summaryPlainHtmlExportButton = this.makeButton('Export Plain HTML', () =>
      this.handlers.onExportPlainHistoryHtml()
    );
    this.summaryPlainHtmlExportButton.classList.add('ghost', 'hidden');
    this.summaryPlainHtmlExportButton.disabled = true;
    const restartBtn = this.makeButton('Restart', () => {
      this.hideSummary();
      this.handlers.onRestart();
    });

    buttonRow.append(
      closeBtn,
      this.summaryExportButton,
      this.summaryCopyButton,
      this.summaryAnalyzeButton,
      this.summaryPlainHtmlExportButton,
      restartBtn
    );
    this.summaryCopyStatusEl = document.createElement('div');
    this.summaryCopyStatusEl.className = 'copy-status';
    card.append(
      this.summaryTitleEl,
      body,
      this.summaryHistoryTabs,
      this.summaryHistoryText,
      buttonRow,
      this.summaryCopyStatusEl
    );
    modal.append(card);
    return modal;
  }

  private buildHistoryPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'panel history-panel';

    const header = document.createElement('div');
    header.className = 'panel-header';

    const title = document.createElement('h2');
    title.className = 'panel-title';
    title.textContent = 'Game History';

    this.historyHideButton = this.makeButton('Hide History', () =>
      this.setHistoryVisible(false)
    );
    this.historyHideButton.classList.add('ghost');

    header.append(title, this.historyHideButton);

    this.historyTimerEl = document.createElement('div');
    this.historyTimerEl.className = 'history-timer';
    this.historyTimerEl.textContent = 'Game Time: 00:00';

    const historyHeader = document.createElement('div');
    historyHeader.className = 'history-header';
    const whiteLabel = document.createElement('span');
    whiteLabel.textContent = 'White';
    const blackLabel = document.createElement('span');
    blackLabel.textContent = 'Black';
    historyHeader.append(whiteLabel, blackLabel);

    this.historyListEl = document.createElement('div');
    this.historyListEl.className = 'history-list';
    this.historyListEl.addEventListener('scroll', () => {
      const threshold = 24;
      const { scrollTop, scrollHeight, clientHeight } = this.historyListEl;
      this.historyAutoScroll = scrollTop + clientHeight >= scrollHeight - threshold;
    });

    this.historyExportButton = this.makeButton('Export PGN', () =>
      this.handlers.onExportPgn()
    );
    this.historyExportButton.classList.add('ghost', 'hidden');
    this.historyExportButton.disabled = true;

    this.historyCopyButton = this.makeButton('Copy PGN', () =>
      this.handlers.onCopyPgn()
    );
    this.historyCopyButton.classList.add('ghost', 'hidden');
    this.historyCopyButton.disabled = true;

    this.historyPlainExportButton = this.makeButton('Export Plain English', () =>
      this.handlers.onExportPlainHistory()
    );
    this.historyPlainExportButton.classList.add('ghost', 'hidden');
    this.historyPlainExportButton.disabled = true;

    this.historyPlainHtmlExportButton = this.makeButton('Export Plain HTML', () =>
      this.handlers.onExportPlainHistoryHtml()
    );
    this.historyPlainHtmlExportButton.classList.add('ghost', 'hidden');
    this.historyPlainHtmlExportButton.disabled = true;

    this.historyPlainCopyButton = this.makeButton('Copy Plain English', () =>
      this.handlers.onCopyPlainHistory()
    );
    this.historyPlainCopyButton.classList.add('ghost', 'hidden');
    this.historyPlainCopyButton.disabled = true;

    const exportRow = document.createElement('div');
    exportRow.className = 'button-row history-export-row';
    exportRow.append(
      this.historyExportButton,
      this.historyCopyButton,
      this.historyPlainExportButton,
      this.historyPlainHtmlExportButton,
      this.historyPlainCopyButton
    );

    this.historyCopyStatusEl = document.createElement('div');
    this.historyCopyStatusEl.className = 'copy-status';

    panel.append(
      header,
      this.historyTimerEl,
      historyHeader,
      this.historyListEl,
      exportRow,
      this.historyCopyStatusEl
    );
    return panel;
  }

  private buildExplainModal(): HTMLDivElement {
    const modal = document.createElement('div');
    modal.className = 'modal explain-modal';

    const card = document.createElement('div');
    card.className = 'modal-card explain-card';

    const title = document.createElement('h2');
    title.textContent = 'Why this move?';

    const body = document.createElement('div');
    body.className = 'summary-body';

    this.explainMoveEl = document.createElement('p');
    this.explainMoveEl.className = 'explain-move';
    this.explainMoveEl.textContent = ' ';

    this.explainSummaryEl = document.createElement('p');
    this.explainSummaryEl.className = 'explain-summary';
    this.explainSummaryEl.classList.add('hidden');

    this.explainLoadingEl = document.createElement('p');
    this.explainLoadingEl.className = 'explain-loading hidden';
    this.explainLoadingEl.textContent = 'Analyzing...';

    this.explainListEl = document.createElement('ul');
    this.explainListEl.className = 'explain-list';

    body.append(
      this.explainMoveEl,
      this.explainSummaryEl,
      this.explainLoadingEl,
      this.explainListEl
    );

    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row';

    const closeBtn = this.makeButton('Close', () => this.handlers.onHideAiExplanation());
    buttonRow.append(closeBtn);

    card.append(title, body, buttonRow);
    modal.append(card);
    return modal;
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  private makeModeButton(label: string, mode: GameMode): HTMLButtonElement {
    const button = this.makeButton(label, () => this.handleModeSelect(mode));
    button.classList.add('segment');
    return button;
  }

  private makeStatRow(label: string): { row: HTMLDivElement; value: HTMLSpanElement } {
    const row = document.createElement('div');
    row.className = 'stat-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'stat-value';
    valueEl.textContent = '-';

    row.append(labelEl, valueEl);
    return { row, value: valueEl };
  }

  private handleModeSelect(mode: GameMode): void {
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    this.syncModeControls();
    this.handlers.onModeChange(mode);
  }

  private syncModeControls(): void {
    this.modeButtons.hvh.classList.toggle('active', this.mode === 'hvh');
    this.modeButtons.hvai.classList.toggle('active', this.mode === 'hvai');
    this.modeButtons.aivai.classList.toggle('active', this.mode === 'aivai');

    const aiEnabled = this.mode !== 'hvh';
    this.aiToggle.checked = aiEnabled;
    this.difficultySelect.disabled = !aiEnabled;
    this.delayRow.classList.toggle('hidden', this.mode !== 'aivai');
    this.hintRow.classList.toggle('hidden', this.mode !== 'hvai');
    this.hintToggle.disabled = this.mode !== 'hvai';
    this.aiVsAiReady = this.mode === 'aivai' && !this.aiVsAiStarted;
    this.updateAiVsAiControls();
    this.renderAiStatus();
  }

  private renderAiStatus(): void {
    if (this.aiThinking) {
      if (!this.aiThinkingColor) {
        this.aiStatusText.textContent = 'AI thinking';
        this.aiStatusDots.classList.add('active');
        return;
      }
      const label = this.aiThinkingColor === 'w' ? 'White' : 'Black';
      this.aiStatusText.textContent = `${label} AI thinking`;
      this.aiStatusDots.classList.add('active');
      return;
    }

    if (this.aiVsAiReady) {
      this.aiStatusText.textContent = 'AI vs AI ready - press Start Game';
      this.aiStatusDots.classList.remove('active');
      return;
    }

    this.aiStatusText.textContent = ' ';
    this.aiStatusDots.classList.remove('active');
  }

  private updateAiVsAiControls(): void {
    const show = this.mode === 'aivai';
    this.aiVsAiRow.classList.toggle('hidden', !show);
    this.playForWinRow.classList.toggle('hidden', !show);
    this.aiVsAiStartButton.classList.toggle('hidden', !show || this.aiVsAiStarted);
    const showPause = show && this.aiVsAiStarted && this.aiVsAiRunning;
    const showResume = show && this.aiVsAiStarted && !this.aiVsAiRunning;
    this.aiVsAiPauseButton.classList.toggle('hidden', !showPause);
    this.aiVsAiResumeButton.classList.toggle('hidden', !showResume);
  }

  private setUiVisible(visible: boolean): void {
    if (this.uiState.visible === visible) {
      return;
    }
    this.uiState.visible = visible;
    this.persistUiState();
    this.applyUiState();
    this.handlers.onUiStateChange({ ...this.uiState });
  }

  private setUiCollapsed(collapsed: boolean): void {
    if (this.uiState.collapsed === collapsed) {
      return;
    }
    this.uiState.collapsed = collapsed;
    this.persistUiState();
    this.applyUiState();
    this.handlers.onUiStateChange({ ...this.uiState });
  }

  private setHistoryVisible(visible: boolean): void {
    if (this.uiState.historyVisible === visible) {
      return;
    }
    this.uiState.historyVisible = visible;
    this.persistUiState();
    this.applyUiState();
    this.handlers.onUiStateChange({ ...this.uiState });
  }

  private applyUiState(): void {
    if (this.uiState.visible) {
      this.root.classList.remove('ui-hidden');
    } else {
      this.root.classList.add('ui-hidden');
    }

    if (this.uiState.collapsed) {
      this.root.classList.add('ui-collapsed');
    } else {
      this.root.classList.remove('ui-collapsed');
    }

    if (this.uiState.historyVisible) {
      this.root.classList.remove('history-hidden');
    } else {
      this.root.classList.add('history-hidden');
    }
  }

  private loadUiState(): UiState {
    const fallback: UiState = { visible: true, collapsed: false, historyVisible: true };
    const storage = this.getStorage();
    if (!storage) {
      return fallback;
    }
    const raw = storage.getItem(UI_STATE_KEY);
    if (!raw) {
      storage.setItem(UI_STATE_KEY, JSON.stringify(fallback));
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw) as UiState;
      if (
        typeof parsed.visible === 'boolean' &&
        typeof parsed.collapsed === 'boolean'
      ) {
        return {
          visible: parsed.visible,
          collapsed: parsed.collapsed,
          historyVisible:
            typeof parsed.historyVisible === 'boolean' ? parsed.historyVisible : true
        };
      }
    } catch {
      // ignore malformed values
    }
    storage.setItem(UI_STATE_KEY, JSON.stringify(fallback));
    return fallback;
  }

  private persistUiState(): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    storage.setItem(UI_STATE_KEY, JSON.stringify(this.uiState));
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
