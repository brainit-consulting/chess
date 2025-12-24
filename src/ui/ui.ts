import type { AiDifficulty } from '../ai/ai';
import { GameStatus, Color } from '../rules';
import { GameSummary } from '../gameSummary';
import { GameMode, PieceSet, SnapView } from '../types';
import { PieceType } from '../rules';

const PLAYER_GUIDE_URL = `${import.meta.env.BASE_URL}player-user-guide.md`;

export type UiState = {
  visible: boolean;
  collapsed: boolean;
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
  private modal: HTMLDivElement;
  private summaryModal: HTMLDivElement;
  private summaryTitleEl: HTMLHeadingElement;
  private summaryOutcomeEl: HTMLParagraphElement;
  private summaryMaterialEl: HTMLParagraphElement;
  private summaryDetailEl: HTMLParagraphElement;
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
    this.aiStatusEl.append(this.aiStatusText, this.aiStatusDots);

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

    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row expand-only';

    const whiteBtn = this.makeButton('White View', () => handlers.onSnap('white'));
    const blackBtn = this.makeButton('Black View', () => handlers.onSnap('black'));
    const isoBtn = this.makeButton('Isometric', () => handlers.onSnap('iso'));
    const topBtn = this.makeButton('Top-Down', () => handlers.onSnap('top'));
    const restartBtn = this.makeButton('Restart', () => handlers.onRestart());

    buttonRow.append(whiteBtn, blackBtn, isoBtn, topBtn, restartBtn);

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
      buttonRow
    );
    this.hud.append(this.panel);
    root.append(this.hud);

    this.showButton = this.makeButton('Show UI', () => this.setUiVisible(true));
    this.showButton.classList.add('ui-show-button');
    root.append(this.showButton);

    this.modal = this.buildPromotionModal();
    root.append(this.modal);

    this.summaryModal = this.buildSummaryModal();
    root.append(this.summaryModal);

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

    body.append(this.summaryOutcomeEl, this.summaryMaterialEl, this.summaryDetailEl);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row';

    const closeBtn = this.makeButton('Close', () => this.hideSummary());
    const restartBtn = this.makeButton('Restart', () => {
      this.hideSummary();
      this.handlers.onRestart();
    });

    buttonRow.append(closeBtn, restartBtn);
    card.append(this.summaryTitleEl, body, buttonRow);
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
  }

  private loadUiState(): UiState {
    const fallback: UiState = { visible: true, collapsed: false };
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
      if (typeof parsed.visible === 'boolean' && typeof parsed.collapsed === 'boolean') {
        return parsed;
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
