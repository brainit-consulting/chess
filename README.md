# 3D Chess

Two-player 3D chess with standard rules, a rotatable board, and a pure rules engine.

Live demo: https://brainit-consulting.github.io/chess/
Shareable play link: https://brainit-consulting.github.io/chess/

GitHub Pages: Settings → Pages → Source: GitHub Actions

The UI now shows player names (including AI labels) and a running captured-material score.
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
- Mode selector: Human vs Human / Human vs AI / AI vs AI
- Difficulty selector: Easy / Medium / Hard / Max Thinking
- Play as selector (Human vs AI): choose White or Black

## Modes

- Mode selector: Human vs Human, Human vs AI, or AI vs AI.
- AI vs AI includes Start/Pause/Resume, an AI move delay slider, and Play for Win.
- Draws include stalemate, insufficient material (e.g., K vs K, K+N/B vs K), and threefold repetition.

## Analyze Your Games

- Export PGN from the Game History panel or the game-over summary.
- Use the Analyzer dropdown (BrainIT Chess Buddy Analyzer, Chess Analysis Pro, Chess Engine AI) or the game-over "Analyze Game" button, then paste or import the PGN to replay and analyze.

## Structure

- `src/rules`: pure chess rules engine (no rendering dependencies)
- `src/client`: Three.js scene, camera, picking, highlights
- `src/ui`: DOM overlay for status, buttons, promotion UI
- `src/ai`: AI move selection (heuristics + minimax)

Learn more: [Dreaming About Becoming a Grand Master Chess Engine Invitation](docs/Dreaming_About_Becoming_a_Grand_Master_Chess_Engine_Invitation.html)
