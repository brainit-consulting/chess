#!/usr/bin/env python3
"""Annotate positions with Stockfish evaluations for NNUE training.

Reads FENs from a JSONL file, runs Stockfish on each position,
and outputs a new JSONL with engine eval labels.
"""
import argparse
import json
import subprocess
import sys
import time


STOCKFISH_PATH = r"C:\Users\snake\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe"


def parse_args():
    parser = argparse.ArgumentParser(description="Annotate positions with Stockfish")
    parser.add_argument("--input", required=True, help="Input JSONL with {fen, ...}")
    parser.add_argument("--output", required=True, help="Output JSONL with evalCp from Stockfish")
    parser.add_argument("--stockfish", default=STOCKFISH_PATH, help="Path to Stockfish binary")
    parser.add_argument("--depth", type=int, default=12, help="Stockfish search depth")
    parser.add_argument("--maxPositions", type=int, default=100000)
    parser.add_argument("--threads", type=int, default=1)
    parser.add_argument("--hash", type=int, default=128, help="Hash table size in MB")
    return parser.parse_args()


class StockfishProcess:
    def __init__(self, path, threads=1, hash_mb=128):
        self.proc = subprocess.Popen(
            [path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
        )
        self._send("uci")
        self._wait_for("uciok")
        self._send(f"setoption name Threads value {threads}")
        self._send(f"setoption name Hash value {hash_mb}")
        self._send("isready")
        self._wait_for("readyok")

    def _send(self, cmd):
        self.proc.stdin.write(cmd + "\n")
        self.proc.stdin.flush()

    def _wait_for(self, token):
        while True:
            line = self.proc.stdout.readline().strip()
            if token in line:
                return line

    def evaluate(self, fen, depth):
        self._send("ucinewgame")
        self._send(f"position fen {fen}")
        self._send(f"go depth {depth}")

        eval_cp = None
        mate_in = None
        best_move = None

        while True:
            line = self.proc.stdout.readline().strip()
            if line.startswith("bestmove"):
                parts = line.split()
                best_move = parts[1] if len(parts) > 1 else None
                break
            if "score cp" in line and "upperbound" not in line and "lowerbound" not in line:
                idx = line.index("score cp") + len("score cp ")
                rest = line[idx:].split()
                eval_cp = int(rest[0])
            elif "score mate" in line and "upperbound" not in line and "lowerbound" not in line:
                idx = line.index("score mate") + len("score mate ")
                rest = line[idx:].split()
                mate_in = int(rest[0])
                eval_cp = 10000 * (1 if mate_in > 0 else -1)

        return eval_cp, mate_in, best_move

    def close(self):
        self._send("quit")
        self.proc.wait(timeout=5)


def main():
    args = parse_args()
    print(f"Loading positions from {args.input}...")

    # Load FENs
    positions = []
    with open(args.input) as f:
        for line in f:
            row = json.loads(line)
            fen = row.get("fen")
            if fen and row.get("mateIn") is None:
                positions.append(row)
            if len(positions) >= args.maxPositions:
                break

    print(f"Loaded {len(positions)} positions. Starting Stockfish (depth={args.depth})...")
    sf = StockfishProcess(args.stockfish, args.threads, args.hash)

    annotated = 0
    skipped = 0
    start = time.time()

    with open(args.output, "w") as out:
        for i, row in enumerate(positions):
            fen = row["fen"]
            try:
                eval_cp, mate_in, best_move = sf.evaluate(fen, args.depth)
            except Exception as e:
                print(f"Error on position {i}: {e}")
                skipped += 1
                continue

            if eval_cp is None:
                skipped += 1
                continue

            # Skip extreme evals (mate territory)
            if abs(eval_cp) > 5000:
                skipped += 1
                continue

            record = {
                "gameId": row.get("gameId", i + 1),
                "ply": row.get("ply", 0),
                "fen": fen,
                "evalCp": eval_cp,
                "mateIn": mate_in,
                "bestMoveUci": best_move,
                "pv": None,
            }
            out.write(json.dumps(record) + "\n")
            annotated += 1

            if (i + 1) % 1000 == 0:
                elapsed = time.time() - start
                rate = (i + 1) / elapsed
                eta = (len(positions) - i - 1) / rate
                print(f"  {i+1}/{len(positions)} ({rate:.1f} pos/s, ETA {eta:.0f}s) — annotated {annotated}, skipped {skipped}")

    sf.close()
    elapsed = time.time() - start
    print(f"Done: {annotated} annotated, {skipped} skipped in {elapsed:.1f}s")

    # Write summary
    summary = {"buckets": {"stockfish": annotated}, "totalPositions": annotated}
    with open(args.output + ".summary.json", "w") as f:
        json.dump(summary, f)


if __name__ == "__main__":
    main()
