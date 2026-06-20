#!/usr/bin/env python3
"""Offline evaluation of speaker verification quality (AC-G4).

Evaluates speaker attribution accuracy across different segment lengths,
cross-device enrollment conditions, and speaker swap detection.

Usage:
    python eval_speaker_verification.py \\
        --enrollment-dir ./eval_data/enrollment/ \\
        --test-audio ./eval_data/meeting.wav \\
        --ground-truth ./eval_data/ground_truth.json \\
        [--segment-lengths 1,2,3,5] \\
        [--threshold 0.6] \\
        [--cross-device-dir ./eval_data/cross_device_enrollment/]

Directory structure:
    enrollment/
        speaker1.wav   # enrollment audio per speaker
        speaker2.wav
        ...
    ground_truth.json:
        [{"start_s": 0.0, "end_s": 3.0, "speaker": "speaker1"}, ...]

Output:
    - Per-speaker attribution accuracy
    - Overall accuracy
    - Speaker swap rate (incorrectly switching between adjacent segments)
    - Segment length ablation table
    - Cross-device test results (if --cross-device-dir provided)
"""

import argparse
import json
import struct
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from speaker_embedder import SpeakerEmbedder


def read_wav_pcm(path: Path) -> bytes:
    """Read WAV file and return raw 16-bit mono 16kHz PCM bytes."""
    with wave.open(str(path), "rb") as wf:
        assert wf.getnchannels() == 1, f"Expected mono, got {wf.getnchannels()} channels"
        assert wf.getframerate() == 16000, f"Expected 16kHz, got {wf.getframerate()}Hz"
        assert wf.getsampwidth() == 2, f"Expected 16-bit, got {wf.getsampwidth() * 8}-bit"
        return wf.readframes(wf.getnframes())


def segment_pcm(pcm: bytes, segment_sec: float, sample_rate: int = 16000) -> list[bytes]:
    """Split PCM into fixed-length segments."""
    bytes_per_seg = int(segment_sec * sample_rate * 2)  # 16-bit = 2 bytes/sample
    segments = []
    for i in range(0, len(pcm), bytes_per_seg):
        seg = pcm[i:i + bytes_per_seg]
        if len(seg) >= bytes_per_seg // 2:  # keep segments at least half-length
            segments.append(seg)
    return segments


def find_ground_truth_speaker(gt: list[dict], start_s: float, end_s: float) -> str | None:
    """Find the majority speaker in a time range from ground truth."""
    best_overlap = 0
    best_speaker = None
    for entry in gt:
        overlap_start = max(start_s, entry["start_s"])
        overlap_end = min(end_s, entry["end_s"])
        overlap = max(0, overlap_end - overlap_start)
        if overlap > best_overlap:
            best_overlap = overlap
            best_speaker = entry["speaker"]
    return best_speaker


def evaluate(
    embedder: SpeakerEmbedder,
    enrollment_embeddings: dict[str, np.ndarray],
    test_pcm: bytes,
    ground_truth: list[dict],
    segment_sec: float,
    threshold: float,
) -> dict:
    """Run evaluation for a single segment length.

    Returns dict with accuracy, swap_rate, per_speaker stats.
    """
    segments = segment_pcm(test_pcm, segment_sec)
    total = 0
    correct = 0
    per_speaker_correct: dict[str, int] = {}
    per_speaker_total: dict[str, int] = {}
    prev_predicted = None
    swap_correct = 0
    swap_total = 0

    for i, seg in enumerate(segments):
        start_s = i * segment_sec
        end_s = start_s + segment_sec

        gt_speaker = find_ground_truth_speaker(ground_truth, start_s, end_s)
        if gt_speaker is None:
            continue  # no ground truth for this segment (silence/overlap)

        # Extract embedding
        emb = embedder.extract(seg)
        predicted = None
        if emb is not None:
            best_sim = -1.0
            for name, ref_emb in enrollment_embeddings.items():
                sim = embedder.similarity(emb, ref_emb)
                if sim > best_sim:
                    best_sim = sim
                    predicted = name if sim >= threshold else None

        total += 1
        per_speaker_total[gt_speaker] = per_speaker_total.get(gt_speaker, 0) + 1
        if predicted == gt_speaker:
            correct += 1
            per_speaker_correct[gt_speaker] = per_speaker_correct.get(gt_speaker, 0) + 1

        # Swap rate: was the speaker change between adjacent segments detected correctly?
        if prev_predicted is not None:
            gt_prev = find_ground_truth_speaker(ground_truth, start_s - segment_sec, start_s)
            if gt_prev and gt_speaker:
                gt_changed = gt_prev != gt_speaker
                pred_changed = prev_predicted != predicted
                swap_total += 1
                if gt_changed == pred_changed:
                    swap_correct += 1
        prev_predicted = predicted

    accuracy = correct / max(total, 1)
    swap_accuracy = swap_correct / max(swap_total, 1)

    per_speaker = {}
    for speaker in per_speaker_total:
        c = per_speaker_correct.get(speaker, 0)
        t = per_speaker_total[speaker]
        per_speaker[speaker] = {"correct": c, "total": t, "accuracy": c / max(t, 1)}

    return {
        "segment_sec": segment_sec,
        "total_segments": total,
        "correct": correct,
        "accuracy": round(accuracy, 4),
        "swap_total": swap_total,
        "swap_correct": swap_correct,
        "swap_accuracy": round(swap_accuracy, 4),
        "per_speaker": per_speaker,
    }


