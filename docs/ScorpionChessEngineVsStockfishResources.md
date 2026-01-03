# ScorpionChessEngineVsStockfish Resources

You asked where to get the Stockfish backend. These are the clean, correct
options, in order of practicality.

---

## Option 1 (Recommended): Local Stockfish binary

Best for speed, accuracy, and lowest friction.

### Where to get it

- Official Stockfish site: https://stockfishchess.org/download/
- Choose:
  - Windows -> stockfish-windows-x86-64-avx2.exe
  - macOS -> stockfish-macos-*
  - Linux -> distro package or prebuilt binary

This is the same engine family used by sites like chessanalysis.pro and most
serious benchmarks.

### Why this is ideal

- Fastest
- Deterministic
- Full UCI support
- Easy to control depth / movetime / threads
- No JS/WASM overhead

### How Codex would use it

Via a simple UCI adapter that:
- spawns the process
- sends `uci`, `position`, `go depth N` or `go movetime X`
- parses `bestmove`

No changes to your engine.

---

## Option 2: Stockfish WASM / JS

Only if you want everything self-contained in Node or browser.

### Where to get it

- npm package: `stockfish`
- https://www.npmjs.com/package/stockfish

This is a WASM build of Stockfish.

### Tradeoffs

- Slower than native binary
- More variance
- Still valid for quick-and-dirty bracketing
- Slightly more annoying to manage timing

### When to use this

- CI-only environments
- No native binaries allowed
- Pure JS tooling requirement

---

## What chessanalysis.pro is using (important context)

Sites like chessanalysis.pro are powered by Stockfish 16+ running as a native
engine with UCI. You are benchmarking against the same class of engine, so a
local Stockfish binary is the most honest apples-to-apples reference.

---

## What I recommend you answer Codex with (copy-paste)

```
Let's use a local Stockfish binary for ScorpionChessEngineVsStockfish benchmarks.

- I'll download Stockfish from https://stockfishchess.org/download/
- Assume a UCI-compatible local binary (Threads=1, Hash=64).
- That's fine for both the quick-and-dirty and the proper benchmark.

Adding tsx as a dev dependency for the harness is OK.
Prefer fixed movetime first (e.g. 50/100/250 ms), then depth if needed.

Please keep the Scorpion engine completely unchanged.
```

---

## Final reassurance

You are doing this the right way:

- Measuring, not tuning
- Stockfish as an external baseline
- Directional results first
- Clean baseline at v1.1.59

Once the harness exists, we can interpret the Elo deltas safely and plan future
engine improvements without contaminating the benchmark.
