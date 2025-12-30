# Scorpion 3D Chess

Two-player 3D chess with standard rules, a rotatable board, and a pure rules engine powered by the Scorpion Chess Engine.

Live demo: https://brainit-consulting.github.io/chess/
Shareable play link: https://brainit-consulting.github.io/chess/

GitHub Pages: Settings -> Pages -> Source: GitHub Actions
Current UI version: v1.1.55

The UI shows player names (including AI labels) and a running captured-material score.
You can hide the UI panel or collapse it to a compact view from the header controls.
Sound effects are available with a Sound toggle, and the camera adds subtle polish.

## Run

```bash
npm install
npm run dev
```

## Test

```bash
npm run test
```

Single run (no watch):

```bash
npm run test:run
```

## Controls

- Left click: select piece / move
- Right click or Escape: cancel selection
- Right drag: rotate camera
- Scroll: zoom
- Snap buttons: White / Black / Isometric / Top-Down views
- Force Move Now (Max Thinking only): force the current best AI move immediately
- Mode selector: Human vs Human / Human vs AI / AI vs AI
- Difficulty selector: Easy / Medium / Hard / Max Thinking
- Play as selector (Human vs AI): choose White or Black
- Coordinate Display: Fixed (White) / Fixed (Black) / Hidden
- Show Coordinate Debug Overlay: mark a1/h1/a8/h8 for verification

## Modes

- Mode selector: Human vs Human, Human vs AI, or AI vs AI.
- AI vs AI includes Start/Pause/Resume, an AI move delay slider, and Play for Win.
- Draws include stalemate, insufficient material (e.g., K vs K, K+N/B vs K), and threefold repetition.
- Hard uses a depth-3 search with a gameplay time cap (~800ms) for responsiveness.
- Max Thinking uses iterative deepening with a 10s cap and supports Force Move Now.

## Analyze Your Games

- Export PGN from the Game History panel or the game-over summary.
- Use the Analyzer dropdown (Scorpion Chess Game Analyzer, Chess Analysis Pro, Chess Engine AI) or the game-over "Analyze Game" button, then paste or import the PGN to replay and analyze.

## Benchmarks

- Quick benchmark harness: `npm run bench:quick -- --stockfish "C:\path\to\stockfish.exe" --batch 10 --movetime 200 --mode hard`
- "Timed out moves" in the report mean the harness forced a fallback because a best move did not arrive before `movetime + grace`.

## Structure

- `src/rules`: pure chess rules engine (no rendering dependencies)
- `src/client`: Three.js scene, camera, picking, highlights
- `src/ui`: DOM overlay for status, buttons, promotion UI
- `src/ai`: AI move selection (heuristics + minimax)

Learn more: [Dreaming About Becoming a Grand Master Chess Engine Invitation](docs/Dreaming_About_Becoming_a_Grand_Master_Chess_Engine_Invitation.html)
