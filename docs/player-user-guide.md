# 3D Chess - Player User Guide

Welcome to **3D Chess**! This guide covers current modes, controls, and features.

---

## Controls

- Left click: select piece / move
- Right click or Escape: cancel selection
- Right click + drag: rotate camera
- Scroll wheel: zoom in/out
- View buttons: White / Black / Isometric / Top-Down

---

## Play Online

Share this link so others can play:

https://brainit-consulting.github.io/chess/

---

## Game Modes

### Human vs Human

- Two players share the same device.
- Turns alternate between White and Black.
- No AI assistance.

### Human vs AI

- You play against the computer.
- Choose AI difficulty (Easy / Medium / Hard).
- Choose **Play as White** or **Play as Black**.
- You can switch sides mid-game if you want.

### AI vs AI

- Watch two AI players compete.
- Use **Start**, **Pause**, **Resume**, and **Play for Win**.
- AI will not start automatically - setup comes first.

---

## Board and Camera

### Coordinates

- **Show Coordinates** toggles labels on or off.
- **Coordinate Mode** controls label orientation:
  - **PGN (fixed)**: labels stay in standard PGN orientation (a1 is always White's left rook). This matches move history and PGN exports.
  - **View (rotate)**: labels rotate with the camera so a1 stays at the bottom-left of your screen.

Tip: If you compare the board to the Game History, use **PGN (fixed)**.

### Auto-snap to your side

- When enabled, the camera snaps behind your pieces in Human vs AI.
- When disabled, the camera stays where you put it.

### Camera Views

- **White View**: behind White's pieces.
- **Black View**: behind Black's pieces.
- **Isometric**: angled 3D view.
- **Top-Down**: near top-down analysis view.

---

## AI Features

### AI Difficulty

- **Easy**: simple, non-optimal moves.
- **Medium**: balanced play.
- **Hard**: strongest default setting.

### AI Move Delay

- Adds a delay (in milliseconds) between AI moves.
- Helps you visually follow the game.

### Play for Win (AI vs AI only)

- Encourages the AI to avoid repetition loops.
- Adds variety when multiple moves are similarly good.

### Hint Mode (Human vs AI only)

- Shows a subtle highlight for the recommended move.
- Highlights the FROM and TO squares.
- Does not auto-play the move.

### Why this move?

- Available after the AI makes a move.
- Shows a short, engine-based explanation (no guessing).
- In AI vs AI, the game pauses while the modal is open.

---

## Piece Sets

- **Sci-Fi**: futuristic default set.
- **Standard**: classic chess pieces.

Changing the piece set keeps the current game state and updates visuals immediately.

---

## Game History and Exports

The right panel shows:

- Move history (White and Black columns).
- Game time (excludes pauses).
- Hide/Show toggle for the panel.

Exports (available at game end):

- **Export PGN** and **Copy PGN**.
- **Export Plain English**, **Copy Plain English**, and **Export Plain HTML**.

The game-over summary also includes:

- PGN / Plain English tabs.
- Export / Copy buttons.
- **Analyze Game** button.

---

## Analyzers

Use the **Analyzer** dropdown in the main UI to choose:

- **BrainIT Chess Buddy Analyzer**
- **Chess Analysis Pro**

Click **Open Analyzer** to open your choice in a new tab, then paste or import your PGN.

---

## Game End Conditions

The game ends and shows a summary on:

- **Checkmate**
- **Stalemate**
- **Insufficient material** (for example, King vs King)
- **Threefold repetition**

---

## Sound and Music

- **Sound**: move, capture, check, and UI sounds.
- **Music**: ambient background loop with a volume slider.

---

## Preferences and Persistence

The game remembers:

- Mode and AI difficulty
- AI move delay
- Play for Win
- Hint Mode
- Play as (Human vs AI)
- Piece set
- Coordinate mode and Show Coordinates
- Auto-snap to your side
- Analyzer choice
- Sound and Music settings
- UI panel visibility

---

## Tips

- Use **AI vs AI + Play for Win** to study openings and endgames.
- Slow down AI move delay while learning.
- Top-Down view is ideal for analysis.
- Use **PGN (fixed)** coordinates when comparing to Game History.

---

Enjoy the game, and have fun exploring chess in 3D!
Emile from brainitconsulting.com

Learn more: [Dreaming About Becoming a Grand Master Chess Engine Invitation](Dreaming_About_Becoming_a_Grand_Master_Chess_Engine_Invitation.html)

## A note about ranking of chess engines
- https://www.rankred.com/chess-engines/
- Stockfish has an Arpad Elo rating of 3759 in 2025 

## Complexity is beautiful
The number of possible moves makes chess one of the most complex games 

If you construct a complete tree of all possible moves in a chessboard, you will get a total of 10 to the power of120 moves. That’s an extremely large number.

To put this into perspective, there have been only 10 to the power of 26 nanoseconds since the Big Bang and about 10 to the power of 75 atoms in the entire universe. These numbers are dwarfed by the number of possible moves in chess, making it one of the most complex board games.
