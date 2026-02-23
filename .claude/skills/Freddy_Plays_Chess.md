# Freddy Plays Chess

Freddy is Claude's chess-playing persona. When the user asks Freddy to play chess, demo the game, or show it to a friend, follow these steps.

## Prerequisites

- Node.js 20+ installed
- Project dependencies installed (`npm install`)
- Playwright installed (`npm install --no-save playwright` if needed)

## Setup Steps

### 1. Instrument the Game (one-time, if not already done)

Add this line to `src/main.ts` after `game.start();`:

```ts
(window as any).__game = game;
```

This exposes the game controller on `window.__game` so Playwright can call move functions directly.

### 2. Build the Project

```bash
npm run build
```

### 3. Start the Preview Server

```bash
npx vite preview --port 4190
```

Note: If the port is in use, Vite will pick the next available port. Check the terminal output for the actual URL.

### 4. Run the Freddy Chess Script

```bash
node audit/_play-as-human.mjs http://localhost:4190
```

This script will:
- Open a visible Chromium browser
- Load the chess game
- Use the **Standard** piece set (default)
- Set difficulty to **Max Thinking**
- Click **Restart** to start fresh
- Play the **Italian Game** opening as White (1.e4, 2.Nf3, 3.Bc4, 4.d3, 5.O-O, 6.Nc3)
- Wait for AI responses between moves
- Save a screenshot to `audit/freddy-game.png`
- Leave the browser open so the user can continue playing or observe

## How the Moves Work

The script uses Playwright's `page.evaluate()` to call the game's internal methods:

```js
// Select a piece on a square (file 0-7 = a-h, rank 0-7 = 1-8)
window.__game.selectSquare({ file: 4, rank: 1 }); // selects pawn on e2

// Move to destination
window.__game.tryMoveTo({ file: 4, rank: 3 }); // moves to e4
```

These are TypeScript `private` methods but accessible at JavaScript runtime.

## Key Game API Reference

| Method | Purpose |
| --- | --- |
| `selectSquare({file, rank})` | Select a piece at the given square |
| `tryMoveTo({file, rank})` | Move the selected piece to destination |
| `state.activeColor` | Current turn: 0 = White, 1 = Black |
| `legalMoves` | Array of legal moves for selected piece |

## Square Mapping

- **file**: 0=a, 1=b, 2=c, 3=d, 4=e, 5=f, 6=g, 7=h
- **rank**: 0=1 (White's back rank), 7=8 (Black's back rank)

## Common Opening Moves (Italian Game)

```
1. e4   -> [4,1] to [4,3]
2. Nf3  -> [6,0] to [5,2]
3. Bc4  -> [5,0] to [2,3]
4. d3   -> [3,1] to [3,2]
5. O-O  -> [4,0] to [6,0] (castling)
6. Nc3  -> [1,0] to [2,2]
```

## After the Demo

1. Stop the Playwright script with Ctrl+C
2. Stop the preview server with Ctrl+C
3. Optionally revert the `window.__game` line from `src/main.ts` if you don't want it in production
4. Rebuild if you reverted: `npm run build`

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `window.__game not found` | Ensure `main.ts` has the `(window as any).__game = game;` line and rebuild |
| `Cannot find package 'playwright'` | Run `npm install --no-save playwright` |
| AI timeout (>45s per move) | Normal for Max Thinking difficulty. Freddy continues playing regardless. |
| Port in use | Check Vite output for actual port, pass it as argument to the script |
| Moves not registering | The game might be in AI-vs-AI mode. Ensure mode is Human vs AI. |
