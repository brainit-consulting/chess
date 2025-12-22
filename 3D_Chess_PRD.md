# PRD — 3D Chess (Two-Player, Standard Rules, Rotatable Board)

## 1) Overview
Build a **3D Chess** game that allows **two human players** to play against each other on the same device (hot-seat). The game must enforce **standard chess rules**, provide **3D board rotation controls**, and offer a clean, intuitive interaction model for selecting and moving pieces in 3D space.

## 2) Goals
- Deliver a fully playable **3D chess** experience for **two players**.
- Enforce **legal moves** and core rule constraints (turn order, check rules, castling, en passant, promotion, checkmate/stalemate).
- Allow users to **rotate the board in 3D** at any time (mouse/touch/keys).
- Provide clear UI feedback: selectable pieces, legal moves, last move, check/checkmate state, captures, timers (optional).
- Support restart and basic game state persistence (optional, but recommended).

## 3) Non-Goals (Out of Scope for v1)
- AI opponent (no engine required).
- Online multiplayer / matchmaking.
- Chess analysis tools (evaluation, move suggestions, PGN import/export beyond basic).
- Fancy cinematics or advanced post-processing (keep performant and clean).

## 4) Target Users
- Casual players wanting a local two-player 3D chess board.
- Users who want a tactile 3D board they can rotate/inspect.

## 5) Platforms & Controls
### 5.1 Platforms (v1)
- Desktop (Windows/Mac/Linux) with mouse + keyboard.
- Touch support is optional but good if low-effort.

### 5.2 Core Inputs
- **Left click / tap**: select piece, choose destination square.
- **Right click / escape**: cancel selection / deselect.
- **Board rotation**:
  - Mouse: click+drag (middle mouse or right-drag) to orbit camera around board OR drag on empty space.
  - Keyboard: Q/E rotate yaw, R/F pitch, or arrow keys.
  - Scroll wheel: zoom in/out.
- Optional: button to “snap” camera to White perspective / Black perspective.

## 6) User Experience & Player Flow
1. Game starts in initial chess position.
2. UI indicates whose turn it is (White starts).
3. Player selects one of their pieces.
4. Legal destination squares highlight.
5. Player clicks a highlighted square to move.
6. Move executes with animation (optional), captures occur automatically.
7. System updates game state, checks for check/checkmate/stalemate, toggles turn.
8. Repeat until game ends; provide end-of-game overlay and restart option.

## 7) Functional Requirements

### 7.1 Game Rules (Standard Chess)
Implement full standard chess rules:

#### 7.1.1 Turn Rules
- White moves first.
- Players can only move their own pieces on their turn.
- After a successful move, turn switches.

#### 7.1.2 Piece Movement (Legal Moves)
- **Pawn**
  - Moves forward 1 square if empty.
  - From starting rank can move forward 2 squares if both squares empty.
  - Captures diagonally forward 1 square.
  - **En passant**: allowed immediately on next move if opponent advanced a pawn two squares adjacent to your pawn.
  - Promotion when reaching last rank: must promote to **Queen, Rook, Bishop, or Knight** (no King, no Pawn).

- **Rook**
  - Moves any number of squares orthogonally until blocked.
  - Captures first enemy piece in path.

- **Knight**
  - Moves in L shape (2+1), can jump over pieces.

- **Bishop**
  - Moves diagonally any number until blocked.

- **Queen**
  - Combines rook + bishop movement.

- **King**
  - Moves 1 square in any direction.
  - Cannot move into check.

#### 7.1.3 Check / Illegal Moves
- A move is illegal if it leaves the moving player’s king in check.
- Must detect:
  - **Check**: king is attacked after opponent’s move.
  - **Checkmate**: current player is in check and has no legal moves.
  - **Stalemate**: current player is not in check but has no legal moves.

#### 7.1.4 Castling
- Allowed if:
  - King and selected rook have not moved.
  - Squares between king and rook are empty.
  - King is not currently in check.
  - King does not pass through or end on a square under attack.
- Castling results in king move (two squares toward rook) and rook moves to the square the king passes over.

#### 7.1.5 Draw Conditions (v1 minimal set)
Must implement:
- Stalemate.
Recommended (nice-to-have):
- Threefold repetition.
- 50-move rule.
- Insufficient material (e.g., K vs K, K+B vs K, K+N vs K, etc.).

### 7.2 Board & Coordinates
- Chessboard is 8x8 grid: files a–h, ranks 1–8 (or 0–7 internal).
- Internal coordinate system should be consistent and reversible.
- Each square has:
  - Coordinate (x,y) or (file, rank)
  - Occupant piece or empty
- Must support selecting squares via raycast/picking in 3D.

### 7.3 Interaction Model
- Click piece → highlight legal moves.
- Click legal square → execute move.
- Click another own piece while selected → switch selection.
- Click invalid square → no move, maintain selection (or cancel—choose one consistent behavior).
- Provide hover feedback (highlight square under cursor).

### 7.4 Board Rotation & Camera
- Camera can orbit around board with smooth rotation.
- Rotation must not break selection (raycast should still work).
- Provide:
  - Orbit yaw (around vertical axis)
  - Optional pitch constraints (avoid flipping below board)
  - Zoom constraints (min/max distance)
- “Snap view” buttons:
  - White view (facing from White side)
  - Black view (180° rotated)
  - Optional: isometric default

### 7.5 UI Requirements
Required UI elements:
- Turn indicator: “White to move” / “Black to move”
- Selected piece indicator (optional)
- Move highlight markers (circles, glowing squares, etc.)
- Check indicator: “Check” label when applicable
- End state overlay:
  - Checkmate (winner)
  - Stalemate (draw)
  - Resign (optional)
- Buttons:
  - Restart
  - Undo (optional for v1; if included must correctly revert all state including en passant rights, castling rights, clocks)
  - Snap camera views

