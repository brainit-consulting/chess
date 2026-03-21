#!/usr/bin/env python3
"""Simple NNUE trainer that works with FEN + evalCp JSONL data.

No dependency on annotated game files, timeout maps, or run IDs.
Just reads {fen, evalCp} records and trains.
"""
import argparse
import json
import math
import os
import random
import struct
from typing import List, Tuple

MAGIC = b"SNN1"
VERSION = 1
FLAGS = 0
INPUT_SIZE = 768
HIDDEN_SIZE = 64
RELU_CAP = 127.0

PIECE_TYPE_INDEX = {"p": 0, "n": 1, "b": 2, "r": 3, "q": 4, "k": 5}


def parse_args():
    parser = argparse.ArgumentParser(description="Simple NNUE trainer")
    parser.add_argument("--dataset", required=True, help="JSONL with {fen, evalCp}")
    parser.add_argument("--out", required=True, help="Output .snnue weights file")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--huberDelta", type=float, default=150.0)
    parser.add_argument("--minEpochs", type=int, default=8)
    parser.add_argument("--patience", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--maxSamples", type=int, default=None)
    parser.add_argument("--valSplit", type=float, default=0.1)
    return parser.parse_args()


def fen_to_features(fen: str) -> List[int]:
    """Convert FEN to sparse feature indices (768-dim input)."""
    parts = fen.split()
    board_str = parts[0]
    active = parts[1] if len(parts) > 1 else "w"

    features = []
    rank = 7
    file = 0
    for ch in board_str:
        if ch == "/":
            rank -= 1
            file = 0
        elif ch.isdigit():
            file += int(ch)
        else:
            color_offset = 0 if ch.isupper() else 6
            piece_idx = PIECE_TYPE_INDEX.get(ch.lower())
            if piece_idx is not None:
                square = rank * 8 + file
                feature = (color_offset + piece_idx) * 64 + square
                features.append(feature)
            file += 1

    return features


class NnueModel:
    def __init__(self, input_size, hidden_size, seed):
        rng = random.Random(seed)
        scale = math.sqrt(2.0 / input_size)
        self.w1 = [[rng.gauss(0, scale) for _ in range(hidden_size)] for _ in range(input_size)]
        self.b1 = [0.0] * hidden_size
        self.w2 = [rng.gauss(0, math.sqrt(2.0 / hidden_size)) for _ in range(hidden_size)]
        self.b2 = 0.0
        self.input_size = input_size
        self.hidden_size = hidden_size

    def forward(self, features: List[int]) -> Tuple[float, List[float]]:
        hidden = list(self.b1)
        for f in features:
            for j in range(self.hidden_size):
                hidden[j] += self.w1[f][j]
        # Clipped ReLU
        clipped = [max(0.0, min(RELU_CAP, h)) for h in hidden]
        out = self.b2
        for j in range(self.hidden_size):
            out += self.w2[j] * clipped[j]
        return out, clipped

    def train_batch(self, batch, lr, huber_delta):
        """Train on a mini-batch, accumulating gradients before applying."""
        batch_size = len(batch)
        if batch_size == 0:
            return 0.0

        # Accumulate gradients
        gw1 = {}  # sparse: (feature, j) -> grad
        gb1 = [0.0] * self.hidden_size
        gw2 = [0.0] * self.hidden_size
        gb2 = 0.0
        total_loss = 0.0

        for features, target in batch:
            pred, clipped = self.forward(features)
            diff = pred - target

            if abs(diff) <= huber_delta:
                grad = diff
                loss = 0.5 * diff * diff
            else:
                grad = huber_delta * (1.0 if diff > 0 else -1.0)
                loss = huber_delta * (abs(diff) - 0.5 * huber_delta)
            total_loss += loss

            gb2 += grad
            for j in range(self.hidden_size):
                if clipped[j] > 0:
                    gw2[j] += grad * clipped[j]
                    dh = grad * self.w2[j]
                    gb1[j] += dh
                    for f in features:
                        key = (f, j)
                        gw1[key] = gw1.get(key, 0.0) + dh

        # Apply averaged gradients
        scale = lr / batch_size
        self.b2 -= scale * gb2
        for j in range(self.hidden_size):
            self.w2[j] -= scale * gw2[j]
            self.b1[j] -= scale * gb1[j]
        for (f, j), g in gw1.items():
            self.w1[f][j] -= scale * g

        return total_loss

    def save(self, path):
        with open(path, "wb") as f:
            f.write(MAGIC)
            f.write(struct.pack("<HHHH", self.input_size, self.hidden_size, VERSION, FLAGS))
            for i in range(self.input_size):
                for j in range(self.hidden_size):
                    f.write(struct.pack("<f", self.w1[i][j]))
            for j in range(self.hidden_size):
                f.write(struct.pack("<f", self.b1[j]))
            for j in range(self.hidden_size):
                f.write(struct.pack("<f", self.w2[j]))
            f.write(struct.pack("<f", self.b2))

    def snapshot(self):
        import copy
        return {
            "w1": [row[:] for row in self.w1],
            "b1": self.b1[:],
            "w2": self.w2[:],
            "b2": self.b2,
        }

    def restore(self, snap):
        self.w1 = [row[:] for row in snap["w1"]]
        self.b1 = snap["b1"][:]
        self.w2 = snap["w2"][:]
        self.b2 = snap["b2"]


def main():
    args = parse_args()
    rng = random.Random(args.seed)

    # Load data
    print(f"Loading data from {args.dataset}...")
    samples = []
    with open(args.dataset) as f:
        for line in f:
            row = json.loads(line)
            fen = row.get("fen")
            eval_cp = row.get("evalCp")
            if fen is None or eval_cp is None:
                continue
            if row.get("mateIn") is not None:
                continue
            features = fen_to_features(fen)
            samples.append((features, float(eval_cp)))

    if args.maxSamples and len(samples) > args.maxSamples:
        rng.shuffle(samples)
        samples = samples[:args.maxSamples]

    print(f"Loaded {len(samples)} samples")

    # Split train/val by index
    rng.shuffle(samples)
    val_size = int(len(samples) * args.valSplit)
    val = samples[:val_size]
    train = samples[val_size:]
    print(f"Train: {len(train)}, Val: {len(val)}")

    # Train
    model = NnueModel(INPUT_SIZE, HIDDEN_SIZE, args.seed)
    best_val = math.inf
    best_epoch = 0
    best_snap = None
    patience_left = args.patience

    batch_size = 64
    for epoch in range(1, args.epochs + 1):
        rng.shuffle(train)
        train_loss = 0.0
        for i in range(0, len(train), batch_size):
            batch = train[i:i + batch_size]
            train_loss += model.train_batch(batch, args.lr, args.huberDelta)
        train_loss /= len(train)

        val_loss = 0.0
        for features, target in val:
            pred, _ = model.forward(features)
            diff = pred - target
            if abs(diff) <= args.huberDelta:
                val_loss += 0.5 * diff * diff
            else:
                val_loss += args.huberDelta * (abs(diff) - 0.5 * args.huberDelta)
        val_loss /= len(val)

        print(f"Epoch {epoch}: train={train_loss:.1f} val={val_loss:.1f}")

        if val_loss < best_val:
            best_val = val_loss
            best_epoch = epoch
            best_snap = model.snapshot()
            patience_left = args.patience
        else:
            if epoch >= args.minEpochs:
                patience_left -= 1
                if patience_left <= 0:
                    print(f"Early stop at epoch {epoch}. Best epoch {best_epoch}.")
                    break

    if best_snap:
        model.restore(best_snap)
    model.save(args.out)
    print(f"Saved weights to {args.out} (best epoch {best_epoch}, val loss {best_val:.1f})")


if __name__ == "__main__":
    main()
