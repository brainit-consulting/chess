# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to
Semantic Versioning.

## [Unreleased]
### Changed

## [1.1.51] - 2025-12-27 17:30
### Added
- Scorpion Chess Engine branding assets (logos) for the UI header.
- Benchmark report timing split metrics (timed-out move counts, avg/max ms breakdown).
### Changed
- Rename the main UI title to "SCORPION 3D CHESS" and update the header logo.
- Update the in-UI version label to v1.1.50 as part of the branding release.
- Benchmark harness: add per-move timing flags in meta logs and improved reporting detail.
- Hard mode: add a time budget guard (best-so-far return) and stop-request support for worker runs.

## [1.1.49] - 2025-12-27 09:19
### Added
- Coordinate debug overlay toggle to mark a1/h1/a8/h8 for visual verification.
### Changed
- Align board square mapping so a1 renders bottom-left in White View.
- Fix fixed coordinate labels to anchor and order correctly in White/Black modes.
- Update the in-UI version label to v1.1.49.

## [1.1.48] - 2025-12-26 17:13
### Added
- Max-only null-move pruning with conservative endgame guards.
### Changed
- Mark Phase 4B as completed in the Max Thinking roadmap.
- Update the in-UI version label to v1.1.48.
## [1.1.47] - 2025-12-26 16:35
### Added
- Max-only late move reductions (LMR) for deeper effective search.
### Changed
- Mark Phase 4A as completed in the Max Thinking roadmap.
- Update Max Thinking docs to reflect current search upgrades.
- Update the in-UI version label to v1.1.47.

## [1.1.46] - 2025-12-26 16:12
### Added
- Max-only SEE-lite capture filtering for move ordering and quiescence.
### Changed
- Mark Phase 3C as completed in the Max Thinking roadmap.
- Update Max Thinking docs to reflect current search upgrades.
- Update the in-UI version label to v1.1.46.

## [1.1.45] - 2025-12-26 15:26
### Added
- Max Thinking aspiration windows for iterative deepening with deterministic retry tests.
### Changed
- Mark Phase 3B as completed in the Max Thinking roadmap.
- Update the in-UI version label to v1.1.45.

## [1.1.44] - 2025-12-26 14:37
### Added
- Max Thinking move ordering upgrades (killer + history heuristics, Max-only).
- Add Max Thinking roadmap and planning docs.
### Changed
- Make Max Thinking move ordering deterministic for equal scores.
- Add a Max-only ordering unit test.
- Update the in-UI version label to v1.1.44.

## [1.1.43] - 2025-12-26 12:41
### Added
- Add Chess Engine AI to the analyzer dropdown options.
- Add dev-only mate probe helpers to validate mate-distance scoring.
### Changed
- Remove Chess Analysis Net from the analyzer dropdown options.
- Update analyzer references in the docs.
- Update the in-UI version label to v1.1.43.

## [1.1.42] - 2025-12-26 10:53
### Added
- Add Chess Analysis Net to the analyzer dropdown options.
### Changed
- Update the in-UI version label to v1.1.42.

## [1.1.41] - 2025-12-26 10:35
### Added
- Max Thinking mate-distance scoring, transposition table, and mate-aware move ordering.
### Changed
- Update the in-UI version label to v1.1.41.

## [1.1.40] - 2025-12-26 10:04
### Added
- Max Thinking quiescence search (captures and checks only) to reduce horizon effects.
### Changed
- Update the in-UI version label to v1.1.40.

## [1.1.39] - 2025-12-26 09:34
### Fixed
- Use the native file picker when available to improve downloads on hosted builds.
### Changed
- Update the in-UI version label to v1.1.39.

## [1.1.38] - 2025-12-26 09:15
### Fixed
- Improve hosted export downloads by adding a safer download fallback.
### Changed
- Update the in-UI version label to v1.1.38.

## [1.1.37] - 2025-12-26 08:31
### Added
- Max Thinking evaluation heuristics for king safety, early queen development, and minor-piece PSTs.
### Changed
- Update the in-UI version label to v1.1.37.

## [1.1.36] - 2025-12-25
### Added
- Document AI difficulty modes and Max Thinking behavior in the docs.
- Add the Dreaming About Becoming a Grand Master Chess Engine Invitation link to docs and README.
### Changed
- Update the in-UI version label to v1.1.36.

## [1.1.35] - 2025-12-25
### Changed
- Refresh the player guide to match current UI controls, analyzers, and exports.
- Remove outdated control and end-condition references.

## [1.1.34] - 2025-12-25
### Added
- Coordinate mode selector to switch between PGN-fixed labels and view-relative labels.
### Fixed
- Keep board coordinates fixed to the PGN (White) orientation regardless of camera view.
- Reapply auto-snap to the human side after restart when enabled.

## [1.1.33] - 2025-12-25
### Fixed
- Show the "Play as" selector correctly inline with Play vs AI.
- Reapply auto-snap to the human side after restart when enabled.

## [1.1.32] - 2025-12-25
### Added
- Auto-snap toggle to keep the camera on the human side in Human vs AI.
### Changed
- Show a short "You are now White/Black" notice when swapping sides in Human vs AI.

## [1.1.31] - 2025-12-24
### Added
- "Max Thinking" difficulty with time-based iterative deepening (capped depth).
- Human vs AI "Play as" selection (White or Black, default White).
### Changed
- Play-for-Win now applies a fairness window to avoid large eval drops when avoiding repetition.
- Add timing and symmetry tests for the Play-for-Win guardrails.
### Fixed
- Force the default camera to the White view on launch.
- Correct board coordinate label mapping for White/Black views.

