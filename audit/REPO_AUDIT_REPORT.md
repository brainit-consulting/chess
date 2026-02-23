# Scorpion Chess Repository Audit Report

**Date:** 2026-02-23
**Repository:** h:\chess (branch: main)
**Audited by:** Claude Code (automated audit)
**Scope:** All 175 git-tracked files reviewed for remote repo hygiene
**Exclusions:** Book-related and benchmark-related files are excluded from flagging per owner request

---

## Executive Summary

| Metric | Value |
|---|---|
| Total git-tracked files | 175 |
| Total tracked size (non-LFS) | ~19 MB |
| Git LFS files | 4 files (~170 MB actual) |
| Files flagged for review | 48 |
| Estimated removable bloat | ~11.4 MB tracked + ~160 MB LFS (questionable) |
| .gitignore health | Good (node_modules, dist, analysis, logs all ignored) |

---

## 1. .gitignore Health Check

The `.gitignore` is well-configured. The following are properly excluded from tracking:

| Pattern | Status | Notes |
|---|---|---|
| `dist` | IGNORED | Build output correctly excluded |
| `node_modules/` | IGNORED | Dependencies correctly excluded |
| `analysis/` | IGNORED | Generated analysis data excluded |
| `*.log` | IGNORED | Log files excluded |
| `*.tmp` | IGNORED | Temp files excluded |
| `*.snnue` (wildcard) | IGNORED | Generic NNUE weights excluded (one specific weight IS tracked in src/) |
| `dataset*.jsonl*` | IGNORED | Training datasets excluded |
| `scripts/bench/quick-results/` | IGNORED | Benchmark run artifacts excluded |
| `benchmarks/**/game-*.pgn` | IGNORED | Individual game files excluded |

**Verdict: .gitignore is healthy.** No critical omissions found.

---

## 2. Git LFS Usage

LFS is configured via `.gitattributes` for `*.exe` and `*.pdf` files.

| File | LFS Actual Size | Notes |
|---|---|---|
| `bin/ScorpionHeart.exe` | 80 MB | Project's own chess engine |
| `bin/stockfish-windows-x86-64-avx2.exe` | 80 MB | Third-party engine binary |
| `book/The_Scorpion_Chess_Engine_Book.pdf` | 10 MB | EXCLUDED from audit (book) |
| `docs/Phase 8 Plan_ Scorpion Chess Engine.pdf` | 67 KB | Planning document |

**Verdict:** LFS is correctly configured for the binary types present. See Section 4 for whether these files should remain tracked at all.

---

## 3. Items Already Handled Correctly

These common repo-bloat sources are NOT present in the remote:

- `node_modules/` - not tracked (73 MB local, correctly gitignored)
- `dist/` - not tracked (8.9 MB local, correctly gitignored)
- `analysis/` - not tracked (27 MB local, correctly gitignored)
- `.env` files - none exist
- `.DS_Store` / `Thumbs.db` - none tracked
- IDE configs (`.vscode/`, `.idea/`) - none tracked
- Source maps (`*.map`) - none tracked (only inside node_modules)
- Log files - none tracked
- Temporary files - none tracked

---

## 4. Flagged Items by Category

### 4.1 SCREENSHOTS & IMAGES (26 files, ~4.89 MB) - MEDIUM RISK

The `screenshotsPlay/` directory contains 26 PNG screenshots that bloat the repository. These are visual references of the UI at various stages but are not required for building or running the application.

