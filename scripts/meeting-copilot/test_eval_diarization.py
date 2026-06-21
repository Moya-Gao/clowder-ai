"""Tests for diarization evaluation metrics (AC-H4).

F195 Phase H: DER, swap rate, fragmentation rate, unknown rate.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from unittest.mock import MagicMock

import numpy as np

from eval_speaker_verification import (
    compute_der,
    compute_fragmentation_rate,
    compute_swap_rate,
    compute_unknown_rate,
    evaluate_diarization,
)


class TestComputeDER:
    """DER = (miss + false_alarm + confusion) / total_ref_duration."""

    def test_perfect_match_zero_der(self):
        ref = [("A", 0, 5), ("B", 5, 10)]
        hyp = [("A", 0, 5), ("B", 5, 10)]
        der = compute_der(ref, hyp)
        assert der == 0.0

    def test_total_miss_one_der(self):
        ref = [("A", 0, 10)]
        hyp = []  # no hypothesis at all
        der = compute_der(ref, hyp)
        assert der == 1.0

    def test_partial_confusion(self):
        ref = [("A", 0, 5), ("B", 5, 10)]
        hyp = [("A", 0, 3), ("B", 3, 10)]  # 3-5s is confusion (A→B)
        der = compute_der(ref, hyp)
        # Confusion in 3-5s = 2s out of 10s total → DER ≈ 0.2
        assert 0.15 <= der <= 0.25

    def test_empty_ref_returns_zero(self):
        assert compute_der([], [("A", 0, 5)]) == 0.0

    def test_single_speaker_correct(self):
        ref = [("A", 0, 10)]
        hyp = [("A", 0, 10)]
        assert compute_der(ref, hyp) == 0.0

    def test_permuted_labels_still_zero(self):
        """P1-2 regression: unsupervised labels differ from ground truth.
        Perfect segmentation with different names should give DER ≈ 0."""
        ref = [("Alice", 0, 5), ("Bob", 5, 10)]
        hyp = [("Speaker 1", 0, 5), ("Speaker 2", 5, 10)]
        der = compute_der(ref, hyp)
        assert der <= 0.05  # allow floating point tolerance

    def test_false_alarm_counted(self):
        """P1-2 regression: hyp has speech beyond ref → false alarm."""
        ref = [("A", 0, 5)]
        hyp = [("A", 0, 10)]  # 5-10s is false alarm
        der = compute_der(ref, hyp)
        # false alarm = 5s, ref duration = 5s → DER = 5/5 = 1.0
        assert der >= 0.9

    def test_greedy_mapping_suboptimal_counterexample(self):
        """R2 regression: greedy co-occurrence mapping gives DER=0.64 but
        optimal permutation gives DER=0.36. Brute-force must be used."""
        ref = [("R1", 0, 9), ("R2", 9, 17), ("R1", 17, 25)]
        hyp = [("H1", 0, 17), ("H2", 17, 25)]
        der = compute_der(ref, hyp, step=1.0)
        # Optimal: H1→R2, H2→R1 → confusion only at 0-9 = 9/25 = 0.36
        assert der <= 0.40, f"DER={der}, expected ≤0.40 (optimal ~0.36)"


    def test_more_hyp_than_ref_optimal_subset(self):
        """R3 regression: 3 hyp labels, 2 ref labels. Must pick best hyp subset."""
        # R1 speaks 0-10, R2 speaks 10-20
        # H1 speaks 0-10 (matches R1), H2 speaks 10-19 (matches R2),
        # H3 speaks 19-20 (also matches R2 region)
        ref = [("R1", 0, 10), ("R2", 10, 20)]
        hyp = [("H1", 0, 10), ("H2", 10, 19), ("H3", 19, 20)]
        der = compute_der(ref, hyp, step=1.0)
        # Optimal: H1→R1, H2→R2 → confusion only at 19-20 (H3 unmapped) = 1/20
        assert der <= 0.10, f"DER={der}, expected ≤0.10 (optimal ~0.05)"


class TestComputeSwapRate:
    def test_no_swaps_returns_zero(self):
        labels = ["A", "A", "A", "B", "B"]
        true = ["A", "A", "A", "B", "B"]
        assert compute_swap_rate(labels, true) == 0.0

    def test_all_swaps_wrong(self):
        # True: A→B at index 2. Pred: no change
        labels = ["A", "A", "A", "A"]
        true = ["A", "A", "B", "B"]
        rate = compute_swap_rate(labels, true)
        # At i=2: true changed (A→B), pred didn't → swap error
        # At i=3: true didn't change (B→B), pred didn't → correct
        # So 1 error out of 3 transitions
        assert abs(rate - 1 / 3) < 0.01

    def test_empty_or_single_returns_zero(self):
        assert compute_swap_rate([], []) == 0.0
        assert compute_swap_rate(["A"], ["A"]) == 0.0


class TestComputeFragmentationRate:
    def test_no_changes_zero(self):
        assert compute_fragmentation_rate(["A", "A", "A", "A"]) == 0.0

    def test_every_segment_changes(self):
        assert compute_fragmentation_rate(["A", "B", "A", "B"]) == 1.0

    def test_one_change(self):
        labels = ["A", "A", "B", "B"]
        # 1 change out of 3 transitions
        assert abs(compute_fragmentation_rate(labels) - 1 / 3) < 0.01

    def test_single_returns_zero(self):
        assert compute_fragmentation_rate(["A"]) == 0.0


class TestComputeUnknownRate:
    def test_all_known(self):
        assert compute_unknown_rate(["A", "B", "A"]) == 0.0

    def test_all_unknown(self):
        assert compute_unknown_rate([None, None, None]) == 1.0

    def test_mixed(self):
        labels = ["A", None, "B", None]
        assert compute_unknown_rate(labels) == 0.5

    def test_empty(self):
        assert compute_unknown_rate([]) == 0.0


class TestEvaluateDiarizationSwapAlignment:
    """Regression: swap_rate must preserve index alignment when predictions
    have None entries (cloud review P2 — segment alignment).

    Scenario: 4 segments, 1s each. Segment 0 has ground truth but embedding
    extraction fails (None). Segments 1-3 have both ground truth and embeddings.
    All embeddings are distinct enough that the cluster registry assigns different
    clusters for the speaker change. The swap_rate should reflect correct
    alignment between predictions and ground truth.
    """

    def _make_pcm(self, num_segments: int, segment_sec: float = 1.0) -> bytes:
        """Create minimal PCM data for N segments at 16kHz 16-bit mono."""
        samples_per_seg = int(segment_sec * 16000)
        return b"\x00\x01" * (num_segments * samples_per_seg)

    def test_swap_rate_alignment_with_none_predictions(self):
        """When segment 0's embedding fails, swap_rate must still correctly
        align remaining predictions with their corresponding ground truth.

        Ground truth: [A, A, B, B] (speaker change at segment 2)
        Predictions:  [None, cluster_0, cluster_0, cluster_1]
        (None because embedding extraction failed for segment 0)

        After filtering Nones, aligned pairs should be:
          pred=[cluster_0, cluster_0, cluster_1] vs truth=[A, B, B]
                                                         ^^^
        NOT truth=[A, A, B] (first 3 items — misaligned).

        With correct alignment (segments 1-3):
          Transition 1→2: pred same, truth A→B (change) → swap error
          Transition 2→3: pred cluster_0→cluster_1, truth B→B → swap error
          swap_rate = 2/2 = 1.0

        But the point is: the alignment must match by segment index,
        not by sequential position after filtering.
        """
        # 4 segments at 1s each
        pcm = self._make_pcm(4, segment_sec=1.0)
        ground_truth = [
            {"speaker": "A", "start_s": 0.0, "end_s": 2.0},
            {"speaker": "B", "start_s": 2.0, "end_s": 4.0},
        ]

        # Mock embedder: None for first call, distinct embeddings after
        embedder = MagicMock()
        emb_a = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        emb_b = np.array([0.0, 1.0, 0.0], dtype=np.float32)
        embedder.extract.side_effect = [
            None,    # segment 0: extraction fails
            emb_a,   # segment 1: speaker A
            emb_b,   # segment 2: speaker B (different cluster)
            emb_b,   # segment 3: speaker B (same cluster)
        ]

        result = evaluate_diarization(
            embedder, pcm, ground_truth, segment_sec=1.0,
            threshold=0.5, max_clusters=8,
        )

        # Verify the None prediction is reflected:
        assert result["unknown_rate"] == 0.25  # 1 of 4 segments unknown

        # With CORRECT alignment (segments 1-3 against truth for 1-3):
        #   pred: [cluster_0, cluster_1, cluster_1]
        #   truth (aligned): [A, B, B]
        #   Transition 1→2: pred changed, truth changed → correct
        #   Transition 2→3: pred same, truth same → correct
        #   swap_rate = 0/2 = 0.0
        #
        # With MISALIGNED code (first 3 truth labels = [A, A, B]):
        #   Transition 1→2: pred changed, truth A→A same → error
        #   Transition 2→3: pred same, truth A→B changed → error
        #   swap_rate = 2/2 = 1.0 (WRONG!)
        assert result["swap_rate"] == 0.0, (
            f"swap_rate should be 0.0 with correct alignment, "
            f"got {result['swap_rate']} — likely index misalignment "
            f"when None predictions shift truth labels"
        )
