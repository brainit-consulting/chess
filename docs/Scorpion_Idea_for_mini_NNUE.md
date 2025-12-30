# Scorpion Chess Engine – Idea for a Mini NNUE

## Purpose
This document captures a **future-facing idea** for introducing a *minimal NNUE-style evaluation* into the Scorpion Chess Engine, designed specifically for **browser-based constraints** and **simplicity-first strength gains**.

This is **not a commitment** to implement NNUE now. It is an architectural exploration to preserve thinking, tradeoffs, and a realistic path forward.

---

## Why Consider NNUE at All?
Modern chess engines overwhelmingly rely on NNUE-style evaluation because it provides:

- Strong positional intuition
- Better king safety awareness
- Improved tactical stability
- Smooth evaluation gradients for alpha–beta search

NNUE does **not replace minimax / alpha–beta**.  
It replaces or augments the **static evaluation function**.

---

## Why Full NNUE Is Not Suitable (Right Now)
A Stockfish-class NNUE is not realistic for Scorpion’s current goals because:

- Heavy SIMD assumptions (C++ / AVX)
- Large networks (hundreds of neurons)
- High node throughput requirements
- Training infrastructure overhead
- Browser performance constraints

Scorpion prioritizes:
- Simplicity
- Transparency
- Deterministic behavior
- Browser-first performance

---

## The “Mini NNUE” Concept
Instead of full NNUE, Scorpion could experiment with a **tiny, incremental neural evaluator** that preserves the core NNUE insight:

> *Incrementally update an evaluation accumulator when pieces move.*

Key idea:
- Small network
- Quantized math
- Incremental updates
- Bounded cost per node

---

## Feasible Mini NNUE Architecture

### Input Features (Sparse)
- Piece–square features
- 12 piece types × 64 squares
- Sparse activation (only occupied squares contribute)

### Network Shape
- Input → Hidden → Output
- Hidden layer: **32–64 neurons**
- Output: single centipawn score

### Activation
- Clipped ReLU (cheap, deterministic)

### Numeric Representation
- int8 weights
- int16 accumulators
- int32 final sum → centipawns

### Update Strategy
- Maintain an accumulator per position
- On makeMove:
  - subtract old piece-square contribution
  - add new piece-square contribution
- On unmakeMove:
  - reverse the update

No full recomputation per node.

---

## Execution Environment
Recommended:
- **WebAssembly (WASM)** module for evaluation math
- Called from search loop
- No dynamic allocation
- No garbage collection pressure

Avoid:
- Pure JavaScript NN inference
- Per-node full forward passes
- Floating-point-heavy math

---

## Integration Strategy

### Phase 1: Hybrid Evaluation
Combine:
- Existing handcrafted eval (material, PSTs, king safety, mobility)
- Mini NNUE score as a *secondary term*

Example:
```
eval = classicalEval + nnueWeight * miniNNUEEval
```

Weight starts small (e.g., 0.1–0.25).

### Phase 2: Confidence Gating
Use mini NNUE more heavily when:
- Material is reduced
- Kings are exposed
- Position is tactically sharp

Fallback to classical eval if NNUE fails or is disabled.

---

## Expected Benefits (Even with a Tiny Net)
- Earlier detection of dangerous king positions
- Fewer “walk into forced mate” lines
- More stable defensive play
- Smoother positional decisions

This aligns directly with Scorpion’s current benchmark weaknesses.

---

## What This Will NOT Do
- It will not rival Stockfish NNUE
- It will not replace alpha–beta
- It will not instantly add hundreds of Elo
- It will not remove the need for good search heuristics

---

## When This Makes Sense to Revisit
Reconsider mini NNUE when:
- Handcrafted evaluation improvements plateau
- Search behavior stabilizes (Phase 4.x complete)
- WASM infrastructure is solid
- Benchmark harness is mature (already true)

---

## Recommended Next Steps (Not Now)
Before NNUE:
1. Improve king safety heuristics
2. Add hanging-piece / capture safety logic
3. Improve piece-square tables
4. Enhance quiescence search

Mini NNUE should be an **augmentation**, not a rescue.

---

## Final Note
This document exists to **preserve a good idea**, not rush it.

A tiny NNUE-style evaluator *can* fit Scorpion’s philosophy:
> *Strength through simplicity, clarity, and control.*

But only when the engine is ready to benefit from it.
