/**
 * Opening book for Max difficulty.
 *
 * Positions are keyed by a FEN-like string (board + active color + castling rights,
 * omitting en passant, halfmove clock, and fullmove number).  Each position maps
 * to an array of candidate moves so the engine can vary its play via the seeded RNG.
 *
 * Coordinate system: file 0-7 = a-h, rank 0-7 = 1-8.
 */

import type { GameState, Move } from '../rules';

// ---------------------------------------------------------------------------
// FEN key generation
// ---------------------------------------------------------------------------

/**
 * Generate a position key for book lookup.
 * We intentionally omit the en passant square: in the opening, it almost
 * never affects the best move choice, and omitting it avoids the need to
 * track EP state through every book line.
 */
function boardToFenKey(state: GameState): string {
  const rows: string[] = [];
  // FEN starts from rank 8 (index 7) down to rank 1 (index 0)
  for (let rank = 7; rank >= 0; rank--) {
    let empty = 0;
    let row = '';
    for (let file = 0; file < 8; file++) {
      const id = state.board[rank][file];
      if (!id) {
        empty++;
        continue;
      }
      if (empty > 0) {
        row += empty;
        empty = 0;
      }
      const piece = state.pieces.get(id);
      if (!piece) {
        empty++;
        continue;
      }
      const charMap: Record<string, string> = {
        pawn: 'p',
        knight: 'n',
        bishop: 'b',
        rook: 'r',
        queen: 'q',
        king: 'k'
      };
      const c = charMap[piece.type] ?? 'p';
      row += piece.color === 'w' ? c.toUpperCase() : c;
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }

  const board = rows.join('/');
  const active = state.activeColor;

  let castling = '';
  if (state.castlingRights.wK) castling += 'K';
  if (state.castlingRights.wQ) castling += 'Q';
  if (state.castlingRights.bK) castling += 'k';
  if (state.castlingRights.bQ) castling += 'q';
  if (!castling) castling = '-';

  // En passant is intentionally omitted from the key (see doc above)
  return `${board} ${active} ${castling}`;
}

// ---------------------------------------------------------------------------
// Move helpers (algebraic → engine Move)
// ---------------------------------------------------------------------------

/** Parse a move string like "e2e4", "e1g1" (castle), "e7e8q" (promotion) */
function m(notation: string, flags?: { isCastle?: boolean }): Move {
  const fromFile = notation.charCodeAt(0) - 97; // 'a' = 0
  const fromRank = parseInt(notation[1]) - 1;
  const toFile = notation.charCodeAt(2) - 97;
  const toRank = parseInt(notation[3]) - 1;
  const move: Move = {
    from: { file: fromFile, rank: fromRank },
    to: { file: toFile, rank: toRank }
  };
  if (notation.length === 5) {
    const promoMap: Record<string, string> = {
      q: 'queen',
      r: 'rook',
      b: 'bishop',
      n: 'knight'
    };
    move.promotion = (promoMap[notation[4]] ?? 'queen') as Move['promotion'];
  }
  if (flags?.isCastle) {
    move.isCastle = true;
  }
  return move;
}

// ---------------------------------------------------------------------------
// Opening book data
// ---------------------------------------------------------------------------

type BookEntry = Move[];

/**
 * Map from FEN position key (no halfmove/fullmove) to candidate moves.
 *
 * Built by walking known opening lines move-by-move and recording the
 * resulting FEN after each ply together with good continuations.
 */
const OPENING_BOOK: Map<string, BookEntry> = new Map();

function addEntry(fen: string, moves: Move[]): void {
  const existing = OPENING_BOOK.get(fen);
  if (existing) {
    // Merge, avoiding duplicates
    for (const mv of moves) {
      const isDup = existing.some(
        (e) =>
          e.from.file === mv.from.file &&
          e.from.rank === mv.from.rank &&
          e.to.file === mv.to.file &&
          e.to.rank === mv.to.rank &&
          e.promotion === mv.promotion
      );
      if (!isDup) existing.push(mv);
    }
  } else {
    OPENING_BOOK.set(fen, [...moves]);
  }
}

// ===========================
// STARTING POSITION (White)
// ===========================
// 1. e4, 1. d4, 1. c4, 1. Nf3
addEntry('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq', [
  m('e2e4'),
  m('d2d4'),
  m('c2c4'),
  m('g1f3')
]);

// ===========================
// AFTER 1. e4 (Black responses)
// ===========================
// 1...e5 (Open Game), 1...c5 (Sicilian), 1...e6 (French), 1...c6 (Caro-Kann), 1...d5 (Scandinavian)
addEntry('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq', [
  m('e7e5'),
  m('c7c5'),
  m('e7e6'),
  m('c7c6')
]);

// ===========================
// 1. e4 e5 — OPEN GAME
// ===========================
// White: 2. Nf3, 2. Bc4
addEntry('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq', [
  m('g1f3'),
  m('f1c4')
]);

// After 2. Nf3 — Black: 2...Nc6
addEntry('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq', [
  m('b8c6'),
  m('g8f6') // Petrov
]);

// After 2. Nf3 Nc6 — White: 3. Bb5 (Ruy Lopez), 3. Bc4 (Italian), 3. d4 (Scotch)
addEntry('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq', [
  m('f1b5'),
  m('f1c4'),
  m('d2d4')
]);

// ===========================
// RUY LOPEZ (3. Bb5)
// ===========================
// After 3. Bb5 — Black: 3...a6 (Morphy Defense), 3...Nf6 (Berlin)
addEntry('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq', [
  m('a7a6'),
  m('g8f6')
]);

// After 3...a6 4. Ba4
addEntry('r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq', [
  m('b5a4')
]);

// After 4. Ba4 — Black: 4...Nf6
addEntry('r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq', [
  m('g8f6'),
  m('b7b5')
]);

// After 4. Ba4 Nf6 5. O-O (castling kingside)
addEntry('r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq', [
  m('e1g1', { isCastle: true })
]);

// After 5. O-O — Black: 5...Be7 (Closed Ruy Lopez), 5...Nxe4 (Open Ruy Lopez)
addEntry('r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq', [
  m('f8e7'),
  m('f6e4')
]);

// Closed Ruy: 5...Be7 6. Re1
addEntry('r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq', [
  m('f1e1'),
  m('d2d3')
]);

// 6. Re1 b5 7. Bb3
addEntry('r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 b kq', [
  m('b7b5')
]);

addEntry('r1bqk2r/2ppbppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 w kq', [
  m('a4b3')
]);

// 7. Bb3 d6 8. c3
addEntry('r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq', [
  m('d7d6'),
  m('e8g8', { isCastle: true })
]);

addEntry('r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w kq', [
  m('c2c3'),
  m('h2h3')
]);

// ===========================
// ITALIAN GAME (3. Bc4)
// ===========================
// After 3. Bc4 — Black: 3...Bc5 (Giuoco Piano), 3...Nf6 (Two Knights)
addEntry('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq', [
  m('f8c5'),
  m('g8f6')
]);

// Giuoco Piano: 3...Bc5 4. c3 (main), 4. d3 (Giuoco Pianissimo)
addEntry('r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq', [
  m('c2c3'),
  m('d2d3')
]);

// 4. c3 Nf6 5. d4
addEntry('r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq', [
  m('g8f6'),
  m('d7d6')
]);

addEntry('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq', [
  m('d2d4')
]);

// Two Knights: 3...Nf6 4. d3 (quiet), 4. Ng5 (sharp)
// Ng5: knight on f3 (file 5, rank 2) to g5 (file 6, rank 4) — delta (1,2), valid
addEntry('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq', [
  m('d2d3'),
  m('f3g5')
]);

// Giuoco Pianissimo: 4. d3 Nf6 5. O-O
addEntry('r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq', [
  m('g8f6'),
  m('d7d6')
]);

addEntry('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq', [
  m('e1g1', { isCastle: true }),
  m('c2c3')
]);

// ===========================
// SCOTCH GAME (3. d4)
// ===========================
// After 3. d4 exd4 4. Nxd4
addEntry('r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq', [
  m('e5d4')
]);

addEntry('r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq', [
  m('f3d4')
]);

// After 4. Nxd4 — Black: 4...Nf6, 4...Bc5
addEntry('r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq', [
  m('g8f6'),
  m('f8c5')
]);

// ===========================
// PETROV DEFENSE (2...Nf6)
// ===========================
// After 2. Nf3 Nf6 3. Nxe5 (or 3. d4)
addEntry('rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq', [
  m('f3e5'),
  m('d2d4')
]);

// After 3. Nxe5 d6 4. Nf3
addEntry('rnbqkb1r/pppp1ppp/5n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq', [
  m('d7d6')
]);

addEntry('rnbqkb1r/ppp2ppp/3p1n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq', [
  m('f6e4')
]);

// ===========================
// SICILIAN DEFENSE (1...c5)
// ===========================
// After 1. e4 c5 — White: 2. Nf3 (Open), 2. Nc3 (Closed), 2. c3 (Alapin)
addEntry('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq', [
  m('g1f3'),
  m('b1c3'),
  m('c2c3')
]);

// Open Sicilian: 2. Nf3 — Black: 2...d6 (Najdorf/Dragon), 2...Nc6 (Classical), 2...e6 (Scheveningen/Kan)
addEntry('rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq', [
  m('d7d6'),
  m('b8c6'),
  m('e7e6')
]);

// After 2...d6 3. d4
addEntry('rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq', [
  m('d2d4')
]);

// After 3. d4 cxd4 4. Nxd4
addEntry('rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq', [
  m('f3d4')
]);

// After 4. Nxd4 — Black: 4...Nf6 (main)
addEntry('rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq', [
  m('g8f6')
]);

// After 4...Nf6 5. Nc3 — Black: 5...a6 (Najdorf), 5...g6 (Dragon), 5...Nc6 (Classical)
addEntry('rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq', [
  m('b1c3')
]);

addEntry('rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq', [
  m('a7a6'),
  m('g7g6'),
  m('b8c6')
]);

// Najdorf: 5...a6 6. Be2 (or 6. Bg5, 6. Be3)
addEntry('rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq', [
  m('f1e2'),
  m('c1g5'),
  m('c1e3')
]);

// Najdorf: 6. Be2 e5 7. Nb3
addEntry('rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP1BPPP/R1BQK2R b KQkq', [
  m('e7e5')
]);

addEntry('rnbqkb1r/1p3ppp/p2p1n2/4p3/3NP3/2N5/PPP1BPPP/R1BQK2R w KQkq', [
  m('d4b3')
]);

// Dragon: 5...g6 6. Be3 (Yugoslav Attack)
addEntry('rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq', [
  m('c1e3'),
  m('f1e2')
]);

// Dragon: 6. Be3 Bg7 7. f3
addEntry('rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R b KQkq', [
  m('f8g7')
]);

addEntry('rnbqk2r/pp2ppbp/3p1np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R w KQkq', [
  m('f2f3')
]);

// After 2...Nc6 3. d4 cxd4 4. Nxd4
addEntry('r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq', [
  m('d2d4')
]);

addEntry('r1bqkbnr/pp1ppppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq', [
  m('f3d4')
]);

// After 2...e6 3. d4 cxd4 4. Nxd4
addEntry('rnbqkbnr/pp1p1ppp/4p3/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq', [
  m('d2d4')
]);

// Alapin: 2. c3 — Black: 2...Nf6, 2...d5
addEntry('rnbqkbnr/pp1ppppp/8/2p5/4P3/2P5/PP1P1PPP/RNBQKBNR b KQkq', [
  m('g8f6'),
  m('d7d5')
]);

// ===========================
// FRENCH DEFENSE (1...e6)
// ===========================
// After 1. e4 e6 — White: 2. d4
addEntry('rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq', [
  m('d2d4')
]);

// After 2. d4 d5 — White: 3. Nc3 (Classical/Winawer), 3. Nd2 (Tarrasch), 3. e5 (Advance)
addEntry('rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq', [
  m('b1c3'),
  m('b1d2'),
  m('e4e5')
]);

// Advance French: 3. e5 c5
addEntry('rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq', [
  m('c7c5')
]);

// 4. c3
addEntry('rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/8/PPP2PPP/RNBQKBNR w KQkq', [
  m('c2c3'),
  m('g1f3')
]);

// Classical French: 3. Nc3 Nf6 4. Bg5 (or 4. e5)
addEntry('rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq', [
  m('g8f6'),
  m('f8b4') // Winawer
]);

addEntry('rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq', [
  m('c1g5'),
  m('e4e5')
]);

// Winawer: 3...Bb4 4. e5
addEntry('rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR w KQkq', [
  m('e4e5')
]);

// ===========================
// CARO-KANN DEFENSE (1...c6)
// ===========================
// After 1. e4 c6 — White: 2. d4
addEntry('rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq', [
  m('d2d4')
]);

// After 2. d4 d5 — White: 3. Nc3 (Classical), 3. e5 (Advance), 3. exd5 (Exchange)
addEntry('rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq', [
  m('b1c3'),
  m('e4e5'),
  m('e4d5')
]);

// Classical: 3. Nc3 dxe4 4. Nxe4
addEntry('rnbqkbnr/pp2pppp/2p5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq', [
  m('d5e4')
]);

addEntry('rnbqkbnr/pp2pppp/2p5/8/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq', [
  m('c3e4')
]);

// After 4. Nxe4 — Black: 4...Bf5 (main), 4...Nd7 (Modern)
addEntry('rnbqkbnr/pp2pppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR b KQkq', [
  m('c8f5'),
  m('b8d7')
]);

// 4...Bf5 5. Ng3 Bg6
addEntry('rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq', [
  m('e4g3')
]);

addEntry('rn1qkbnr/pp2pppp/2p5/5b2/3P4/6N1/PPP2PPP/R1BQKBNR b KQkq', [
  m('f5g6')
]);

// Advance Caro-Kann: 3. e5 Bf5
addEntry('rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq', [
  m('c8f5')
]);

// ===========================
// 1. d4 — QUEEN'S PAWN
// ===========================
// After 1. d4 — Black: 1...d5, 1...Nf6
addEntry('rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq', [
  m('d7d5'),
  m('g8f6')
]);

// After 1. d4 d5 — White: 2. c4 (Queen's Gambit), 2. Nf3
addEntry('rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq', [
  m('c2c4'),
  m('g1f3')
]);

// ===========================
// QUEEN'S GAMBIT (2. c4)
// ===========================
// After 2. c4 — Black: 2...e6 (QGD), 2...c6 (Slav), 2...dxc4 (QGA)
addEntry('rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq', [
  m('e7e6'),
  m('c7c6'),
  m('d5c4')
]);

// QGD: 2...e6 3. Nc3 (or 3. Nf3)
addEntry('rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq', [
  m('b1c3'),
  m('g1f3')
]);

// 3. Nc3 Nf6 4. Bg5 (or 4. cxd5, 4. Nf3)
addEntry('rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq', [
  m('g8f6')
]);

addEntry('rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq', [
  m('c1g5'),
  m('c4d5'),
  m('g1f3')
]);

// 4. Bg5 Be7 5. e3
addEntry('rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq', [
  m('f8e7')
]);

addEntry('rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR w KQkq', [
  m('e2e3'),
  m('g1f3')
]);

// 5. e3 O-O 6. Nf3
addEntry('rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR b KQkq', [
  m('e8g8', { isCastle: true })
]);

addEntry('rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR w KQ', [
  m('g1f3')
]);

// Slav: 2...c6 3. Nf3 Nf6 4. Nc3
addEntry('rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq', [
  m('g1f3'),
  m('b1c3')
]);

addEntry('rnbqkbnr/pp2pppp/2p5/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq', [
  m('g8f6')
]);

addEntry('rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq', [
  m('b1c3')
]);

// QGA: 2...dxc4 3. Nf3 (or 3. e4)
addEntry('rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq', [
  m('g1f3'),
  m('e2e4')
]);

// 3. Nf3 Nf6 4. e3
addEntry('rnbqkbnr/ppp1pppp/8/8/2pP4/5N2/PP2PPPP/RNBQKB1R b KQkq', [
  m('g8f6')
]);

addEntry('rnbqkb1r/ppp1pppp/5n2/8/2pP4/5N2/PP2PPPP/RNBQKB1R w KQkq', [
  m('e2e3')
]);

// ===========================
// 1. d4 Nf6 — INDIAN DEFENSES
// ===========================
// After 1. d4 Nf6 — White: 2. c4
addEntry('rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq', [
  m('c2c4')
]);

// After 2. c4 — Black: 2...g6 (KID/Grunfeld), 2...e6 (Nimzo/QID)
addEntry('rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq', [
  m('g7g6'),
  m('e7e6')
]);

// ===========================
// KING'S INDIAN DEFENSE
// ===========================
// After 2...g6 3. Nc3 Bg7
addEntry('rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq', [
  m('b1c3')
]);

addEntry('rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq', [
  m('f8g7')
]);

// After 3...Bg7 4. e4 d6 5. Nf3 O-O (Main line KID)
addEntry('rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq', [
  m('e2e4')
]);

addEntry('rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq', [
  m('d7d6')
]);

addEntry('rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq', [
  m('g1f3'),
  m('f1e2')
]);

addEntry('rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq', [
  m('e8g8', { isCastle: true })
]);

// After 5...O-O 6. Be2 e5 (classical) or 6...c5
addEntry('rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQ', [
  m('f1e2')
]);

addEntry('rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ', [
  m('e7e5'),
  m('c7c5')
]);

// 6...e5 7. O-O
addEntry('rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ', [
  m('e1g1', { isCastle: true })
]);

// 7. O-O Nc6 8. d5
addEntry('rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 b -', [
  m('b8c6')
]);

addEntry('r1bq1rk1/ppp2pbp/2np1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 w -', [
  m('d4d5')
]);

// ===========================
// NIMZO-INDIAN (1.d4 Nf6 2.c4 e6 3.Nc3 Bb4)
// ===========================
addEntry('rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq', [
  m('b1c3'),
  m('g1f3')
]);

addEntry('rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq', [
  m('f8b4'), // Nimzo-Indian
  m('b7b6') // Queen's Indian
]);

// After 3...Bb4 4. Qc2 (or 4. e3)
addEntry('rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq', [
  m('d1c2'),
  m('e2e3')
]);

// 4. Qc2 O-O 5. a3
addEntry('rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PPQ1PPPP/R1B1KBNR b KQkq', [
  m('e8g8', { isCastle: true }),
  m('d7d5')
]);

// 4. e3 O-O 5. Bd3
addEntry('rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR b KQkq', [
  m('e8g8', { isCastle: true })
]);

addEntry('rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR w KQ', [
  m('f1d3')
]);

// ===========================
// QUEEN'S INDIAN (1.d4 Nf6 2.c4 e6 3.Nf3 b6)
// ===========================
addEntry('rnbqkb1r/pppp1ppp/4pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq', [
  m('b7b6'),
  m('f8b4') // Bogo-Indian
]);

// After 3...b6 4. g3 (Fianchetto system)
addEntry('rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq', [
  m('g2g3'),
  m('a2a3')
]);

// ===========================
// GRUNFELD DEFENSE
// ===========================
// After 1.d4 Nf6 2.c4 g6 3.Nc3 d5 (Grunfeld)
addEntry('rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq', [
  m('f8g7'), // KID
  m('d7d5') // Grunfeld
]);

// After 3...d5 4. cxd5 Nxd5
addEntry('rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq', [
  m('c4d5')
]);

addEntry('rnbqkb1r/ppp1pp1p/6p1/3n4/3P4/2N5/PP2PPPP/R1BQKBNR w KQkq', [
  m('e2e4')
]);

// ===========================
// ENGLISH OPENING (1. c4)
// ===========================
// After 1. c4 — Black: 1...e5 (Reversed Sicilian), 1...Nf6, 1...c5 (Symmetrical)
addEntry('rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq', [
  m('e7e5'),
  m('g8f6'),
  m('c7c5')
]);

// After 1. c4 e5 2. Nc3
addEntry('rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR w KQkq', [
  m('b1c3'),
  m('g2g3')
]);

// 2. Nc3 Nf6 3. Nf3
addEntry('rnbqkbnr/pppp1ppp/8/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR b KQkq', [
  m('g8f6')
]);

addEntry('rnbqkb1r/pppp1ppp/5n2/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR w KQkq', [
  m('g1f3')
]);

// After 1. c4 Nf6 2. Nc3
addEntry('rnbqkb1r/pppppppp/5n2/8/2P5/8/PP1PPPPP/RNBQKBNR w KQkq', [
  m('b1c3')
]);

// After 1. c4 c5 2. Nf3
addEntry('rnbqkbnr/pp1ppppp/8/2p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq', [
  m('g1f3'),
  m('b1c3')
]);

// ===========================
// RETI OPENING (1. Nf3)
// ===========================
// After 1. Nf3 — Black: 1...d5, 1...Nf6
addEntry('rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq', [
  m('d7d5'),
  m('g8f6')
]);

// After 1. Nf3 d5 2. g3 (or 2. c4)
addEntry('rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKB1R w KQkq', [
  m('g2g3'),
  m('c2c4')
]);

// ===========================
// LONDON SYSTEM (1. d4 d5 2. Nf3 Nf6 3. Bf4)
// ===========================
addEntry('rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq', [
  m('g8f6')
]);

addEntry('rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R w KQkq', [
  m('c1f4'),
  m('c2c4')
]);

// London: 3. Bf4 c5 4. e3
addEntry('rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/5N2/PPP1PPPP/RN1QKB1R b KQkq', [
  m('c7c5'),
  m('e7e6')
]);

addEntry('rnbqkb1r/pp2pppp/5n2/2pp4/3P1B2/5N2/PPP1PPPP/RN1QKB1R w KQkq', [
  m('e2e3')
]);

// ---------------------------------------------------------------------------
// Lookup function
// ---------------------------------------------------------------------------

/**
 * Look up the current position in the opening book.
 * Returns a randomly chosen book move (using the provided rng), or null if
 * the position is not in the book.
 */
export function lookupBookMove(state: GameState, rng: () => number): Move | null {
  const key = boardToFenKey(state);
  const candidates = OPENING_BOOK.get(key);
  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Pick a random candidate
  const index = Math.floor(rng() * candidates.length);
  return candidates[index];
}
