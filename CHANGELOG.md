# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to
Semantic Versioning.

## [Unreleased]
### Added
- Plain English game history HTML export.

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