| # | File | Size | Recommendation |
|---|---|---|---|
| 1 | `screenshotsPlay/KingIsChallengedByAI.png` | 493 KB | SAFE TO REMOVE |
| 2 | `screenshotsPlay/hard game in progress ai vs ai v1-3-4.png` | 405 KB | SAFE TO REMOVE |
| 3 | `screenshotsPlay/3d board coordinates with toggle to hide or show them.png` | 355 KB | SAFE TO REMOVE |
| 4 | `screenshotsPlay/AI vs AI ready for play.png` | 347 KB | SAFE TO REMOVE |
| 5 | `screenshotsPlay/analyse your games here.png` | 324 KB | SAFE TO REMOVE |
| 6 | `screenshotsPlay/stockfish2.png` | 298 KB | SAFE TO REMOVE |
| 7 | `screenshotsPlay/stockfish1.png` | 266 KB | SAFE TO REMOVE |
| 8 | `screenshotsPlay/hard game in progress at 95 minutes on the clock.png` | 252 KB | SAFE TO REMOVE |
| 9 | `screenshotsPlay/game time and history.png` | 214 KB | SAFE TO REMOVE |
| 10 | `screenshotsPlay/checkmate example with export options improved including html.png` | 206 KB | SAFE TO REMOVE |
| 11 | `screenshotsPlay/checkmat example ai vs ai with ui expanded.png` | 196 KB | SAFE TO REMOVE |
| 12 | `screenshotsPlay/Why This Move - Basic Example.png` | 143 KB | SAFE TO REMOVE |
| 13 | `screenshotsPlay/BetterUi-AIvsAI.png` | 139 KB | SAFE TO REMOVE |
| 14 | `screenshotsPlay/en passant example with hint.png` | 165 KB | SAFE TO REMOVE |
| 15 | `screenshotsPlay/whit human vs black ai with history tracker and vert scrollbar.png` | 130 KB | SAFE TO REMOVE |
| 16 | `screenshotsPlay/BetterUi-HumanvsAI.png` | 130 KB | SAFE TO REMOVE |
| 17 | `screenshotsPlay/BetterUi-HumanvsAI-WithHintModeToGuideBeginners.png` | 129 KB | SAFE TO REMOVE |
| 18 | `screenshotsPlay/draw by threefold repitition.png` | 129 KB | SAFE TO REMOVE |
| 19 | `screenshotsPlay/OldUI.png` | 125 KB | SAFE TO REMOVE |
| 20 | `screenshotsPlay/BetterUi-HumanvsHuman.png` | 124 KB | SAFE TO REMOVE |
| 21 | `screenshotsPlay/checkmat example ai vs ai.png` | 106 KB | SAFE TO REMOVE |
| 22 | `screenshotsPlay/checkmate-with ambient music.png` | 154 KB | SAFE TO REMOVE |
| 23 | `screenshotsPlay/full game history example with export options in place.png` | 152 KB | SAFE TO REMOVE |
| 24 | `screenshotsPlay/Another GameOver With Summary ai vs ai.png` | 76 KB | SAFE TO REMOVE |
| 25 | `screenshotsPlay/full game history example with export options in place in plain english feature.png` | 58 KB | SAFE TO REMOVE |
| 26 | `screenshotsPlay/game history by side with piece and from to and color.png` | 17 KB | SAFE TO REMOVE |

**Suggestion:** If any screenshots are referenced in README.md, keep those specific ones. Move the rest to a GitHub Wiki, GitHub Release, or external hosting. Consider adding `screenshotsPlay/` to `.gitignore` after cleanup.

---

### 4.2 GRAPHICS DIRECTORY (8 files, ~2.64 MB) - MEDIUM RISK

| # | File | Size | Recommendation |
|---|---|---|---|
| 1 | `graphics/woodenchessboard.png` | 1.43 MB | REVIEW - Is this used in the app or just reference art? |
| 2 | `graphics/in-game-board-setup-with-debug mode on from White View.png` | 356 KB | SAFE TO REMOVE (debug screenshot, not app asset) |
| 3 | `graphics/in-game-board-setup.png` | 250 KB | SAFE TO REMOVE (screenshot, not app asset) |
| 4 | `graphics/in-game-board-setup-with-debug mode on.png` | 235 KB | SAFE TO REMOVE (debug screenshot) |
| 5 | `graphics/ScorpionChessEngineLogoWhiteBG.png` | 155 KB | REVIEW - May be used in docs or README |
| 6 | `graphics/ScorpionChessEngineLogo.png` | 146 KB | REVIEW - May be used in README or app |
| 7 | `graphics/BrainITChessAnalyzerLogo.png` | 99 KB | REVIEW - May be used in app |
| 8 | `graphics/BrainITChessGameEngineLogo.png` | 96 KB | REVIEW - May be used in app |

**Note:** Logos referenced by the app are in `public/assets/` (the correct location). The `graphics/` copies may be source/high-res versions. If not referenced from code or README, they can be removed.

---

### 4.3 STRAY ROOT-LEVEL FILES - MEDIUM RISK

| # | File | Size | Issue | Recommendation |
|---|---|---|---|---|
| 1 | `chess-one-shot-result-40minutes.png` | 57 KB | Random screenshot at repo root | SAFE TO REMOVE |
| 2 | `ScorpionChess_Git_CheatSheet.html` | 13 KB | Personal git reference, not project code | SAFE TO REMOVE (or move to docs/) |
| 3 | `bugtracker.md` | 593 B | Manual bug tracker with 2 resolved items | SAFE TO REMOVE (use GitHub Issues) |
| 4 | `bench_help.txt` | 2 B | Contains only `^C` - accidental terminal capture | SAFE TO REMOVE |
| 5 | `.vercel-redeploy-trigger.txt` | 10 B | Deployment trigger file containing "redeploy" | REVIEW - May be needed by Vercel CI/CD pipeline |
| 6 | `3D_Chess_PRD.md` | 12 KB | Product requirements doc in root | MOVE to `docs/` for better organization |

