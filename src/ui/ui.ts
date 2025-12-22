import type { AiDifficulty } from '../ai/ai';
import { GameStatus, Color } from '../rules';
import { SnapView } from '../types';
import { PieceType } from '../rules';

type UIHandlers = {
  onRestart: () => void;
  onSnap: (view: SnapView) => void;
  onPromotionChoice: (type: PieceType) => void;
  onToggleAi: (enabled: boolean) => void;
  onDifficultyChange: (difficulty: AiDifficulty) => void;
};

export class GameUI {
  private turnEl: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private noticeEl: HTMLDivElement;
  private modal: HTMLDivElement;
  private aiToggle: HTMLInputElement;
  private difficultySelect: HTMLSelectElement;
  private handlers: UIHandlers;

  constructor(root: HTMLElement, handlers: UIHandlers) {
    this.handlers = handlers;

    root.innerHTML = '';

    const hud = document.createElement('div');
    hud.className = 'hud-stack';

    const panel = document.createElement('div');
    panel.className = 'panel';

    const title = document.createElement('h1');
    title.textContent = '3D Chess';

    this.turnEl = document.createElement('div');
    this.turnEl.className = 'turn';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'status';

    this.noticeEl = document.createElement('div');
    this.noticeEl.className = 'notice';

    const aiRow = document.createElement('div');
    aiRow.className = 'control-row';

    const aiLabel = document.createElement('label');
    aiLabel.className = 'toggle';

    this.aiToggle = document.createElement('input');
    this.aiToggle.type = 'checkbox';
    this.aiToggle.checked = true;
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
      <option value="medium" selected>Medium</option>
      <option value="hard">Hard</option>
    `;
    this.difficultySelect.disabled = !this.aiToggle.checked;
    this.difficultySelect.addEventListener('change', () => {
      this.handlers.onDifficultyChange(this.difficultySelect.value as AiDifficulty);
    });

    aiRow.append(aiLabel, this.difficultySelect);

    const buttonRow = document.createElement('div');
    buttonRow.className = 'button-row';

    const whiteBtn = this.makeButton('White View', () => handlers.onSnap('white'));
    const blackBtn = this.makeButton('Black View', () => handlers.onSnap('black'));
    const isoBtn = this.makeButton('Isometric', () => handlers.onSnap('iso'));
    const restartBtn = this.makeButton('Restart', () => handlers.onRestart());

    buttonRow.append(whiteBtn, blackBtn, isoBtn, restartBtn);

    panel.append(title, this.turnEl, this.statusEl, this.noticeEl, aiRow, buttonRow);
    hud.append(panel);
    root.append(hud);

    this.modal = this.buildPromotionModal();
    root.append(this.modal);
  }

  setTurn(color: Color): void {
    this.turnEl.textContent = color === 'w' ? 'White to move' : 'Black to move';
  }

  setStatus(status: GameStatus): void {
    if (status.status === 'checkmate') {
      this.statusEl.textContent =
        status.winner === 'w' ? 'Checkmate - White wins' : 'Checkmate - Black wins';
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
}
