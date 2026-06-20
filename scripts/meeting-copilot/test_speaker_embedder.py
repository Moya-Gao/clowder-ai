#!/usr/bin/env python3
"""Tests for SpeakerEmbedder — voice embedding extraction + cosine similarity."""

import os
import sys
import unittest

import numpy as np

_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _dir)


class TestSimilarity(unittest.TestCase):
    """Cosine similarity: pure math, no model needed."""

    def setUp(self):
        from speaker_embedder import SpeakerEmbedder
        self.emb = SpeakerEmbedder()

    def test_identical_vectors(self):
        v = np.random.randn(512).astype(np.float32)
        assert abs(self.emb.similarity(v, v) - 1.0) < 1e-6

    def test_orthogonal_vectors(self):
        v1 = np.array([1, 0, 0, 0], dtype=np.float32)
        v2 = np.array([0, 1, 0, 0], dtype=np.float32)
        assert abs(self.emb.similarity(v1, v2)) < 1e-6

    def test_opposite_vectors(self):
        v = np.array([1, 2, 3], dtype=np.float32)
        assert abs(self.emb.similarity(v, -v) + 1.0) < 1e-6

    def test_range_always_valid(self):
        for _ in range(20):
            v1 = np.random.randn(512).astype(np.float32)
            v2 = np.random.randn(512).astype(np.float32)
            s = self.emb.similarity(v1, v2)
            assert -1.0 - 1e-6 <= s <= 1.0 + 1e-6

    def test_zero_vector_returns_zero(self):
        v = np.array([1, 2, 3], dtype=np.float32)
        z = np.zeros(3, dtype=np.float32)
        assert self.emb.similarity(v, z) == 0.0


class TestExtract(unittest.TestCase):
    """Embedding extraction — exercises interface, model may not be available."""

    def setUp(self):
        from speaker_embedder import SpeakerEmbedder
        self.emb = SpeakerEmbedder()

    def test_too_short_returns_none(self):
        pcm_100ms = b'\x00\x00' * 1600  # 0.1s at 16kHz
        result = self.emb.extract(pcm_100ms)
        assert result is None

    def test_extract_returns_ndarray_or_none(self):
        """Valid-length audio returns ndarray (if model available) or None."""
        pcm_2s = b'\x00\x00' * 16000 * 2
        result = self.emb.extract(pcm_2s)
        assert result is None or isinstance(result, np.ndarray)

    def test_extract_deterministic(self):
        """Same PCM → same embedding (INV-E2)."""
        pcm_3s = b'\x00\x00' * 16000 * 3
        r1 = self.emb.extract(pcm_3s)
        r2 = self.emb.extract(pcm_3s)
        if r1 is not None and r2 is not None:
            np.testing.assert_allclose(r1, r2, atol=1e-6)

    def test_model_load_failure_graceful(self):
        """Nonexistent model → extract() returns None, no crash (INV-E3)."""
        from speaker_embedder import SpeakerEmbedder
        bad = SpeakerEmbedder(model_id="nonexistent/model-that-does-not-exist")
        pcm_3s = b'\x00\x00' * 16000 * 3
        result = bad.extract(pcm_3s)
        assert result is None


class TestPerformance(unittest.TestCase):
    """Performance budget (AC-G5)."""

    def test_similarity_computation_fast(self):
        """1000 cosine similarity computations < 1s."""
        import time
        from speaker_embedder import SpeakerEmbedder
        emb = SpeakerEmbedder()
        v1 = np.random.randn(512).astype(np.float32)
        v2 = np.random.randn(512).astype(np.float32)
        t0 = time.perf_counter()
        for _ in range(1000):
            emb.similarity(v1, v2)
        elapsed = time.perf_counter() - t0
        assert elapsed < 1.0, f"1000 similarity computations took {elapsed:.3f}s"


if __name__ == "__main__":
    unittest.main()