---

### 4.4 LARGE MEDIA ASSETS IN PUBLIC/ - MEDIUM RISK

These files ARE needed for the app to function, but are large and could potentially be hosted externally or optimized.

| # | File | Size | Recommendation |
|---|---|---|---|
| 1 | `public/assets/audio/a-way-out-294728.mp3` | 3.6 MB | REVIEW - Could use CDN hosting or compress further |
| 2 | `public/assets/chess/standard/chess-standard-pieces.blend` | 3.4 MB | SAFE TO REMOVE from remote - Blender source file, not needed at runtime. The exported `.glb` files are what the app uses. Keep locally for asset editing. |

**Runtime 3D assets (KEEP - required for app):**
- `public/assets/chess/standard/glb/*.glb` (6 files, ~1.3 MB total) - compiled 3D models
- `public/assets/chess/scifi/*.obj` (6 files, ~3.0 MB total) - SciFi chess pieces
- `public/assets/chess/scifi/*.png` (2 files, ~138 KB total) - textures

---

### 4.5 DUPLICATE FILES - MEDIUM RISK

| # | File A | File B | Status | Recommendation |
|---|---|---|---|---|
| 1 | `bin/HowToUse_Scorpion_Elo_Baseline.md` | `docs/HowToUse_Scorpion_Elo_Baseline.md` | **IDENTICAL** | Remove `bin/` copy, keep `docs/` copy |
| 2 | `public/player-user-guide.md` | `docs/player-user-guide.md` | **NEAR-DUPLICATE** (docs version has extra content appended) | Consolidate into one authoritative copy |

---

### 4.6 DOCS HTML FILES - LOW RISK

The `docs/` directory contains 5 HTML files that appear to be marketing/landing pages rather than developer documentation:

| # | File | Size | Recommendation |
|---|---|---|---|
| 1 | `docs/Dreaming_About_Becoming_a_Grand_Master_Chess_Engine_CTA_Logo_Full.html` | 4.6 KB | REVIEW - Marketing page, could move to separate hosting |
| 2 | `docs/Dreaming_About_Becoming_a_Grand_Master_Chess_Engine_Details.html` | 11 KB | REVIEW - Marketing page |
| 3 | `docs/Dreaming_About_Becoming_a_Grand_Master_Chess_Engine_Invitation.html` | 4.2 KB | REVIEW - Marketing page |
| 4 | `docs/Dreaming_About_Becoming_a_Grand_Master_Chess_Engine_Landing.html` | 4.7 KB | REVIEW - Marketing page |
| 5 | `docs/ScorpionSelfPlayAnalysisReport_Chunk1.html` | 8.2 KB | REVIEW - Generated report, could be regenerated |

**Note:** These are small files (total ~33 KB) and are low priority for removal.

---

### 4.7 BINARY EXECUTABLES (via LFS) - QUESTION

These are tracked via Git LFS and represent the largest portion of repo storage. They are unusual for a typical remote repo but may be intentional for this project.

| # | File | LFS Size | Question |
|---|---|---|---|
| 1 | `bin/ScorpionHeart.exe` | 80 MB | Is this the project's own compiled engine? If so, should it be distributed via GitHub Releases instead of checked into the repo? Every clone downloads this. |
| 2 | `bin/stockfish-windows-x86-64-avx2.exe` | 80 MB | This is a third-party binary (Stockfish). Could be downloaded on-demand via a setup script instead of stored in the repo. |

**Context:** These are used by the benchmark and self-play scripts (`bin/run_*.bat`). They are Windows-only (`.exe`). The CI/CD runs on `ubuntu-latest` and does not use these files.

**Options to consider:**
- Move to GitHub Releases and download via script
- Keep in LFS if team needs them immediately available after clone
- At minimum, both being the same hash (5f95eaea0d) is suspicious - verify they are actually different binaries

| # | File | Size | Notes |
|---|---|---|---|
| 3 | `bin/run_ab_weak10_and_report.bat` | ~1 KB | Windows batch runner |
| 4 | `bin/run_ab_weak10_b50_and_report.bat` | ~1 KB | Windows batch runner |
| 5 | `bin/run_ab_weak4_and_report.bat` | ~1 KB | Windows batch runner |
| 6 | `bin/run_benchmark_report.bat` | ~1 KB | Windows batch runner |
| 7 | `bin/run_benchmark_report_weak10_b50.bat` | ~1 KB | Windows batch runner |
| 8 | `bin/run_scorpion_baseline.bat` | ~1 KB | Windows batch runner |
| 9 | `bin/run_scorpion_sanity_explicit.bat` | ~1 KB | Windows batch runner |
| 10 | `bin/run_scorpion_sf_ladder.bat` | ~1 KB | Windows batch runner |
| 11 | `bin/run_scorpion_sf_ladder_weak10.bat` | ~1 KB | Windows batch runner |
| 12 | `bin/run_scorpion_sf_ladder_weak4.bat` | ~1 KB | Windows batch runner |
| 13 | `bin/run_scorpion_sf_ladder_weak6_swap.bat` | ~1 KB | Windows batch runner |

