import type { AiDifficulty } from '../ai/ai';
import { GameStatus, Color } from '../rules';
import { SnapView } from '../types';
import { PieceType } from '../rules';

export type UiState = {
  visible: boolean;
  collapsed: boolean;
};

type UIHandlers = {
  onRestart: () => void;
  onSnap: (view: SnapView) => void;
  onPromotionChoice: (type: PieceType) => void;
  onToggleAi: (enabled: boolean) => void;
  onDifficultyChange: (difficulty: AiDifficulty) => void;
  onToggleSound: (enabled: boolean) => void;
  onUiStateChange: (state: UiState) => void;
};

type UIOptions = {
  aiEnabled?: boolean;
  aiDifficulty?: AiDifficulty;
  soundEnabled?: boolean;
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
  private modal: HTMLDivElement;
  private aiToggle: HTMLInputElement;
  private difficultySelect: HTMLSelectElement;
  private soundToggle: HTMLInputElement;
  private nameWhiteEl: HTMLSpanElement;
  private nameBlackEl: HTMLSpanElement;
  private scoreWhiteEl: HTMLSpanElement;
  private scoreBlackEl: HTMLSpanElement;
  private hideButton: HTMLButtonElement;
  private showButton: HTMLButtonElement;
  private collapseButton: HTMLButtonElement;
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

    this.hideButton = this.makeButton('Hide UI', () => this.setUiVisible(false));
    this.hideButton.classList.add('ghost');

    this.collapseButton = this.makeButton('Collapse', () => this.setUiCollapsed(true));
    this.collapseButton.classList.add('ghost');

    headerActions.append(this.collapseButton, this.hideButton);
    header.append(title, headerActions);

    this.turnEl = document.createElement('div');
    this.turnEl.className = 'turn';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'status expand-only';

    this.noticeEl = document.createElement('div');
    this.noticeEl.className = 'notice expand-only';

    this.aiStatusEl = document.createElement('div');
    this.aiStatusEl.className = 'ai-status expand-only';

    const aiRow = document.createElement('div');
    aiRow.className = 'control-row expand-only';

    const aiLabel = document.createElement('label');
    aiLabel.className = 'toggle';

    this.aiToggle = document.createElement('input');
    this.aiToggle.type = 'checkbox';
    const initialAiEnabled = options.aiEnabled ?? true;
    const initialDifficulty = options.aiDifficulty ?? 'medium';
    const initialSoundEnabled = options.soundEnabled ?? true;
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
    const restartBtn = this.makeButton('Restart', () => handlers.onRestart());

    buttonRow.append(whiteBtn, blackBtn, isoBtn, restartBtn);

    this.panel.append(
      header,
      this.turnEl,
      this.statusEl,
      this.noticeEl,
      this.aiStatusEl,
      namesTitle,
      namesBlock,
      scoreTitle,
      scoreBlock,
      this.expandButton,
      soundRow,
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
        status.winner === 'w' ? 'Checkmate — White wins' : 'Checkmate — Black wins';
      this.noticeEl.textContent = 'Game over.';
      this.noticeEl.className = 'notice danger';
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

  setAiThinking(thinking: boolean): void {
    this.aiStatusEl.textContent = thinking ? 'AI thinking...' : ' ';
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

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', onClick);
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
