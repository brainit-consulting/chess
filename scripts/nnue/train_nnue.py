#!/usr/bin/env python3
import argparse
import hashlib
import json
import math
import os
import random
import struct
from typing import Dict, List, Optional, Tuple

MAGIC = b"SNN1"
VERSION = 1
FLAGS = 0
INPUT_SIZE = 768
HIDDEN_SIZE = 64
RELU_CAP = 127.0

PIECE_TYPE_INDEX = {
    "p": 0,
    "n": 1,
    "b": 2,
    "r": 3,
    "q": 4,
    "k": 5,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train mini NNUE on dataset.jsonl (clean rows only)."
    )
    parser.add_argument("--dataset", required=True, help="Path to dataset.jsonl")
    parser.add_argument(
        "--summary",
        default=None,
        help="Path to dataset.jsonl.summary.json (timeoutMovesPerGame map).",
    )
    parser.add_argument(
        "--analysisRoot",
        default=None,
        help="Path to analysis root containing <runId>/game-XXXX-annotated.json",
    )
    parser.add_argument(
        "--out",
        default=os.path.join(
            "src", "ai", "nnue", "weights", "Scorpion-NNUE-Weight-trained-v1.snnue"
        ),
        help="Output weights file path.",
    )
    parser.add_argument(
        "--report",
        default=None,
        help="Output report JSON path (default: <out>.report.json).",
    )
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=0.01)
    parser.add_argument("--huberDelta", type=float, default=100.0)
    parser.add_argument("--minEpochs", type=int, default=5)
    parser.add_argument("--patience", type=int, default=2)
    parser.add_argument("--seed", type=int, default=1337)
    parser.add_argument("--maxSamples", type=int, default=None)
    return parser.parse_args()


def resolve_analysis_root(dataset_path: str, analysis_root: Optional[str]) -> str:
    if analysis_root:
        return analysis_root
    dataset_dir = os.path.abspath(os.path.dirname(dataset_path))
    parent = os.path.abspath(os.path.join(dataset_dir, ".."))
    return parent if os.path.isdir(parent) else dataset_dir