**Note on .bat files:** These are small text files and fine to keep. They are benchmark-related runner scripts.

---

### 4.8 NNUE WEIGHT FILE - KEEP

| File | Size | Verdict |
|---|---|---|
| `src/ai/nnue/weights/Scorpion-NNUE-Weight.snnue` | 193 KB | **KEEP** - This is the engine's trained neural network weight file. It's required for the chess engine to function. The generic `*.snnue` pattern is gitignored but this specific file is tracked intentionally. |

---

## 5. Files Explicitly Excluded from This Audit

Per owner request, the following are not flagged regardless of their nature:

| Directory/Pattern | Reason |
|---|---|
| `book/` | Book-related content, intentionally kept |
| `benchmarks/` | Benchmark-related content, intentionally kept |
| All benchmark-related scripts | Supporting infrastructure for benchmarks |

---

## 6. Summary: Recommended Actions

### Tier 1 - Safe to Delete (low risk, clear benefit)
| Action | Files | Space Saved |
|---|---|---|
| Remove `screenshotsPlay/` directory | 26 files | ~4.89 MB |
| Remove `chess-one-shot-result-40minutes.png` | 1 file | 57 KB |
| Remove `bench_help.txt` | 1 file | 2 B |
| Remove `bugtracker.md` | 1 file | 593 B |
| Remove `ScorpionChess_Git_CheatSheet.html` | 1 file | 13 KB |
| Remove duplicate `bin/HowToUse_Scorpion_Elo_Baseline.md` | 1 file | ~2 KB |
| Remove `public/assets/chess/standard/chess-standard-pieces.blend` | 1 file | 3.4 MB |
| Remove debug screenshots from `graphics/` | 3 files | ~841 KB |
| **Tier 1 Total** | **34 files** | **~9.2 MB** |

### Tier 2 - Review Before Deleting (need to verify usage)
| Action | Files | Space Saved |
|---|---|---|
| Review `graphics/` logo files (check if referenced in README/app) | 4 files | ~496 KB |
| Review `graphics/woodenchessboard.png` (check if used anywhere) | 1 file | 1.43 MB |
| Consolidate `public/player-user-guide.md` with `docs/player-user-guide.md` | 1 file | ~3 KB |
| Review `.vercel-redeploy-trigger.txt` (check if Vercel pipeline needs it) | 1 file | 10 B |
| Review `public/assets/audio/a-way-out-294728.mp3` (CDN alternative?) | 1 file | 3.6 MB |
| Review `docs/` HTML landing pages (move to external hosting?) | 5 files | ~33 KB |
| Move `3D_Chess_PRD.md` to `docs/` | 1 file | (reorg, no savings) |
| **Tier 2 Total** | **14 files** | ~5.6 MB |

### Tier 3 - Strategic Decision (large impact, needs team alignment)
| Action | Files | Space Saved (LFS) |
|---|---|---|
| Move `bin/ScorpionHeart.exe` to GitHub Releases | 1 file | 80 MB LFS |
| Move `bin/stockfish-windows-x86-64-avx2.exe` to GitHub Releases | 1 file | 80 MB LFS |
| **Tier 3 Total** | **2 files** | **~160 MB LFS** |

---

## 7. Suggested .gitignore Additions (After Cleanup)

If the above removals are performed, consider adding these patterns to `.gitignore`:

```gitignore
# Screenshots (if removed)
screenshotsPlay/

# Blender source files (keep exports, not source)
*.blend

# Accidental captures
bench_help.txt
```

---

## 8. Repository Health Score

| Category | Score | Notes |
|---|---|---|
| .gitignore coverage | 9/10 | Well configured, minor additions suggested |
| LFS usage | 8/10 | Correctly used for binaries; could move to Releases |
| No secrets/credentials | 10/10 | No .env, API keys, or credentials found |
| No IDE artifacts | 10/10 | Clean - no .vscode, .idea, etc. |
| Build artifacts excluded | 10/10 | dist/ and node_modules/ properly ignored |
| Asset management | 6/10 | Screenshots, duplicate files, Blender source add bloat |
| File organization | 7/10 | Some stray files in root, one duplicate doc |
| **Overall** | **8.5/10** | **Good hygiene with room for cleanup** |

---

*This is a read-only audit report. No files were modified, deleted, or moved during this audit.*
