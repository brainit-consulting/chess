# Vision

Scorpion 3D Chess should play real chess. Strong against itself, and above all strong and enjoyable against a person sitting at the board. The factory scores every piece of work against this file.

## Goals
- Make ScorpionCore (the in-repo TypeScript engine) play measurably stronger chess, with Max Thinking staying strictly stronger than Hard.
- Make it a good opponent for humans, not just a strong one. It should convert won positions, defend lost ones, avoid pointless repetition draws, and never hang a piece or miss a mate in one.
- Fix the gap against a real engine. The last Stockfish ladder (2ms per move, 10 games) ended 0-0-10 against us. Close that gap one rung of the ladder at a time.
- Keep every move inside its time budget. Hard about 1 second, Max up to 10 seconds in the UI, with Force Move Now always working. Timeouts that fall back to a weak move count as defects.
- Cut the draw rate in self-play. Most draws are Hard holding on, so the target is wins as Max, not fewer draws for their own sake.
- Offer a range of human difficulty levels so a beginner and a club player both get a fair game.

## Target users
- Casual players who want a good game against the computer on a board they can rotate and look at.
- Improving and club-level players who want an opponent that punishes mistakes and does not play the same dull line every game.
- The maintainer, who needs engine changes that are measured, so each one can be accepted or thrown out on evidence.

## Principles
- Small, well-tested changes. One engine change per experiment.
- Measure, don't guess. A change counts as an improvement only after a baseline-versus-variant self-play run: `--swap --fenSuite`, a fresh seed, and a pass on the acceptance rule (at least +5pp for Max, no more losses).
- Max-only changes first. New evaluation terms and search ideas go into Max Thinking, so Hard stays a stable reference.
- Report Heart and Core results separately. ScorpionHeart (Stockfish-based) results never stand in for ScorpionCore progress.
- Play for people, not only for the benchmark. Check changes against human-facing behaviour too (blunders, repetition, endgame technique), because self-play can hide problems a person notices at once.
- Keep the public API stable.
- Record rejected experiments with the reason. At our search depth (5 to 7), most pruning ideas have failed, and the notes keep us from trying them again.

## Out of scope
- Online multiplayer, accounts or matchmaking.
- Changing what the UI looks like or how it feels when the engine changes.
- Claiming Elo for ScorpionCore from ScorpionHeart or Stockfish results.
- Search pruning at shallow depth (futility, reverse futility, late move pruning, probcut). Already tried and rejected. Reopen only with a new idea and a new measurement.
- Mixing NNUE scores into the classical eval without fixing the score scale first. Already rejected at -15pp.
- Bigger time budgets as a way to look stronger. Strength has to come from the engine, not from thinking longer.
- Cosmetic polish, new piece sets and sound work, unless they block play.

## Quality bar
- Every behaviour change comes with tests. The suite in `src/ai/__tests__/ai.test.ts` must pass.
- CI is green before merge.
- Engine changes include the benchmark command, seed, and Hard/Max W-D-L result in the commit or the roadmap. The summary says whose record it is, because `summary.json` shows Hard's record, not Max's.
- No increase in Max timeouts or losses against the control run.
- `docs/ENGINE_ROADMAP.md` is updated with the result, whether accepted or rejected.
- A human-play sanity check before release: a few full games against the UI with no illegal moves, no frozen moves, and no hung pieces in simple positions.

## Protected areas
Paths (globs in backticks) and topics that always need a human. The factory never merges
changes that touch them; they go to your inbox.
- `**/auth/**`
- `**/migrations/**`
- `.github/workflows/**`
- `LICENSE`
- payments
- licensing
- `bin/**`
- `src/rules/**`
- `src/ai/nnue/**`
- `benchmarks/baseline/**`
- ScorpionHeart and Stockfish distribution (GPL and attribution)
- accepting or rejecting an engine change on benchmark evidence