### 7.6 Audio/Visual Feedback (Minimal)
- Piece selection sound (optional)
- Move sound
- Capture sound
- Highlight animations (soft glow)

## 8) Non-Functional Requirements
- 60 FPS target on mid-range desktop.
- Deterministic rules engine (no physics-based movement affecting legality).
- Maintainability: clean separation of concerns:
  - Rule engine
  - Rendering/3D scene
  - Input/controller
  - UI layer

## 9) Technical Architecture (Implementation Guidance for Codex)

### 9.1 High-Level Modules
1. **Rules Engine (Pure Logic)**
   - Board representation
   - Move generation
   - Move validation (including king safety)
   - State transitions
   - Endgame detection
   - Serialization for save/load (optional)

2. **3D Presentation Layer**
   - Board mesh, piece meshes
   - Square colliders for picking or a single board collider with UV→square mapping
   - Visual highlights (instanced markers or shader overlay)

3. **Input & Game Controller**
   - Handles click-to-select, click-to-move
   - Communicates with Rules Engine for legal moves
   - Triggers animations and UI updates

4. **Camera Controller**
   - Orbit + zoom + snap views
   - Input mapping separate from game input (avoid conflicts)

5. **UI Layer**
   - Turn text
   - Status text (check, mate, draw)
   - Buttons

### 9.2 Data Structures (Suggested)
- `PieceType`: King, Queen, Rook, Bishop, Knight, Pawn
- `Color`: White, Black
- `Piece`: { id, type, color, hasMoved }
- `Square`: { file, rank } or { x, y }
- `Move`: 
  - from, to
  - movingPieceId
  - capturedPieceId? 
  - promotionType?
  - isCastle?
  - isEnPassant?
  - rookFrom/rookTo? (if castle)
  - prevStateSnapshot? (if undo)
- `GameState`:
  - board[8][8] -> pieceId or null
  - pieces map pieceId->Piece
  - activeColor
  - castlingRights (KQkq style flags)
  - enPassantTargetSquare? (square behind a pawn that moved two)
  - halfmoveClock, fullmoveNumber
  - lastMove

### 9.3 Move Generation Strategy
- Generate pseudo-legal moves per piece.
- Filter moves that leave king in check:
  - Make move on a cloned state (or apply/unapply)
  - Test king attacked
- Attack detection function: `isSquareAttacked(square, byColor)`

### 9.4 Rendering & Piece Placement
- Map board squares to world positions:
  - `worldPos = boardOrigin + (file * tileSize, 0, rank * tileSize)` (or swapped)
- Animate pieces between squares (optional):
  - Simple lerp over 0.15–0.3s
- Captured pieces removed from scene and stored.

### 9.5 Picking / Raycasting
Two viable approaches:
1. Each square has an invisible collider; raycast returns square id.
2. Board is one collider; use hit point to compute file/rank by local coordinates.

## 10) Edge Cases & Acceptance Criteria

### 10.1 Core Acceptance Criteria (Must Pass)
- Players can complete a standard game with legal moves only.
- Selecting a piece shows only legal destinations (including special moves).
- Illegal moves (including moving into check) are prevented.
- Check is detected and displayed.
- Checkmate ends the game with winner indicated.
- Stalemate ends the game as draw.
- Castling works and is blocked under the correct conditions.
- En passant works only immediately after the triggering pawn move.
- Promotion triggers a selection UI and replaces pawn correctly.
- Board rotation/zoom works without breaking input or state.

### 10.2 Special Move Scenarios (Test Cases)
- Castling through check should be illegal.
- En passant capture removes the correct pawn.
- Promotion to each type works.
- Knight jumping over pieces works.
- Pinned piece cannot move to expose king.
- Moving king adjacent to enemy king is illegal (square attacked).

## 11) UI/UX Details
### 11.1 Highlights
- Selected piece: outline/glow.
- Legal squares:
  - Empty: dot marker
  - Capture: ring marker
- Last move highlight: from/to squares colored.
- Check highlight: king square glow red.

### 11.2 Promotion UI
- When pawn reaches last rank, present modal:
  - Buttons: Queen, Rook, Bishop, Knight
- Default selection: Queen (but must allow choosing others).

### 11.3 End Game Overlay
- Title: “Checkmate — White wins” / “Checkmate — Black wins”
- Or “Draw — Stalemate”
- Buttons: Restart, (optional) Review board, Exit

## 12) Persistence (Optional)
- Save current game to JSON:
  - pieces, board, activeColor, rights, clocks, move history
- Load from JSON.

## 13) Milestones
1. **M1 — 3D Board + Camera Orbit**
   - Render board and pieces in initial position
   - Board rotation/zoom + snap views

2. **M2 — Basic Move Engine**
   - Move generation for all pieces (no special moves)
   - Turn system + captures

3. **M3 — Check/Checkmate/Stalemate**
   - Attack detection
   - Filter illegal moves
   - End-state detection + UI

4. **M4 — Special Moves**
   - Castling
   - En passant
   - Promotion UI

5. **M5 — Polish**
   - Highlights, sounds, animations
   - Optional undo/save/load

## 14) Definition of Done
- All acceptance criteria in Section 10.1 pass.
- No known rule-breaking bugs across common test scenarios.
- Board can rotate freely during play without breaking interaction.
- Clean code separation between rules engine and 3D/UI layers.
- Project includes a basic README with controls and features.

## 15) Deliverables (What Codex Should Produce)
- Source code implementing:
  - rules engine
  - 3D scene setup (board, pieces)
  - input controller
  - camera orbit controller
  - UI elements
- Minimal assets:
  - placeholder 3D models acceptable (primitive meshes) if no art provided
- Automated or manual test checklist referencing Section 10.
