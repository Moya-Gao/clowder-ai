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


# ============================================================
# Phase H: Diarization metrics (AC-H4)
# ============================================================

def _build_label_mapping(
    ref: list[tuple[str, float, float]],
    hyp: list[tuple[str, float, float]],
    step: float,
) -> dict[str, str]:
    """Build optimal hyp→ref label mapping via brute-force permutation.

    For unsupervised diarization, hypothesis labels (Speaker 1, Speaker 2)
    are arbitrary. We find the mapping that minimizes DER by trying all
    possible one-to-one assignments of hyp labels to ref labels.

    Uses brute-force permutation: O(N!) but N=max_clusters≤8, so 8!=40320
    iterations max — trivial for evaluation.
    """
    from collections import Counter
    from itertools import combinations, permutations

    # Collect co-occurrence counts for scoring mappings
    cooccur: dict[tuple[str, str], int] = Counter()
    max_time = max((e for _, _, e in ref), default=0.0)
    if hyp:
        max_time = max(max_time, max(e for _, _, e in hyp))

    t = 0.0
    while t < max_time:
        ref_spk = {s for s, start, end in ref if start <= t < end}
        hyp_spk = {s for s, start, end in hyp if start <= t < end}
        for h in hyp_spk:
            for r in ref_spk:
                cooccur[(h, r)] += 1
        t += step

    hyp_labels = sorted({s for s, _, _ in hyp})
    ref_labels = sorted({s for s, _, _ in ref})

    if not hyp_labels or not ref_labels:
        return {}

    # Enumerate all possible one-to-one mappings: choose k hyp labels,
    # then try all permutations of k ref labels to assign to them.
    # This handles |hyp| > |ref| correctly (must pick WHICH hyp to map).
    k = min(len(hyp_labels), len(ref_labels))
    best_mapping: dict[str, str] = {}
    best_score = -1

    for hyp_subset in combinations(hyp_labels, k):
        for ref_perm in permutations(ref_labels, k):
            mapping = dict(zip(hyp_subset, ref_perm))
            score = sum(cooccur.get((h, r), 0) for h, r in mapping.items())
            if score > best_score:
                best_score = score
                best_mapping = mapping

    return best_mapping


def compute_der(
    ref: list[tuple[str, float, float]],
    hyp: list[tuple[str, float, float]],
    step: float = 0.1,
) -> float:
    """Compute Diarization Error Rate (DER) via frame-level comparison.

    Handles unsupervised diarization where hypothesis labels differ from
    reference labels by building an optimal label mapping first.

    Args:
        ref: Reference labels as [(speaker, start_s, end_s), ...]
        hyp: Hypothesis labels as [(speaker, start_s, end_s), ...]
        step: Time resolution in seconds (default 0.1s = 100ms frames)

    Returns:
        DER as float in [0, 1+] (can exceed 1 with false alarms).
        DER = (miss + false_alarm + confusion) / total_reference_duration
    """
    if not ref:
        return 0.0

    # Build optimal label mapping (hyp label → ref label)
    label_map = _build_label_mapping(ref, hyp, step)

    max_time = max(e for _, _, e in ref)
    if hyp:
        max_time = max(max_time, max(e for _, _, e in hyp))

    ref_frames = 0  # frames where ref has speech
    miss = 0
    false_alarm = 0
    confusion = 0

    t = 0.0
    while t < max_time:
        ref_speakers = {s for s, start, end in ref if start <= t < end}
        hyp_speakers = {s for s, start, end in hyp if start <= t < end}
        # Map hyp labels to ref labels for comparison
        mapped_hyp = {label_map.get(s, s) for s in hyp_speakers}

        has_ref = len(ref_speakers) > 0
        has_hyp = len(hyp_speakers) > 0

        if has_ref:
            ref_frames += 1

        if has_ref and not has_hyp:
            miss += 1
        elif has_hyp and not has_ref:
            false_alarm += 1
        elif has_ref and has_hyp:
            # Both have speech — count confusion (mapped labels don't match)
            matched = ref_speakers & mapped_hyp
            unmatched_ref = ref_speakers - matched
            unmatched_hyp = mapped_hyp - matched
            confusion += max(len(unmatched_ref), len(unmatched_hyp))

        t += step

    # DER denominator is ref speech duration (in frames)
    total_errors = miss + false_alarm + confusion
    return total_errors / max(ref_frames, 1)


