#!/usr/bin/env python3
"""Fetch 10 random clips from datasetsANDmodels/english-stt-dataset into the benchmark."""

from __future__ import annotations

import csv
import json
import random
from pathlib import Path

from remotezip import RemoteZip

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(__file__).resolve().parent / ".cache"
SAMPLES = Path(__file__).resolve().parent / "samples"
LABELS = Path(__file__).resolve().parent / "labels.json"

CSV_URL = "https://huggingface.co/datasets/datasetsANDmodels/english-stt-dataset/resolve/main/transcriptions.csv"
ZIP_URL = "https://huggingface.co/datasets/datasetsANDmodels/english-stt-dataset/resolve/main/wavs.zip"
N = 10
SEED = 42


def load_rows(csv_path: Path) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = []
    with csv_path.open(newline="", encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="|"):
            if len(row) < 2:
                continue
            sample_id, text = row[0], row[1]
            rows.append((sample_id, text))
    return rows


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    SAMPLES.mkdir(parents=True, exist_ok=True)

    csv_path = CACHE / "transcriptions.csv"
    if not csv_path.exists():
        raise SystemExit(f"Missing {csv_path}; download transcriptions.csv first")

    rows = load_rows(csv_path)
    rng = random.Random(SEED)
    picked = rng.sample(rows, N)

    labels: dict[str, str] = {}
    if LABELS.exists():
        labels = json.loads(LABELS.read_text(encoding="utf-8"))

    with RemoteZip(ZIP_URL) as z:
        for sample_id, text in picked:
            member = f"wavs/{sample_id}.wav"
            filename = f"{sample_id}.wav"
            dest = SAMPLES / filename
            print(f"extracting {member} -> {dest}")
            data = z.read(member)
            dest.write_bytes(data)
            labels[filename] = text

    LABELS.write_text(json.dumps(labels, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"updated {LABELS} ({len(labels)} entries)")


if __name__ == "__main__":
    main()
