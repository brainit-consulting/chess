# 3D Chess

Two-player 3D chess with standard rules, a rotatable board, and a pure rules engine.

## Run

```bash
npm install
npm run dev
```

## Test

```bash
npm run test
```

## Controls

- Left click: select piece / move
- Right click or Escape: cancel selection
- Right drag: rotate camera
- Scroll: zoom
- Q/E: rotate yaw
- R/F: rotate pitch
- Snap buttons: White / Black / Isometric views

## Structure

- `src/rules`: pure chess rules engine (no rendering dependencies)
- `src/client`: Three.js scene, camera, picking, highlights
- `src/ui`: DOM overlay for status, buttons, promotion UI