def load_timeout_map(summary_path: str) -> Optional[Dict[int, int]]:
    with open(summary_path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    entries = data.get("timeoutMovesPerGame")
    if not isinstance(entries, list):
        return None
    timeout_map: Dict[int, int] = {}
    for entry in entries:
        game_id = entry.get("gameId")
        timeout_moves = entry.get("timeoutMoves")
        if game_id is None or timeout_moves is None:
            continue
        timeout_map[int(game_id)] = int(timeout_moves)
    return timeout_map


def load_timeout_map_for_run(analysis_root: str, run_id: str) -> Optional[Dict[int, int]]:
    summary_path = os.path.join(analysis_root, run_id, "dataset.jsonl.summary.json")
    if not os.path.exists(summary_path):
        return None
    summary = load_timeout_map(summary_path)
    if summary is None:
        return None
    return summary


def feature_index(piece_char: str, file_idx: int, rank_idx: int) -> int:
    color = "w" if piece_char.isupper() else "b"
    type_index = PIECE_TYPE_INDEX[piece_char.lower()]
    color_offset = 0 if color == "w" else 6
    if color == "w":
        square_index = rank_idx * 8 + file_idx
    else:
        square_index = (7 - rank_idx) * 8 + file_idx
    return (color_offset + type_index) * 64 + square_index


def fen_to_features(fen: str) -> List[int]:
    board = fen.split()[0]
    ranks = board.split("/")
    if len(ranks) != 8:
        raise ValueError(f"Invalid FEN: {fen}")
    features: List[int] = []
    for fen_rank, rank_text in enumerate(ranks):
        rank_idx = 7 - fen_rank
        file_idx = 0
        for char in rank_text:
            if char.isdigit():
                file_idx += int(char)
                continue
            idx = feature_index(char, file_idx, rank_idx)
            features.append(idx)
            file_idx += 1
    return features


class NnueModel:
    def __init__(self, input_size: int, hidden_size: int, seed: int):
        rng = random.Random(seed)
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.w1 = [
            [(rng.random() * 2 - 1) * 0.01 for _ in range(hidden_size)]
            for _ in range(input_size)
        ]
        self.b1 = [0.0 for _ in range(hidden_size)]
        self.w2 = [(rng.random() * 2 - 1) * 0.01 for _ in range(hidden_size)]
        self.b2 = 0.0

    def forward(self, features: List[int]) -> Tuple[float, List[float], List[bool]]:
        hidden = self.b1[:]
        for idx in features:
            row = self.w1[idx]
            for i in range(self.hidden_size):
                hidden[i] += row[i]
        active: List[bool] = [False] * self.hidden_size
        for i in range(self.hidden_size):
            value = hidden[i]
            if value <= 0:
                hidden[i] = 0.0
                continue
            if value >= RELU_CAP:
                hidden[i] = RELU_CAP
                continue
            active[i] = True
        output = self.b2
        for i in range(self.hidden_size):
            if hidden[i] != 0.0:
                output += hidden[i] * self.w2[i]
        return output, hidden, active

    def train_sample(self, features: List[int], label: float, lr: float, delta: float) -> float:
        output, hidden, active = self.forward(features)
        error = output - label
        grad = huber_grad(error, delta)
        w2_snapshot = self.w2[:]
        for i in range(self.hidden_size):
            if hidden[i] != 0.0:
                self.w2[i] -= lr * grad * hidden[i]
        self.b2 -= lr * grad
        for i in range(self.hidden_size):
            if not active[i]:
                continue
            g = grad * w2_snapshot[i]
            if g == 0.0:
                continue
            self.b1[i] -= lr * g
            for idx in features:
                self.w1[idx][i] -= lr * g
        return huber_loss(error, delta)

    def predict(self, features: List[int]) -> float:
        output, _hidden, _active = self.forward(features)
        return output


def huber_loss(error: float, delta: float) -> float:
    abs_err = abs(error)
    if abs_err <= delta:
        return 0.5 * error * error
    return delta * (abs_err - 0.5 * delta)


def huber_grad(error: float, delta: float) -> float:
    abs_err = abs(error)
    if abs_err <= delta:
        return error
    return delta if error > 0 else -delta


def write_snnue(
    path: str,
    input_size: int,
    hidden_size: int,
    w1: List[List[float]],
    b1: List[float],
    w2: List[float],
    b2: float,
) -> None:
    float_count = input_size * hidden_size + hidden_size + hidden_size + 1
    byte_length = 12 + float_count * 4
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(MAGIC)
        handle.write(struct.pack("<HHHH", input_size, hidden_size, VERSION, FLAGS))
        for row in w1:
            for value in row:
                handle.write(struct.pack("<f", float(value)))
        for value in b1:
            handle.write(struct.pack("<f", float(value)))
        for value in w2:
            handle.write(struct.pack("<f", float(value)))
        handle.write(struct.pack("<f", float(b2)))
        handle.flush()
        if handle.tell() != byte_length:
            raise ValueError("Weight file size mismatch.")


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_engine_color(run_id: str, game_id: int, analysis_root: str, cache: Dict[Tuple[str, int], str]) -> str:
    key = (run_id, game_id)
    if key in cache:
        return cache[key]
    filename = f"game-{game_id:04d}-annotated.json"
    path = os.path.join(analysis_root, run_id, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing annotated file: {path}")
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    engine_color = payload.get("meta", {}).get("engineColor")
    if engine_color not in ("w", "b"):
        raise ValueError(f"Missing engineColor for {run_id} game {game_id}")
    cache[key] = engine_color
    return engine_color


def load_samples(
    dataset_path: str,
    timeout_map: Optional[Dict[int, int]],
    analysis_root: str,
    max_samples: Optional[int],
    seed: int,
) -> Tuple[List[Dict], Dict[str, int], Dict[str, float]]:
    rng = random.Random(seed)
    cache: Dict[Tuple[str, int], str] = {}
    timeout_cache: Dict[str, Dict[int, int]] = {}
    samples: List[Dict] = []
    skipped = {
        "timeoutGame": 0,
        "timeoutNearby": 0,
        "mate": 0,
        "missingTimeoutSummary": 0
    }
    label_stats = {"min": math.inf, "max": -math.inf, "sum": 0.0, "sumSq": 0.0}
    with open(dataset_path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            game_id = int(row["gameId"])
            run_id = row.get("runId")
            if not run_id:
                raise ValueError("Dataset row missing runId.")
            if timeout_map is None:
                if run_id not in timeout_cache:
                    timeout_cache[run_id] = load_timeout_map_for_run(analysis_root, run_id) or {}
                game_timeout = timeout_cache[run_id].get(game_id, 0)
                if timeout_cache[run_id] == {}:
                    skipped["missingTimeoutSummary"] += 1
                    continue
            else:
                game_timeout = timeout_map.get(game_id, 0)
            if game_timeout != 0:
                skipped["timeoutGame"] += 1
                continue
            if row.get("timeoutNearby"):
                skipped["timeoutNearby"] += 1
                continue
            eval_cp = row.get("evalCp")
            mate_in = row.get("mateIn")
            if eval_cp is None or mate_in is not None:
                skipped["mate"] += 1
                continue
            engine_color = load_engine_color(run_id, game_id, analysis_root, cache)
            label = float(eval_cp) if engine_color == "w" else -float(eval_cp)
            features = fen_to_features(row["fen"])
            eval_cp16 = row.get("evalCp16")
            label16 = None
            if eval_cp16 is not None:
                label16 = float(eval_cp16) if engine_color == "w" else -float(eval_cp16)
            samples.append(
                {
                    "features": features,
                    "label": label,
                    "label16": label16,
                    "gameId": game_id,
                }
            )
            label_stats["min"] = min(label_stats["min"], label)
            label_stats["max"] = max(label_stats["max"], label)
            label_stats["sum"] += label
            label_stats["sumSq"] += label * label
            if max_samples and len(samples) >= max_samples:
                break
    rng.shuffle(samples)
    total = len(samples)
    if total == 0:
        raise RuntimeError("No samples after filtering.")
    mean = label_stats["sum"] / total
    variance = label_stats["sumSq"] / total - mean * mean
    label_stats["mean"] = mean
    label_stats["std"] = math.sqrt(max(variance, 0.0))
    return samples, skipped, label_stats


def split_by_game(samples: List[Dict], seed: int) -> Tuple[List[Dict], List[Dict]]:
    rng = random.Random(seed)
    games = sorted({sample["gameId"] for sample in samples})
    rng.shuffle(games)
    cutoff = int(len(games) * 0.9)
    train_games = set(games[:cutoff])
    train = [s for s in samples if s["gameId"] in train_games]
    val = [s for s in samples if s["gameId"] not in train_games]
    return train, val


def evaluate(model: NnueModel, samples: List[Dict], delta: float) -> float:
    if not samples:
        return 0.0
    total = 0.0
    for sample in samples:
        pred = model.predict(sample["features"])
        total += huber_loss(pred - sample["label"], delta)
    return total / len(samples)


def eval_cp16_diff(samples: List[Dict]) -> Tuple[int, float]:
    diffs = []
    for sample in samples:
        label16 = sample.get("label16")
        if label16 is None:
            continue
        diffs.append(abs(label16 - sample["label"]))
    if not diffs:
        return 0, 0.0
    return len(diffs), sum(diffs) / len(diffs)


def main() -> None:
    args = parse_args()
    dataset_path = args.dataset
    summary_path = args.summary or f"{dataset_path}.summary.json"
    if not os.path.exists(summary_path):
        raise FileNotFoundError(f"Missing summary file: {summary_path}")
    analysis_root = resolve_analysis_root(dataset_path, args.analysisRoot)
    timeout_map = load_timeout_map(summary_path)

    samples, skipped, label_stats = load_samples(
        dataset_path, timeout_map, analysis_root, args.maxSamples, args.seed
    )
    train, val = split_by_game(samples, args.seed)

    model = NnueModel(INPUT_SIZE, HIDDEN_SIZE, args.seed)
    history = []
    best_val = math.inf
    best_epoch = 0
    best_snapshot = None
    patience_left = args.patience
    for epoch in range(args.epochs):
        total_loss = 0.0
        for sample in train:
            total_loss += model.train_sample(
                sample["features"], sample["label"], args.lr, args.huberDelta
            )
        train_loss = total_loss / max(1, len(train))
        val_loss = evaluate(model, val, args.huberDelta)
        history.append({"epoch": epoch + 1, "trainLoss": train_loss, "valLoss": val_loss})
        print(f"Epoch {epoch + 1}: train={train_loss:.4f} val={val_loss:.4f}")
        if val_loss < best_val:
            best_val = val_loss
            best_epoch = epoch + 1
            best_snapshot = (
                [row[:] for row in model.w1],
                model.b1[:],
                model.w2[:],
                model.b2,
            )
            patience_left = args.patience
        elif epoch + 1 >= args.minEpochs:
            patience_left -= 1
            if patience_left <= 0:
                print(f"Early stop at epoch {epoch + 1}. Best epoch {best_epoch}.")
                break

    if best_snapshot is not None:
        model.w1, model.b1, model.w2, model.b2 = best_snapshot

    out_path = args.out
    write_snnue(out_path, INPUT_SIZE, HIDDEN_SIZE, model.w1, model.b1, model.w2, model.b2)
    weights_hash = sha256_file(out_path)
    size_bytes = os.path.getsize(out_path)

    eval16_count, eval16_mean = eval_cp16_diff(val)
    report = {
        "dataset": dataset_path,
        "summary": summary_path,
        "analysisRoot": analysis_root,
        "rows": len(samples),
        "trainRows": len(train),
        "valRows": len(val),
        "skipped": skipped,
        "labelStats": label_stats,
        "huberDelta": args.huberDelta,
        "epochs": args.epochs,
        "minEpochs": args.minEpochs,
        "patience": args.patience,
        "bestEpoch": best_epoch,
        "bestValLoss": best_val,
        "learningRate": args.lr,
        "history": history,
        "evalCp16Validation": {
            "count": eval16_count,
            "meanAbsDiff": eval16_mean,
        },
        "weights": {
            "path": out_path,
            "sha256": weights_hash,
            "sizeBytes": size_bytes,
        },
    }
    report_path = args.report or f"{out_path}.report.json"
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
    print(f"Wrote weights: {out_path}")
    print(f"SHA256: {weights_hash}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
