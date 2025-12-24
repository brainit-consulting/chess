# 3D Chess

Two-player 3D chess with standard rules, a rotatable board, and a pure rules engine.

Live demo: https://brainit-consulting.github.io/chess/

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
- Q/E: rotate yaw
- R/F: rotate pitch
- Snap buttons: White / Black / Isometric views
- Play vs AI toggle: enable Human (White) vs AI (Black)
- Difficulty selector: Easy / Medium / Hard

## Modes

- Mode selector: Human vs Human, Human vs AI, or AI vs AI.
- AI vs AI includes an AI move delay slider and shows a game-over summary modal.
- Draws include stalemate and insufficient material (e.g., K vs K, K+N/B vs K).

## Analyze Your Games

- Export PGN from the Game History panel or the game-over summary.
- Open https://chessanalysis.pro/ and paste or import the PGN to replay and analyze.

## Structure

- `src/rules`: pure chess rules engine (no rendering dependencies)
- `src/client`: Three.js scene, camera, picking, highlights
- `src/ui`: DOM overlay for status, buttons, promotion UI
- `src/ai`: AI move selection (heuristics + minimax)
