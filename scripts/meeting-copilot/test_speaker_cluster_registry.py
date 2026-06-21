"""Tests for ClusterRegistry — online incremental speaker clustering.

F195 Phase H: unsupervised speaker diarization via centroid matching.
"""

import numpy as np
import pytest

from speaker_cluster_registry import ClusterRegistry


def _random_emb(seed=42, dim=192):
    """Generate a random unit-norm embedding."""
    rng = np.random.RandomState(seed)
    v = rng.randn(dim).astype(np.float32)
    return v / np.linalg.norm(v)


def _similar_emb(base, noise_scale=0.05, seed=99):
    """Generate an embedding similar to base (small perturbation)."""
    rng = np.random.RandomState(seed)
    noisy = base + rng.randn(*base.shape).astype(np.float32) * noise_scale
    return noisy / np.linalg.norm(noisy)


# ============================================================
# Lifecycle tests
# ============================================================

class TestClusterRegistryLifecycle:
    def test_empty_initial_state(self):
        reg = ClusterRegistry()
        assert reg.cluster_count == 0
        assert reg.get_clusters() == []

    def test_assign_creates_first_cluster(self):
        reg = ClusterRegistry()
        emb = _random_emb(seed=1)
        result = reg.assign(emb, segment_duration=1.0)
        assert result["cluster_id"] == "Speaker 1"
        assert result["is_new"] is True
        assert result["confidence"] == 1.0
        assert reg.cluster_count == 1

    def test_assign_matches_existing_cluster(self):
        reg = ClusterRegistry(threshold=0.9)
        emb1 = _random_emb(seed=1)
        reg.assign(emb1, segment_duration=1.0)
        emb2 = _similar_emb(emb1, noise_scale=0.01, seed=2)
        result = reg.assign(emb2, segment_duration=1.0)
        assert result["cluster_id"] == "Speaker 1"
        assert result["is_new"] is False
        assert reg.cluster_count == 1

    def test_assign_creates_second_cluster_for_different_speaker(self):
        reg = ClusterRegistry()
        emb1 = _random_emb(seed=1)
        reg.assign(emb1, segment_duration=1.0)
        emb2 = _random_emb(seed=100)  # very different
        result = reg.assign(emb2, segment_duration=1.0)
        assert result["cluster_id"] == "Speaker 2"
        assert result["is_new"] is True
        assert reg.cluster_count == 2

    def test_reset_clears_all(self):
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), segment_duration=1.0)
        reg.assign(_random_emb(seed=100), segment_duration=1.0)
        assert reg.cluster_count == 2
        reg.reset()
        assert reg.cluster_count == 0
        # IDs restart from 1
        result = reg.assign(_random_emb(seed=200), segment_duration=1.0)
        assert result["cluster_id"] == "Speaker 1"

    def test_map_speaker_success(self):
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), segment_duration=1.0)
        assert reg.map_speaker("Speaker 1", "Alice") is True
        assert reg.get_display_name("Speaker 1") == "Alice"

    def test_map_speaker_failure(self):
        reg = ClusterRegistry()
        assert reg.map_speaker("Speaker 99", "Ghost") is False

    def test_get_clusters_includes_display_name(self):
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), segment_duration=1.0)
        reg.map_speaker("Speaker 1", "Alice")
        clusters = reg.get_clusters()
        assert len(clusters) == 1
        assert clusters[0]["id"] == "Speaker 1"
        assert clusters[0]["display_name"] == "Alice"
        assert clusters[0]["count"] == 1


# ============================================================
# Invariant tests (INV-1 through INV-8)
# ============================================================