def enroll_speakers(embedder: SpeakerEmbedder, enrollment_dir: Path) -> dict[str, np.ndarray]:
    """Extract enrollment embeddings from speaker WAV files."""
    embeddings = {}
    for wav_file in sorted(enrollment_dir.glob("*.wav")):
        speaker_name = wav_file.stem
        pcm = read_wav_pcm(wav_file)
        emb = embedder.extract(pcm)
        if emb is not None:
            embeddings[speaker_name] = emb
            print(f"  ✓ Enrolled: {speaker_name} (embedding dim={emb.shape[0]})")
        else:
            print(f"  ✗ Failed: {speaker_name} (audio too short or extraction error)")
    return embeddings


def main():
    parser = argparse.ArgumentParser(description="Speaker verification offline evaluation")
    parser.add_argument("--enrollment-dir", type=Path, required=True,
                        help="Directory with speaker enrollment WAV files")
    parser.add_argument("--test-audio", type=Path, required=True,
                        help="Test meeting WAV file (16kHz mono 16-bit)")
    parser.add_argument("--ground-truth", type=Path, required=True,
                        help="Ground truth JSON file")
    parser.add_argument("--segment-lengths", type=str, default="1,2,3,5",
                        help="Comma-separated segment lengths in seconds (default: 1,2,3,5)")
    parser.add_argument("--threshold", type=float, default=0.6,
                        help="Cosine similarity threshold (default: 0.6)")
    parser.add_argument("--cross-device-dir", type=Path, default=None,
                        help="Cross-device enrollment WAV files (different mic)")
    args = parser.parse_args()

    segment_lengths = [float(s) for s in args.segment_lengths.split(",")]
    embedder = SpeakerEmbedder()

    # Load ground truth
    with open(args.ground_truth) as f:
        ground_truth = json.load(f)

    # Load test audio
    print(f"\nLoading test audio: {args.test_audio}")
    test_pcm = read_wav_pcm(args.test_audio)
    duration_s = len(test_pcm) / 2 / 16000
    print(f"  Duration: {duration_s:.1f}s")

    # Standard enrollment
    print(f"\nEnrolling speakers from: {args.enrollment_dir}")
    enrollment_embeddings = enroll_speakers(embedder, args.enrollment_dir)
    if not enrollment_embeddings:
        print("ERROR: No speakers enrolled. Check enrollment WAV files.")
        sys.exit(1)

    # Ablation over segment lengths
    print(f"\n{'='*60}")
    print(f"Segment Length Ablation (threshold={args.threshold})")
    print(f"{'='*60}")
    print(f"{'Seg(s)':>7} {'Accuracy':>10} {'Swap Acc':>10} {'Segments':>10}")
    print(f"{'-'*7} {'-'*10} {'-'*10} {'-'*10}")

    results = []
    for seg_len in segment_lengths:
        result = evaluate(embedder, enrollment_embeddings, test_pcm,
                          ground_truth, seg_len, args.threshold)
        results.append(result)
        print(f"{seg_len:>7.1f} {result['accuracy']:>10.1%} "
              f"{result['swap_accuracy']:>10.1%} {result['total_segments']:>10}")

    # Per-speaker breakdown for best segment length
    best = max(results, key=lambda r: r["accuracy"])
    print(f"\nBest segment length: {best['segment_sec']}s (accuracy={best['accuracy']:.1%})")
    print(f"\nPer-speaker breakdown ({best['segment_sec']}s segments):")
    for speaker, stats in sorted(best["per_speaker"].items()):
        print(f"  {speaker}: {stats['accuracy']:.1%} ({stats['correct']}/{stats['total']})")

    # Cross-device test
    cross_device_output = None
    if args.cross_device_dir:
        print(f"\n{'='*60}")
        print(f"Cross-Device Enrollment Test")
        print(f"{'='*60}")
        print(f"Enrollment mic: {args.cross_device_dir}")
        print(f"Test mic: {args.test_audio}")

        cross_embeddings = enroll_speakers(embedder, args.cross_device_dir)
        if cross_embeddings:
            cross_result = evaluate(embedder, cross_embeddings, test_pcm,
                                    ground_truth, best["segment_sec"], args.threshold)
            print(f"\nSame-device accuracy:  {best['accuracy']:.1%}")
            print(f"Cross-device accuracy: {cross_result['accuracy']:.1%}")
            delta = cross_result["accuracy"] - best["accuracy"]
            print(f"Delta: {delta:+.1%}")
            cross_device_output = {
                "same_device_accuracy": best["accuracy"],
                "cross_device_accuracy": cross_result["accuracy"],
                "delta": round(delta, 4),
                "cross_device_result": cross_result,
            }

    # JSON output
    output = {
        "threshold": args.threshold,
        "test_audio_duration_s": round(duration_s, 1),
        "enrolled_speakers": list(enrollment_embeddings.keys()),
        "ablation_results": results,
        "best_segment_sec": best["segment_sec"],
        "cross_device": cross_device_output,
    }
    output_path = args.test_audio.parent / "eval_results.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nResults saved to: {output_path}")


if __name__ == "__main__":
    main()