## [1.1.30] - 2025-12-24
### Added
- Subtle board coordinates (a-h, 1-8) with a "Show Coordinates" toggle.
### Changed
- Analyzer selection persists and updates help/game-over text labels.
- Game-over analyzer logo links to Chess Game Buddy by default.
- Compact left panel layout (centered title, merged player/score block, inline audio/AI controls).
- Update the in-UI version label to v1.1.30.

## [1.1.29] - 2025-12-24
### Added
- Allow selecting an analyzer (BrainIT Chess Buddy Analyzer or Chess Analysis Pro) from the main UI.
- Add an "Open Analyzer" action button that uses the selected analyzer.
### Changed
- Game-over analysis text and "Analyze Game" action now use the selected analyzer.
- Game-over analyzer logo links to Chess Game Buddy by default.
- Compact left panel layout (centered title, merged player/score block, inline audio/AI controls).
- Update the in-UI version label to v1.1.29.

## [1.1.28] - 2025-12-24
### Added
- Show the BrainIT Chess Game Engine logo in the left panel header.
- Show the BrainIT Chess Game Analyzer logo in the game-over modal near the Analyze Game button.
- Link the header engine logo to brainitconsulting.com.
### Changed
- Update the in-UI version label to v1.1.28.

## [1.1.27] - 2025-12-24
### Fixed
- Prevent camera turn-nudge from accumulating and pulling the board farther away over time.
### Changed
- Update the in-UI version label to v1.1.27.

## [1.1.26] - 2025-12-24
### Added
- Game-over modal includes an "Analyze Game" link to Chess Game Buddy.
### Changed
- Update the in-UI version label to v1.1.26.

## [1.1.25] - 2025-12-24
### Changed
- Update the in-UI version label to v1.1.25.

## [1.1.24] - 2025-12-24
### Added
- Copy PGN button with clipboard support in the game-over export UI.
### Changed
- Update the in-UI version label to v1.1.24.
- Add Stockfish backend resource notes for benchmarking setup.
- Add benchmark plan document for BrainIT vs Stockfish comparisons.

## [1.1.23] - 2025-12-24
### Fixed
- Guarantee explain requests route to the explain worker to avoid long waits.
- Prevent explanation analysis from queueing behind hard AI searches.
- Add deterministic tests for explain-worker routing.
### Changed
- Update the in-UI version label to v1.1.23.

## [1.1.22] - 2025-12-24
### Changed
- Run "Why this move?" analysis on a dedicated worker and show a timeout hint if it runs long.

## [1.1.21] - 2025-12-24
### Added
- Documented full camera and input controls (mouse wheel zoom, right-drag rotate, Q/E, R/F) in both player guide copies.

## [1.1.20] - 2025-12-24
### Added
- Pause AI vs AI while the "Why this move?" modal is open.
- Play-online reminders in the game-over summary and docs.

## [1.1.18] - 2025-12-24
### Added
- Plain English game history HTML export.
- Analysis links in the UI help, game-over summary, README, and player guide.

## [1.1.17] - 2025-12-24
### Added
- Hint Mode for Human vs AI (best-move square highlight).
- "Why this move?" explanations for AI moves (engine-facts-based).
- Move history panel, game clock, and PGN export.
- Plain English history view with copy/export at game end.
### Changed
- Improve responsiveness by running AI search in a Web Worker (no gameplay changes).
- History panel now shows from-to coordinates for each side.
- History panel now prefixes moves with the moving piece.

## [1.1.5] - 2025-12-24
### Changed
- Expand "Why this move?" explanations with capture threats and mobility facts.

## [1.1.3] - 2025-12-23

### Added

- Play for Win (AI vs AI only): lightly penalizes moves that repeat recent positions and adds small top-move variety so self-play avoids repetition loops and reaches a result.
- Top-Down camera preset for quick analysis viewing.
- Player user guide documentation.
- Subtle animated dot-pulse indicator shown while AI is thinking (CSS-only, non-blocking).

### Changed

- Dropdown option contrast for clearer readability.

## [1.1.2] - 2025-12-23

### Fixed

- AI vs AI pause/resume now cancels pending AI moves immediately.

## [1.1.1] - 2025-12-23

### Added

- Draw detection for insufficient material and stalemate outcomes.

## [1.1.0] - 2025-12-23

### Added

- AI vs AI mode with a configurable move delay and thinking indicator per side.
- Game over summary modal with winner/draw, final material score, and a brief explanation.

## [1.0.9] - 2025-12-22

### Added

- AI "thinking..." indicator while Black is calculating a move.
- Woody sound effects (move, capture, check, checkmate) with a global sound toggle.
- Camera polish: subtle turn micro-nudges, UI-aware zoom, and checkmate settle easing.
- UI panel hide/show and collapse/expand controls.

### Changed

- Checkmate status messaging to explicitly show the winner.

## [1.0.8] - 2025-12-22

### Changed

- Adjusted sci-fi piece proportions (taller/slimmer) for clearer silhouettes.

## [1.0.7] - 2025-12-22

### Added

- First public playable online build (GitHub Pages).

Learn more: [Dreaming About Becoming a Grand Master Chess Engine Invitation](docs/Dreaming_About_Becoming_a_Grand_Master_Chess_Engine_Invitation.html)