def compute_swap_rate(labels: list[str], true_labels: list[str]) -> float:
    """Compute speaker swap rate: fraction of transitions that are incorrect.

    A "swap" is when the predicted speaker changes but shouldn't have
    (or vice versa).

    Args:
        labels: Predicted speaker labels per segment
        true_labels: Ground truth labels per segment

    Returns:
        Swap error rate in [0, 1]
    """
    if len(labels) < 2 or len(true_labels) < 2:
        return 0.0

    n = min(len(labels), len(true_labels))
    swap_errors = 0
    swap_total = 0

    for i in range(1, n):
        true_changed = true_labels[i] != true_labels[i - 1]
        pred_changed = labels[i] != labels[i - 1]
        swap_total += 1
        if true_changed != pred_changed:
            swap_errors += 1

    return swap_errors / max(swap_total, 1)


def compute_fragmentation_rate(labels: list[str]) -> float:
    """Compute fragmentation rate: number of speaker changes per segment.

    Lower = better. High fragmentation means the system rapidly switches
    between speakers even within a single utterance.

    Returns:
        Changes per segment (0 = no changes, 1 = every segment changes)
    """
    if len(labels) < 2:
        return 0.0

    changes = sum(1 for i in range(1, len(labels)) if labels[i] != labels[i - 1])
    return changes / (len(labels) - 1)


def compute_unknown_rate(labels: list[str | None]) -> float:
    """Compute unknown rate: fraction of segments with no speaker assignment.

    Args:
        labels: Speaker labels, None means unassigned

    Returns:
        Unknown rate in [0, 1]
    """
    if not labels:
        return 0.0
    unknown = sum(1 for l in labels if l is None)
    return unknown / len(labels)


def evaluate_diarization(
    embedder: SpeakerEmbedder,
    test_pcm: bytes,
    ground_truth: list[dict],
    segment_sec: float,
    threshold: float = 0.65,
    max_clusters: int = 8,
) -> dict:
    """Evaluate unsupervised diarization using ClusterRegistry.

    No enrollment — purely clustering-based evaluation.
    """
    from speaker_cluster_registry import ClusterRegistry

    registry = ClusterRegistry(threshold=threshold, max_clusters=max_clusters)
    segments = segment_pcm(test_pcm, segment_sec)

    predicted_labels: list[str | None] = []
    true_labels: list[str] = []
    # Parallel truth list: same length as predicted_labels, preserving
    # per-segment alignment (None for segments without ground truth).
    # Needed because true_labels only has entries for segments WITH ground
    # truth, losing positional correspondence when predictions have Nones.
    true_for_pred: list[str | None] = []
    hyp_segments: list[tuple[str, float, float]] = []

    for i, seg in enumerate(segments):
        start_s = i * segment_sec
        end_s = start_s + segment_sec

        gt_speaker = find_ground_truth_speaker(ground_truth, start_s, end_s)
        if gt_speaker is None:
            predicted_labels.append(None)
            true_for_pred.append(None)
            continue

        true_labels.append(gt_speaker)
        true_for_pred.append(gt_speaker)
        emb = embedder.extract(seg)
        if emb is None:
            predicted_labels.append(None)
            continue

        duration = len(seg) / 2 / 16000
        result = registry.assign(emb, duration)
        label = result["cluster_id"]
        predicted_labels.append(label)

        if label:
            hyp_segments.append((label, start_s, end_s))

    # Build ref segments from ground truth
    ref_segments = [(e["speaker"], e["start_s"], e["end_s"]) for e in ground_truth]

    # Aligned filtering for swap_rate: keep only segments where BOTH
    # prediction and ground truth exist, preserving index correspondence.
    aligned_pairs = [
        (p, t) for p, t in zip(predicted_labels, true_for_pred)
        if p is not None and t is not None
    ]
    if aligned_pairs:
        aligned_pred, aligned_true = zip(*aligned_pairs)
        swap = compute_swap_rate(list(aligned_pred), list(aligned_true))
    else:
        swap = 0.0

    # Compute remaining metrics
    der = compute_der(ref_segments, hyp_segments)
    frag = compute_fragmentation_rate([l or "?" for l in predicted_labels])
    unknown = compute_unknown_rate(predicted_labels)

    return {
        "segment_sec": segment_sec,
        "total_segments": len(segments),
        "num_clusters": registry.cluster_count,
        "clusters": registry.get_clusters(),
        "der": round(der, 4),
        "swap_rate": round(swap, 4),
        "fragmentation_rate": round(frag, 4),
        "unknown_rate": round(unknown, 4),
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
