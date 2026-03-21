#!/usr/bin/env python3
"""Extract NNUE training data from Lichess PGN files (zstd compressed).

Uses game results as evaluation labels:
  White win  → +400 cp (from side-to-move perspective)
  Draw       →    0 cp
  Black win  → -400 cp

Filters for quality:
  - Both players rated 1600+
  - Games with 10+ moves
  - Skip first 8 plies (opening book handles those)
  - Skip positions within 4 plies of game end (noisy)
  - Sample every 4th position to reduce correlation
"""
import argparse
import io
import json
import os
import random
import sys

import chess
import chess.pgn
import zstandard


RESULT_SCORE = {"1-0": 400, "0-1": -400, "1/2-1/2": 0}
MIN_ELO = 1600
SKIP_FIRST_PLY = 8
SKIP_LAST_PLY = 4
SAMPLE_EVERY = 4
MIN_MOVES = 10


def parse_args():
    parser = argparse.ArgumentParser(description="Extract NNUE training data from Lichess PGN")
    parser.add_argument("--input", required=True, help="Path to .pgn.zst file")
    parser.add_argument("--output", required=True, help="Output JSONL path")
    parser.add_argument("--maxGames", type=int, default=50000, help="Max games to process")
    parser.add_argument("--maxPositions", type=int, default=500000, help="Max positions to extract")
    parser.add_argument("--minElo", type=int, default=MIN_ELO)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def process_pgn(input_path, output_path, max_games, max_positions, min_elo, seed):
    rng = random.Random(seed)
    games_processed = 0
    games_skipped = 0
    positions_written = 0

    with open(input_path, "rb") as compressed:
        dctx = zstandard.ZstdDecompressor()
        reader = dctx.stream_reader(compressed)
        text_stream = io.TextIOWrapper(reader, encoding="utf-8", errors="replace")

        with open(output_path, "w", encoding="utf-8") as out:
            while games_processed < max_games and positions_written < max_positions:
                try:
                    game = chess.pgn.read_game(text_stream)
                except Exception:
                    continue
                if game is None:
                    break

                # Filter by result
                result = game.headers.get("Result", "*")
                if result not in RESULT_SCORE:
                    games_skipped += 1
                    continue

                # Filter by Elo
                try:
                    white_elo = int(game.headers.get("WhiteElo", "0"))
                    black_elo = int(game.headers.get("BlackElo", "0"))
                except ValueError:
                    games_skipped += 1
                    continue

                if white_elo < min_elo or black_elo < min_elo:
                    games_skipped += 1
                    continue

                # Walk through moves
                board = game.board()
                result_score_white = RESULT_SCORE[result]
                moves = list(game.mainline_moves())

                if len(moves) < MIN_MOVES * 2:
                    games_skipped += 1
                    continue

                total_plies = len(moves)
                game_id = games_processed + 1

                for ply, move in enumerate(moves):
                    board.push(move)

                    # Skip opening and endgame noise
                    if ply < SKIP_FIRST_PLY:
                        continue
                    if ply >= total_plies - SKIP_LAST_PLY:
                        continue

                    # Sample to reduce correlation
                    if ply % SAMPLE_EVERY != 0:
                        continue

                    # Skip positions in check (noisy for eval training)
                    if board.is_check():
                        continue

                    # Compute eval from side-to-move perspective
                    eval_cp = result_score_white if board.turn == chess.WHITE else -result_score_white

                    # Add some noise to prevent overfitting to exact ±400
                    eval_cp += rng.randint(-50, 50)

                    fen = board.fen()
                    record = {
                        "gameId": game_id,
                        "ply": ply + 1,
                        "fen": fen,
                        "evalCp": eval_cp,
                        "mateIn": None,
                        "bestMoveUci": None,
                        "pv": None,
                    }
                    out.write(json.dumps(record) + "\n")
                    positions_written += 1

                    if positions_written >= max_positions:
                        break

                games_processed += 1
                if games_processed % 1000 == 0:
                    print(f"  Processed {games_processed} games, {positions_written} positions, skipped {games_skipped}")

    print(f"Done: {games_processed} games, {positions_written} positions extracted, {games_skipped} skipped")

    # Write minimal summary
    summary = {"buckets": {"lichess": positions_written}, "totalGames": games_processed}
    with open(output_path + ".summary.json", "w") as f:
        json.dump(summary, f)


def main():
    args = parse_args()
    print(f"Extracting from {args.input} (max {args.maxGames} games, {args.maxPositions} positions, min Elo {args.minElo})")
    process_pgn(args.input, args.output, args.maxGames, args.maxPositions, args.minElo, args.seed)


if __name__ == "__main__":
    main()
