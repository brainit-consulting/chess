import {
  GameState,
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
import { SceneView, PickResult } from './client/scene';
import { GameUI } from './ui/ui';

export class GameController {
  private state: GameState;
  private scene: SceneView;
  private ui: GameUI;
  private selected: Square | null = null;
  private legalMoves: Move[] = [];
  private pendingPromotion: Move[] | null = null;
  private gameOver = false;

  constructor(sceneRoot: HTMLElement, uiRoot: HTMLElement) {
    this.state = createInitialState();
    this.scene = new SceneView(sceneRoot, {
      onPick: (pick) => this.handlePick(pick),
      onCancel: () => this.clearSelection()
    });
    this.ui = new GameUI(uiRoot, {
      onRestart: () => this.reset(),
      onSnap: (view) => this.scene.snapView(view),
      onPromotionChoice: (type) => this.resolvePromotion(type)
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.clearSelection();
      }
    });
  }

  start(): void {
    void this.scene.ready().then(() => this.sync());
  }

  private reset(): void {
    this.state = createInitialState();
    this.selected = null;
    this.legalMoves = [];
    this.pendingPromotion = null;
    this.gameOver = false;
    this.sync();
  }

  private sync(): void {
    this.scene.setState(this.state);

    const status = getGameStatus(this.state);
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
    applyMove(this.state, move);
    this.selected = null;
    this.legalMoves = [];
    this.sync();
  }
}