class TestInvariants:
    def test_inv1_max_clusters_not_exceeded(self):
        """INV-1: len(clusters) <= max_clusters."""
        reg = ClusterRegistry(max_clusters=3)
        for i in range(10):
            reg.assign(_random_emb(seed=i * 50), segment_duration=1.0)
        assert reg.cluster_count <= 3

    def test_inv2_centroid_dtype_and_shape(self):
        """INV-2: each cluster centroid is non-None float32 ndarray."""
        reg = ClusterRegistry()
        emb = _random_emb(seed=1, dim=192)
        reg.assign(emb, segment_duration=1.0)
        c = reg._clusters[0]
        assert c["centroid"] is not None
        assert c["centroid"].dtype == np.float32
        assert c["centroid"].shape == (192,)

    def test_inv3_ids_monotonic_and_restart_after_reset(self):
        """INV-3: cluster_id = 'Speaker N', monotonic, restart after reset."""
        reg = ClusterRegistry()
        r1 = reg.assign(_random_emb(seed=1), 1.0)
        r2 = reg.assign(_random_emb(seed=100), 1.0)
        r3 = reg.assign(_random_emb(seed=200), 1.0)
        assert r1["cluster_id"] == "Speaker 1"
        assert r2["cluster_id"] == "Speaker 2"
        assert r3["cluster_id"] == "Speaker 3"
        reg.reset()
        r4 = reg.assign(_random_emb(seed=300), 1.0)
        assert r4["cluster_id"] == "Speaker 1"

    def test_inv4_confidence_in_range(self):
        """INV-4: confidence in [0, 1]."""
        reg = ClusterRegistry()
        emb = _random_emb(seed=1)
        result = reg.assign(emb, segment_duration=1.0)
        assert 0.0 <= result["confidence"] <= 1.0
        result2 = reg.assign(_similar_emb(emb, noise_scale=0.01), 1.0)
        assert 0.0 <= result2["confidence"] <= 1.0

    def test_inv5_centroid_running_average(self):
        """INV-5: centroid = running average of assigned embeddings."""
        reg = ClusterRegistry(threshold=0.5)
        e1 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        reg.assign(e1, 1.0)

        e2 = np.array([0.95, 0.1, 0.0], dtype=np.float32)
        e2 = e2 / np.linalg.norm(e2)
        reg.assign(e2, 1.0)

        expected = (e1 * 1 + e2) / 2
        np.testing.assert_allclose(reg._clusters[0]["centroid"], expected, atol=1e-5)
        assert reg._clusters[0]["count"] == 2

    def test_inv6_map_speaker_doesnt_change_count(self):
        """INV-6: map_speaker doesn't change cluster_count."""
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), 1.0)
        reg.assign(_random_emb(seed=100), 1.0)
        before = reg.cluster_count
        reg.map_speaker("Speaker 1", "Alice")
        assert reg.cluster_count == before

    def test_inv7_reset_then_assign_restarts_ids(self):
        """INV-7: after reset, cluster_count==0 and IDs restart from 1."""
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), 1.0)
        reg.reset()
        assert reg.cluster_count == 0
        r = reg.assign(_random_emb(seed=2), 1.0)
        assert r["cluster_id"] == "Speaker 1"

    def test_inv8_ambiguous_returns_none(self):
        """INV-8: ambiguous (top1 - top2 < margin) → cluster_id=None."""
        reg = ClusterRegistry(threshold=0.5, assignment_margin=0.5)
        # Two orthogonal clusters
        e1 = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        e2 = np.array([0.0, 1.0, 0.0], dtype=np.float32)
        reg.assign(e1, 1.0)
        reg.assign(e2, 1.0)
        # Embedding equidistant to both → cosine to each ≈ 0.707
        eq = np.array([0.707, 0.707, 0.0], dtype=np.float32)
        eq = eq / np.linalg.norm(eq)
        result = reg.assign(eq, 1.0)
        # Both sims ≈ 0.707, difference ≈ 0 < margin=0.5 → ambiguous
        assert result["cluster_id"] is None


# ============================================================
# Adversarial scenario tests
# ============================================================

class TestAdversarialScenarios:
    def test_short_segment_no_effect(self):
        """Segments below min_segment_sec should not affect clusters."""
        reg = ClusterRegistry(min_segment_sec=0.8)
        for _ in range(100):
            result = reg.assign(_random_emb(seed=42), segment_duration=0.3)
            assert result["cluster_id"] is None
        assert reg.cluster_count == 0

    def test_single_speaker_stays_one_cluster(self):
        """All segments from one speaker should converge to one cluster."""
        reg = ClusterRegistry(threshold=0.8)
        base = _random_emb(seed=1)
        for i in range(10):
            reg.assign(_similar_emb(base, noise_scale=0.01, seed=i + 10), 1.0)
        assert reg.cluster_count == 1

    def test_max_clusters_blocks_new(self):
        """After hitting max_clusters, new speakers get None."""
        reg = ClusterRegistry(max_clusters=3)
        for i in range(3):
            r = reg.assign(_random_emb(seed=i * 100), 1.0)
            assert r["is_new"] is True
        # 4th different speaker blocked
        r4 = reg.assign(_random_emb(seed=999), 1.0)
        assert r4["cluster_id"] is None
        assert reg.cluster_count == 3

    def test_map_nonexistent_cluster(self):
        """Mapping a non-existent cluster returns False."""
        reg = ClusterRegistry()
        assert reg.map_speaker("Speaker 99", "Ghost") is False

    def test_map_after_reset(self):
        """Mapping after reset returns False (cluster gone)."""
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), 1.0)
        reg.reset()
        assert reg.map_speaker("Speaker 1", "Alice") is False

    def test_zero_embedding(self):
        """Zero-norm embedding should be rejected."""
        reg = ClusterRegistry()
        r = reg.assign(np.zeros(192, dtype=np.float32), 1.0)
        assert r["cluster_id"] is None
        assert reg.cluster_count == 0

    def test_nan_embedding(self):
        """NaN embedding should be rejected."""
        reg = ClusterRegistry()
        nan_emb = np.full(192, np.nan, dtype=np.float32)
        r = reg.assign(nan_emb, 1.0)
        assert r["cluster_id"] is None
        assert reg.cluster_count == 0

    def test_display_name_after_map(self):
        """get_display_name returns mapped name after map_speaker."""
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), 1.0)
        assert reg.get_display_name("Speaker 1") == "Speaker 1"
        reg.map_speaker("Speaker 1", "Alice")
        assert reg.get_display_name("Speaker 1") == "Alice"

    def test_display_name_unknown_cluster(self):
        """get_display_name for unknown cluster returns the input."""
        reg = ClusterRegistry()
        assert reg.get_display_name("Speaker 99") == "Speaker 99"

    def test_multiple_maps_last_wins(self):
        """Mapping same cluster twice → last name wins."""
        reg = ClusterRegistry()
        reg.assign(_random_emb(seed=1), 1.0)
        reg.map_speaker("Speaker 1", "Alice")
        reg.map_speaker("Speaker 1", "Bob")
        assert reg.get_display_name("Speaker 1") == "Bob"
