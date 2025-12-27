# BrainIT Chess Engine vs Stockfish — Plan Using UCI (Phased)

This document is a step-by-step implementation plan to benchmark **BrainITChessEngine** against **Stockfish** using the **UCI (Universal Chess Interface)** protocol, and produce an estimated **Elo** rating via automated self-play matches.

Primary UCI spec reference:
- UCI Protocol (April 2006 copy): https://backscattering.de/chess/uci/

Stockfish UCI reference:
- Stockfish “UCI & Commands”: https://official-stockfish.github.io/docs/stockfish-wiki/UCI-%26-Commands.html

Match runner reference:
- cutechess-cli (engine match runner): https://www.chessprogramming.org/Cutechess-cli
- cutechess-cli manpage: https://manpages.ubuntu.com/manpages/trusty/man6/cutechess-cli.6.html

---

## Goals

1) Make BrainITChessEngine UCI-compliant (or UCI-enough).
2) Run automated matches vs Stockfish.
3) Log PGNs and results.
4) Fit an Elo estimate using the logistic Elo model.

Non-goals:
- No UI work.
- Rating only valid for the chosen benchmark conditions.

---

## Phase 0 — Benchmark Conditions

Freeze:
- Time control (e.g. 5+0, 3+0, or movetime)
- Opening suite (PGN recommended)
- Draw rules
- Hardware + threads
- Hash size

---

## Phase 1 — Minimal UCI Handshake

Reference: https://backscattering.de/chess/uci/

Required commands:
- uci, isready, ucinewgame, position, go, stop, quit, setoption

Engine must reply with:
- id name, id author, uciok, readyok, bestmove

---

## Phase 2 — Position Parsing

Support:
- position startpos moves ...
- position fen <FEN> moves ...

Apply moves sequentially and preserve legality.

---

## Phase 3 — Search + bestmove

Support:
- go movetime <ms>

Return:
- bestmove e2e4 (promotion: e7e8q)

---

## Phase 4 — setoption

Safely parse:
- Hash
- Threads

Ignore unknown options.

---

## Phase 5 — cutechess-cli Matches

Example:

cutechess-cli \
  -engine name=BrainIT cmd=./BrainITChessEngine proto=uci \
  -engine name=Stockfish cmd=./stockfish proto=uci \
  -each tc=5+0 \
  -games 100 -repeat \
  -openings file=./openings.pgn format=pgn order=random \
  -pgnout ./out/matches.pgn

---

## Phase 6 — Elo Estimation

Score:
- Win = 1
- Draw = 0.5
- Loss = 0

Expected score:
E = 1 / (1 + 10^((Ri - R)/400))

Fit R across opponents.

---

## Phase 7 — Codex Execution Plan

7A: UCI hello world  
7B: Legal move loop  
7C: Full game stability  
7D: cutechess integration  
7E: Ladder + Elo report  

---

## Verification

- Manual UCI handshake
- Single bestmove test
- cutechess smoke test
- Full ladder benchmark

---

## Appendix

UCI Spec:
https://backscattering.de/chess/uci/
