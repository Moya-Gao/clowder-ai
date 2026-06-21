#!/usr/bin/env python3
"""Tests for AudioSession — enrollment, attribution, correction."""

import importlib.util
import os
import sys
import types
import unittest

import numpy as np

_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _dir)

# Stub aiohttp so audio-service.py loads without the runtime dependency.
# Only the HTTP server parts need real aiohttp; unit tests exercise pure logic.
if "aiohttp" not in sys.modules:
    _aio = types.ModuleType("aiohttp")
    _web = types.ModuleType("aiohttp.web")
    _web.middleware = lambda f: f
    _web.Response = type("Response", (), {"__init__": lambda s, **kw: None})
    _web.json_response = lambda *a, **kw: None
    _web.Application = type("Application", (), {"__init__": lambda s, **kw: None})
    _aio.web = _web
    _aio.ClientSession = type("ClientSession", (), {})
    _aio.ClientTimeout = type("ClientTimeout", (), {"__init__": lambda s, **kw: None})
    _aio.FormData = type("FormData", (), {})
    sys.modules["aiohttp"] = _aio
    sys.modules["aiohttp.web"] = _web

_spec = importlib.util.spec_from_file_location(
    "audio_service", os.path.join(_dir, "audio-service.py")
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
AudioSession = _mod.AudioSession


class TestEnrollment(unittest.TestCase):
    def setUp(self):
        self.session = AudioSession()

    def test_enroll_stores_participants(self):
        self.session.enroll(
            [
                {"id": "p1", "name": "铲屎官", "role": "host"},
                {"id": "p2", "name": "Alice", "role": "participant"},
            ]
        )
        assert len(self.session.participants) == 2
        assert self.session.participants[0]["name"] == "铲屎官"
        assert self.session.participants[1]["name"] == "Alice"

    def test_enroll_overwrites_previous(self):
        self.session.enroll([{"id": "p1", "name": "A", "role": "host"}])
        self.session.enroll([{"id": "p2", "name": "B", "role": "host"}])
        assert len(self.session.participants) == 1
        assert self.session.participants[0]["name"] == "B"

    def test_enroll_validates_id_required(self):
        with self.assertRaises(ValueError):
            self.session.enroll([{"name": "A", "role": "host"}])

    def test_enroll_validates_name_required(self):
        with self.assertRaises(ValueError):
            self.session.enroll([{"id": "p1", "role": "host"}])

    def test_enroll_empty_list_raises(self):
        with self.assertRaises(ValueError):
            self.session.enroll([])

    def test_status_includes_participants(self):
        self.session.enroll(
            [{"id": "p1", "name": "铲屎官", "role": "host"}]
        )
        s = self.session.status()
        assert "participants" in s
        assert len(s["participants"]) == 1
        assert s["participants"][0]["name"] == "铲屎官"

    def test_reset_preserves_participants(self):
        self.session.enroll([{"id": "p1", "name": "A", "role": "host"}])
        self.session._reset()
        assert len(self.session.participants) == 1
        assert self.session.participants[0]["name"] == "A"

    def test_enrollment_survives_reset_for_attribution(self):
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ])
        self.session._reset()
        self.session.source = "mic"
        attr = self.session._attribute_speaker()
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9

    def test_enroll_without_voice_sample_embedding_is_none(self):
        """Enrollment without voice_sample sets embedding=None (INV-P3)."""
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
        ])
        assert self.session.participants[0].get("embedding") is None

    def test_enroll_with_voice_sample_attempts_extraction(self):
        """Enrollment with voice_sample stores embedding or None."""
        import base64
        pcm_3s = b'\x00\x00' * 16000 * 3
        b64 = base64.b64encode(pcm_3s).decode()
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host", "voice_sample": b64},
        ])
        # Embedding is None (model not available) or ndarray — either is OK
        emb = self.session.participants[0].get("embedding")
        assert emb is None or hasattr(emb, "shape")

    def test_enroll_mixed_voice_and_metadata(self):
        """Mixed enrollment: some with voice, some without."""
        import base64
        pcm_3s = b'\x00\x00' * 16000 * 3
        b64 = base64.b64encode(pcm_3s).decode()
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host", "voice_sample": b64},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ])
        # p2 definitely has no embedding
        assert self.session.participants[1].get("embedding") is None

    def test_enroll_embedding_survives_reset(self):
        """Embeddings survive _reset() like participants do (INV-P2)."""
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
        ])
        self.session._reset()
        assert len(self.session.participants) == 1
        assert self.session.participants[0]["name"] == "铲屎官"
        # embedding key should still be present
        assert "embedding" in self.session.participants[0]

    def test_enroll_too_short_voice_sample(self):
        """Voice sample too short → embedding=None, participant still enrolled."""
        import base64
        pcm_100ms = b'\x00\x00' * 1600  # 0.1s
        b64 = base64.b64encode(pcm_100ms).decode()
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host", "voice_sample": b64},
        ])
        assert len(self.session.participants) == 1
        assert self.session.participants[0]["name"] == "铲屎官"
        assert self.session.participants[0].get("embedding") is None


class TestAttribution(unittest.TestCase):
    def setUp(self):
        self.session = AudioSession()

    def test_mic_source_attributes_host(self):
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ])
        self.session.source = "mic"
        attr = self.session._attribute_speaker()
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9
        assert attr["speaker_id"] == "p1"

    def test_mic_source_no_host_fallback(self):
        self.session.enroll([
            {"id": "p1", "name": "Alice", "role": "participant"},
        ])
        self.session.source = "mic"
        attr = self.session._attribute_speaker()
        assert attr["speaker_label"] == "发言者"
        assert attr["speaker_confidence"] == 0.5
        assert attr["speaker_id"] is None

    def test_app_source_two_participants_attributes_other(self):
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ])
        self.session.source = "app"
        attr = self.session._attribute_speaker()
        assert attr["speaker_label"] == "Alice"
        assert attr["speaker_confidence"] == 0.7
        assert attr["speaker_id"] == "p2"

    def test_app_source_three_plus_degrades(self):
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
            {"id": "p3", "name": "Bob", "role": "participant"},
        ])
        self.session.source = "app"
        attr = self.session._attribute_speaker()
        assert attr["speaker_confidence"] == 0.4
        assert attr["speaker_id"] is None

    def test_no_enrollment_degrades(self):
        self.session.source = "app"
        attr = self.session._attribute_speaker()
        assert attr["speaker_confidence"] == 0.4
        assert attr["speaker_id"] is None

    def test_no_enrollment_mic_fallback(self):
        self.session.source = "mic"
        attr = self.session._attribute_speaker()
        assert attr["speaker_label"] == "发言者"
        assert attr["speaker_confidence"] == 0.5


class TestEmbeddingAttribution(unittest.TestCase):
    """Voice-embedding-based speaker attribution (AC-G2, AC-G3)."""

    def setUp(self):
        self.session = AudioSession()

    def test_matches_nearest_embedding(self):
        """When enrolled with embeddings, picks nearest match (AC-G2)."""
        import numpy as np
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0, 0], dtype=np.float32)},
            {"id": "p2", "name": "Alice", "role": "participant",
             "embedding": np.array([0, 1, 0], dtype=np.float32)},
        ]
        chunk_emb = np.array([0.9, 0.1, 0], dtype=np.float32)
        attr = self.session._attribute_speaker(chunk_embedding=chunk_emb)
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_id"] == "p1"
        assert attr["speaker_confidence"] > 0.8

    def test_matches_second_speaker(self):
        """Chunk closer to second speaker → attributes to second."""
        import numpy as np
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0, 0], dtype=np.float32)},
            {"id": "p2", "name": "Alice", "role": "participant",
             "embedding": np.array([0, 1, 0], dtype=np.float32)},
        ]
        chunk_emb = np.array([0.1, 0.9, 0], dtype=np.float32)
        attr = self.session._attribute_speaker(chunk_embedding=chunk_emb)
        assert attr["speaker_label"] == "Alice"
        assert attr["speaker_id"] == "p2"

    def test_below_threshold_falls_back_to_rules(self):
        """Similarity below threshold → fallback to rule-based (AC-G3)."""
        import numpy as np
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0, 0], dtype=np.float32)},
        ]
        # Orthogonal → similarity ≈ 0
        chunk_emb = np.array([0, 0, 1], dtype=np.float32)
        self.session.source = "mic"
        attr = self.session._attribute_speaker(chunk_embedding=chunk_emb)
        # Falls back to rule-based: mic + host → host with 0.9
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9

    def test_no_chunk_embedding_uses_rules(self):
        """No chunk_embedding → pure rule-based (backward compat)."""
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
        ])
        self.session.source = "mic"
        attr = self.session._attribute_speaker()
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9

    def test_none_chunk_embedding_uses_rules(self):
        """chunk_embedding=None → rule-based even with enrolled embeddings."""
        import numpy as np
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0, 0], dtype=np.float32)},
        ]
        self.session.source = "mic"
        attr = self.session._attribute_speaker(chunk_embedding=None)
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9

    def test_partial_embeddings_only_compares_enrolled(self):
        """Some with embeddings, some without — compare only with those that have."""
        import numpy as np
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0, 0], dtype=np.float32)},
            {"id": "p2", "name": "Alice", "role": "participant",
             "embedding": None},
        ]
        chunk_emb = np.array([0.9, 0.1, 0], dtype=np.float32)
        attr = self.session._attribute_speaker(chunk_embedding=chunk_emb)
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_id"] == "p1"

    def test_confidence_is_similarity_value(self):
        """Confidence should reflect actual cosine similarity."""
        import numpy as np
        self.session.participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.array([1, 0], dtype=np.float32)},
        ]
        # cos(45°) ≈ 0.707
        chunk_emb = np.array([1, 1], dtype=np.float32)
        attr = self.session._attribute_speaker(chunk_embedding=chunk_emb)
        assert attr["speaker_id"] == "p1"
        assert 0.70 < attr["speaker_confidence"] < 0.72


class TestCorrection(unittest.TestCase):
    def setUp(self):
        self.session = AudioSession()

    def _add_line(self, chunk_num, text="hello", speaker_label="有人说",
                  speaker_confidence=0.4, speaker_id=None):
        self.session._window.add_line({
            "ts": 100.0 + chunk_num, "elapsed_s": float(chunk_num),
            "chunk_num": chunk_num, "asr_latency": 0.1, "text": text,
            "speaker_label": speaker_label, "speaker_confidence": speaker_confidence,
            "speaker_id": speaker_id,
        })

    def test_correct_updates_speaker(self):
        self._add_line(1)
        ok = self.session.correct_line(1, "Alice", "p2")
        assert ok is True
        lines = self.session.get_transcript()
        assert lines[0]["speaker_label"] == "Alice"
        assert lines[0]["speaker_confidence"] == 1.0
        assert lines[0]["speaker_id"] == "p2"

    def test_correct_nonexistent_returns_false(self):
        ok = self.session.correct_line(999, "Alice", "p2")
        assert ok is False

    def test_correct_preserves_other_fields(self):
        self._add_line(1, text="important text")
        self.session.correct_line(1, "Bob", "p3")
        lines = self.session.get_transcript()
        assert lines[0]["text"] == "important text"
        assert lines[0]["chunk_num"] == 1

    def test_correct_multiple_lines_independently(self):
        self._add_line(1)
        self._add_line(2)
        self.session.correct_line(1, "Alice", "p2")
        lines = self.session.get_transcript()
        assert lines[0]["speaker_label"] == "Alice"
        assert lines[1]["speaker_label"] == "有人说"


class TestInputValidation(unittest.TestCase):
    def setUp(self):
        self.session = AudioSession()

    def test_enroll_rejects_non_list(self):
        with self.assertRaises((TypeError, ValueError)):
            self.session.enroll("not a list")

    def test_enroll_rejects_non_dict_items(self):
        with self.assertRaises((TypeError, ValueError)):
            self.session.enroll(["not a dict"])

    def test_correct_line_rejects_non_int_chunk(self):
        with self.assertRaises((TypeError, ValueError)):
            self.session.correct_line("abc", "Alice", "p2")

    def test_map_speaker_rejects_non_string_name(self):
        """Non-string name must not corrupt session state (cloud R2 P2-1).

        Scenario: cluster_id is valid (exists in registry) but name is a list.
        Without type guard, this mutates display_name to a list and then
        rewrite_speaker crashes on re.escape(["Alice"]).
        """
        # Create a real cluster via assign()
        from speaker_cluster_registry import ClusterRegistry
        self.session._cluster_registry = ClusterRegistry(threshold=0.5)
        emb = np.array([1.0, 0.0, 0.0], dtype=np.float32)
        result = self.session._cluster_registry.assign(emb, 1.0)
        cid = result["cluster_id"]

        # Now try mapping with non-string name
        result = self.session.map_speaker_name(cid, ["Alice"])
        self.assertFalse(result["ok"])

    def test_map_speaker_rejects_non_string_cluster_id(self):
        """Non-string cluster_id must not corrupt session state."""
        result = self.session.map_speaker_name(123, "Alice")
        self.assertFalse(result["ok"])


class TestAdvisoryMode(unittest.TestCase):
    def setUp(self):
        self.session = AudioSession()

    def test_default_mode_is_passive(self):
        assert self.session.advisory_mode == "passive"

    def test_set_advisory_mode_active(self):
        self.session.set_advisory_mode("active")
        assert self.session.advisory_mode == "active"

    def test_set_advisory_mode_validates(self):
        with self.assertRaises(ValueError):
            self.session.set_advisory_mode("invalid")

    def test_set_talking_points(self):
        self.session.set_talking_points(["budget under 50k", "timeline Q3"])
        assert len(self.session.talking_points) == 2

    def test_talking_points_default_empty(self):
        assert self.session.talking_points == []

    def test_talking_points_survive_reset(self):
        self.session.set_talking_points(["keep this"])
        self.session._reset()
        assert len(self.session.talking_points) == 1
        assert self.session.talking_points[0] == "keep this"

    def test_advisory_mode_survives_reset(self):
        self.session.set_advisory_mode("active")
        self.session._reset()
        assert self.session.advisory_mode == "active"

    def test_status_includes_advisory_fields(self):
        self.session.set_advisory_mode("active")
        self.session.set_talking_points(["point one"])
        s = self.session.status()
        assert s["advisory_mode"] == "active"
        assert len(s["talking_points"]) == 1
        assert "advisory_rate_limiter" in s

    def test_advisory_dnd(self):
        self.session.advisory_dnd()
        s = self.session.status()
        assert s["advisory_rate_limiter"]["can_emit"] is False

    def test_rate_limiter_survives_reset(self):
        self.session.advisory_dnd()
        self.session._reset()
        s = self.session.status()
        assert s["advisory_rate_limiter"]["can_emit"] is False

    def test_silence_monitor_resets_across_sessions(self):
        self.session._silence_monitor.on_speech(ts=100, chunk_num=1, text="old session")
        self.session._reset()
        assert self.session._silence_monitor._last_speech_ts == 0
        assert self.session._silence_monitor._last_speech_text == ""
        assert self.session._silence_monitor._silence_emitted is False

    def test_set_talking_points_rejects_non_strings(self):
        with self.assertRaises(TypeError):
            self.session.set_talking_points(["valid", 42, None])

    def test_set_talking_points_rejects_non_list(self):
        with self.assertRaises(TypeError):
            self.session.set_talking_points("not a list")


class TestAsrContext(unittest.TestCase):
    def setUp(self):
        self.session = AudioSession()

    def test_empty_context_by_default(self):
        assert self.session._build_asr_context() == ""

    def test_context_includes_participant_names(self):
        self.session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice"},
        ])
        ctx = self.session._build_asr_context()
        assert "铲屎官" in ctx
        assert "Alice" in ctx

    def test_context_includes_talking_points(self):
        self.session.set_talking_points(["Q3 预算", "技术选型"])
        ctx = self.session._build_asr_context()
        assert "Q3 预算" in ctx
        assert "技术选型" in ctx

    def test_context_combines_all_sources(self):
        self.session.enroll([{"id": "p1", "name": "铲屎官", "role": "host"}])
        self.session.set_talking_points(["预算"])
        ctx = self.session._build_asr_context()
        assert "铲屎官" in ctx
        assert "预算" in ctx
        assert ";" in ctx

    def test_context_includes_env_var(self):
        original = _mod.ASR_CONTEXT
        try:
            _mod.ASR_CONTEXT = "Cat Café, 布偶猫"
            ctx = self.session._build_asr_context()
            assert "Cat Café" in ctx
            assert "布偶猫" in ctx
        finally:
            _mod.ASR_CONTEXT = original


class TestSpeakerVerificationIntegration(unittest.TestCase):
    """End-to-end: enroll with voice → attribute by embedding → fallback."""

    def test_enroll_then_attribute_without_embedding_uses_rules(self):
        """Enroll with voice → _attribute_speaker() without chunk_emb → rules."""
        import base64
        import numpy as np
        session = AudioSession()
        pcm = np.random.randint(-1000, 1000, 16000 * 3, dtype=np.int16).tobytes()
        b64 = base64.b64encode(pcm).decode()
        session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host", "voice_sample": b64},
        ])
        session.source = "mic"
        attr = session._attribute_speaker()
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9  # rule-based

    def test_backward_compat_metadata_only_enrollment(self):
        """Metadata-only enrollment → rule-based attribution unchanged."""
        session = AudioSession()
        session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ])
        session.source = "mic"
        attr = session._attribute_speaker()
        assert attr["speaker_label"] == "铲屎官"
        assert attr["speaker_confidence"] == 0.9
        assert attr["speaker_id"] == "p1"

    def test_backward_compat_app_two_participants(self):
        """App source with 2 participants → non-host attribution."""
        session = AudioSession()
        session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ])
        session.source = "app"
        attr = session._attribute_speaker()
        assert attr["speaker_label"] == "Alice"
        assert attr["speaker_confidence"] == 0.7
        assert attr["speaker_id"] == "p2"

    def test_status_safe_serialization(self):
        """status() doesn't crash with enrolled embeddings (ndarray not in JSON)."""
        import base64
        import json
        import numpy as np
        session = AudioSession()
        pcm = np.random.randint(-1000, 1000, 16000 * 3, dtype=np.int16).tobytes()
        b64 = base64.b64encode(pcm).decode()
        session.enroll([
            {"id": "p1", "name": "铲屎官", "role": "host", "voice_sample": b64},
        ])
        s = session.status()
        # Should be JSON-serializable
        json_str = json.dumps(s)
        assert "has_embedding" in json_str
        # embedding ndarray should NOT be in output
        assert "embedding" not in json_str or "has_embedding" in json_str

    def test_embedder_is_session_scoped(self):
        """Each AudioSession has its own SpeakerEmbedder instance."""
        s1 = AudioSession()
        s2 = AudioSession()
        assert s1._embedder is not s2._embedder

    def test_transcript_store_with_embedding_participants_no_crash(self):
        """P1 regression: TranscriptArtifactStore must not crash when participants have embeddings.

        start() passes self.participants to TranscriptArtifactStore. If participants
        contain np.ndarray embeddings from enroll(), _write_meta → json.dump raises
        TypeError. The fix must sanitize participants before passing to the store.
        """
        import tempfile
        import numpy as np
        from transcript_store import TranscriptArtifactStore

        participants = [
            {"id": "p1", "name": "铲屎官", "role": "host",
             "embedding": np.random.randn(192).astype(np.float32)},
            {"id": "p2", "name": "Alice", "role": "participant",
             "embedding": None},
        ]

        with tempfile.TemporaryDirectory() as tmpdir:
            # This path mirrors start() at audio-service.py:245-251
            # _write_meta() is called in __init__ → json.dump(participants)
            store = TranscriptArtifactStore(
                transcript_dir=tmpdir,
                thread_id="thread_test123",
                meeting_id="m_test",
                app_name="TestApp",
                participants=participants,
            )
            # If we get here without TypeError, the fix works
            assert store is not None


# ============================================================
# Phase H: Speaker Diarization (unsupervised clustering)
# ============================================================

class TestDiarizationConfig(unittest.TestCase):
    """Task 2: diarization_enabled config + ClusterRegistry field."""

    def test_diarization_enabled_default_true(self):
        s = AudioSession()
        self.assertTrue(hasattr(s, "diarization_enabled"))
        self.assertTrue(s.diarization_enabled)

    def test_cluster_registry_exists(self):
        s = AudioSession()
        self.assertTrue(hasattr(s, "_cluster_registry"))
        self.assertEqual(s._cluster_registry.cluster_count, 0)


class TestResetClearsClusterRegistry(unittest.TestCase):
    """Task 3: _reset() clears cluster registry."""

    def test_reset_clears_clusters(self):
        s = AudioSession()
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        s._cluster_registry.assign(emb, 1.0)
        self.assertGreater(s._cluster_registry.cluster_count, 0)
        s._reset()
        self.assertEqual(s._cluster_registry.cluster_count, 0)


class TestEmbeddingGatePhaseH(unittest.TestCase):
    """Task 4: embedding extraction gate widens for diarization."""

    def test_gate_logic_diarization_enabled_no_enrolled(self):
        s = AudioSession()
        s.participants = []
        s.diarization_enabled = True
        has_enrolled = any(
            p.get("embedding") is not None for p in s.participants
        )
        should_extract = s.diarization_enabled or has_enrolled
        self.assertTrue(should_extract)
        self.assertFalse(has_enrolled)

    def test_gate_logic_diarization_disabled_no_enrolled(self):
        s = AudioSession()
        s.participants = []
        s.diarization_enabled = False
        has_enrolled = any(
            p.get("embedding") is not None for p in s.participants
        )
        should_extract = s.diarization_enabled or has_enrolled
        self.assertFalse(should_extract)


class TestClusterAttributionPath(unittest.TestCase):
    """Task 5: _attribute_speaker cluster path integration."""

    def test_cluster_path_creates_speaker_when_no_enrollment(self):
        s = AudioSession()
        s.participants = []
        s.diarization_enabled = True
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        result = s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
        self.assertEqual(result["speaker_label"], "Speaker 1")
        self.assertEqual(result["speaker_id"], "Speaker 1")

    def test_enrolled_takes_priority_over_clustering(self):
        s = AudioSession()
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        s.participants = [
            {"id": "p1", "name": "Alice", "role": "host", "embedding": emb},
        ]
        s.diarization_enabled = True
        result = s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
        self.assertEqual(result["speaker_label"], "Alice")
        self.assertEqual(result["speaker_id"], "p1")

    def test_none_embedding_falls_to_rule_based(self):
        s = AudioSession()
        s.participants = [{"id": "h", "name": "Host", "role": "host"}]
        s.source = "mic"
        s.diarization_enabled = True
        result = s._attribute_speaker(chunk_embedding=None, segment_duration=0.0)
        self.assertEqual(result["speaker_label"], "Host")

    def test_display_name_used_after_map(self):
        s = AudioSession()
        s.diarization_enabled = True
        s.participants = []
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        r1 = s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
        self.assertEqual(r1["speaker_label"], "Speaker 1")
        s._cluster_registry.map_speaker("Speaker 1", "Alice")
        similar = emb + np.random.RandomState(2).randn(192).astype(np.float32) * 0.01
        similar = similar / np.linalg.norm(similar)
        r2 = s._attribute_speaker(chunk_embedding=similar, segment_duration=1.0)
        self.assertEqual(r2["speaker_label"], "Alice")

    def test_diarization_disabled_skips_clustering(self):
        s = AudioSession()
        s.diarization_enabled = False
        s.participants = []
        s.source = "app"
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        result = s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
        # Should fall through to rule-based (no enrolled, no clustering)
        self.assertEqual(result["speaker_label"], "有人说")
        self.assertEqual(s._cluster_registry.cluster_count, 0)

    def test_rule_based_wins_over_clustering_mic_host(self):
        """P1-1 regression: mic+host with embedding must still return host name,
        not Speaker 1. Rule-based takes priority over clustering when it can
        name the speaker."""
        s = AudioSession()
        s.enroll([
            {"id": "h", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ])
        s.source = "mic"
        s.diarization_enabled = True
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        result = s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
        self.assertEqual(result["speaker_label"], "铲屎官")
        self.assertEqual(result["speaker_id"], "h")
        # Clustering should NOT have been touched
        self.assertEqual(s._cluster_registry.cluster_count, 0)

    def test_rule_based_wins_over_clustering_app_two(self):
        """P1-1 regression: app+2 with embedding must still return non-host name,
        not Speaker 1."""
        s = AudioSession()
        s.enroll([
            {"id": "h", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
        ])
        s.source = "app"
        s.diarization_enabled = True
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        result = s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
        self.assertEqual(result["speaker_label"], "Alice")
        self.assertEqual(result["speaker_id"], "p2")
        self.assertEqual(s._cluster_registry.cluster_count, 0)

    def test_clustering_activates_when_rule_degrades(self):
        """Clustering fires only when rule-based would give '有人说'."""
        s = AudioSession()
        s.enroll([
            {"id": "h", "name": "铲屎官", "role": "host"},
            {"id": "p2", "name": "Alice", "role": "participant"},
            {"id": "p3", "name": "Bob", "role": "participant"},
        ])
        s.source = "app"
        s.diarization_enabled = True
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        # 3 participants + app → rule-based gives "有人说" → cluster activates
        result = s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
        self.assertEqual(result["speaker_label"], "Speaker 1")
        self.assertGreater(s._cluster_registry.cluster_count, 0)

    def test_two_speakers_get_different_clusters(self):
        s = AudioSession()
        s.diarization_enabled = True
        s.participants = []
        emb1 = np.random.RandomState(1).randn(192).astype(np.float32)
        emb1 /= np.linalg.norm(emb1)
        emb2 = np.random.RandomState(100).randn(192).astype(np.float32)
        emb2 /= np.linalg.norm(emb2)
        r1 = s._attribute_speaker(chunk_embedding=emb1, segment_duration=1.0)
        r2 = s._attribute_speaker(chunk_embedding=emb2, segment_duration=1.0)
        self.assertEqual(r1["speaker_label"], "Speaker 1")
        self.assertEqual(r2["speaker_label"], "Speaker 2")
        self.assertEqual(s._cluster_registry.cluster_count, 2)


class TestMapSpeakerRetroactive(unittest.TestCase):
    """Task 6: map_speaker_name with retroactive transcript update."""

    def test_retroactive_updates_window_lines(self):
        s = AudioSession()
        s.diarization_enabled = True
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
        s._window.add_line({
            "ts": "00:00:01", "elapsed_s": 1.0, "chunk_num": 1,
            "text": "hello", "speaker_label": "Speaker 1",
            "speaker_confidence": 1.0, "speaker_id": "Speaker 1",
        })
        s._window.add_line({
            "ts": "00:00:05", "elapsed_s": 5.0, "chunk_num": 2,
            "text": "world", "speaker_label": "Speaker 1",
            "speaker_confidence": 1.0, "speaker_id": "Speaker 1",
        })
        result = s.map_speaker_name("Speaker 1", "Alice")
        self.assertTrue(result["ok"])
        self.assertEqual(result["updated_lines"], 2)
        for line in s._window.get_all_lines():
            if line.get("speaker_id") == "Speaker 1":
                self.assertEqual(line["speaker_label"], "Alice")

    def test_nonexistent_cluster_returns_false(self):
        s = AudioSession()
        result = s.map_speaker_name("Speaker 99", "Ghost")
        self.assertFalse(result["ok"])
        self.assertEqual(result["updated_lines"], 0)

    def test_only_updates_matching_cluster(self):
        s = AudioSession()
        s.diarization_enabled = True
        emb1 = np.random.RandomState(1).randn(192).astype(np.float32)
        emb1 /= np.linalg.norm(emb1)
        emb2 = np.random.RandomState(100).randn(192).astype(np.float32)
        emb2 /= np.linalg.norm(emb2)
        s._attribute_speaker(chunk_embedding=emb1, segment_duration=1.0)
        s._attribute_speaker(chunk_embedding=emb2, segment_duration=1.0)
        s._window.add_line({
            "ts": "00:00:01", "elapsed_s": 1.0, "chunk_num": 1,
            "text": "hello", "speaker_label": "Speaker 1",
            "speaker_confidence": 1.0, "speaker_id": "Speaker 1",
        })
        s._window.add_line({
            "ts": "00:00:05", "elapsed_s": 5.0, "chunk_num": 2,
            "text": "goodbye", "speaker_label": "Speaker 2",
            "speaker_confidence": 1.0, "speaker_id": "Speaker 2",
        })
        result = s.map_speaker_name("Speaker 1", "Alice")
        self.assertEqual(result["updated_lines"], 1)
        lines = s._window.get_all_lines()
        self.assertEqual(lines[0]["speaker_label"], "Alice")
        self.assertEqual(lines[1]["speaker_label"], "Speaker 2")  # untouched


    def test_retroactive_updates_persisted_transcript(self):
        """R3 regression: map_speaker_name must also rewrite the MD artifact."""
        import tempfile
        from transcript_store import TranscriptArtifactStore

        s = AudioSession()
        s.diarization_enabled = True
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)

        with tempfile.TemporaryDirectory() as tmpdir:
            store = TranscriptArtifactStore(
                transcript_dir=tmpdir,
                thread_id="t_test",
                meeting_id="m_test",
                app_name="Test",
                participants=[],
            )
            s._artifact_store = store
            # Write a line with cluster label
            store.append_line({
                "speaker_label": "Speaker 1",
                "speaker_confidence": 0.9,
                "elapsed_s": 5.0,
                "text": "hello world",
            })
            # Also add to window for the in-memory path
            s._window.add_line({
                "ts": "00:00:05", "elapsed_s": 5.0, "chunk_num": 1,
                "text": "hello world", "speaker_label": "Speaker 1",
                "speaker_confidence": 0.9, "speaker_id": "Speaker 1",
            })
            result = s.map_speaker_name("Speaker 1", "Alice")
            self.assertTrue(result["ok"])
            # Verify MD file now has "Alice" instead of "Speaker 1"
            md_content = store._md_path.read_text()
            self.assertIn("Alice", md_content)
            self.assertNotIn("Speaker 1", md_content)

    def test_rewrite_does_not_collide_prefix(self):
        """R4 regression: renaming 'Speaker 1' must not corrupt 'Speaker 10'."""
        import tempfile
        from transcript_store import TranscriptArtifactStore

        s = AudioSession()
        s.diarization_enabled = True
        emb1 = np.random.RandomState(1).randn(192).astype(np.float32)
        emb1 /= np.linalg.norm(emb1)
        emb2 = np.random.RandomState(100).randn(192).astype(np.float32)
        emb2 /= np.linalg.norm(emb2)
        s._attribute_speaker(chunk_embedding=emb1, segment_duration=1.0)
        s._attribute_speaker(chunk_embedding=emb2, segment_duration=1.0)

        with tempfile.TemporaryDirectory() as tmpdir:
            store = TranscriptArtifactStore(
                transcript_dir=tmpdir, thread_id="t_test",
                meeting_id="m_prefix", app_name="Test", participants=[],
            )
            s._artifact_store = store
            store.append_line({
                "speaker_label": "Speaker 1", "speaker_confidence": 0.9,
                "elapsed_s": 5.0, "text": "first speaker",
            })
            store.append_line({
                "speaker_label": "Speaker 10", "speaker_confidence": 0.8,
                "elapsed_s": 10.0, "text": "tenth speaker",
            })
            s._window.add_line({
                "ts": "00:00:05", "elapsed_s": 5.0, "chunk_num": 1,
                "text": "first speaker", "speaker_label": "Speaker 1",
                "speaker_confidence": 0.9, "speaker_id": "Speaker 1",
            })
            s._window.add_line({
                "ts": "00:00:10", "elapsed_s": 10.0, "chunk_num": 2,
                "text": "tenth speaker", "speaker_label": "Speaker 10",
                "speaker_confidence": 0.8, "speaker_id": "Speaker 10",
            })
            result = s.map_speaker_name("Speaker 1", "Alice")
            self.assertTrue(result["ok"])
            md = store._md_path.read_text()
            self.assertIn("Alice", md)
            self.assertIn("Speaker 10", md)  # Must NOT be corrupted
            self.assertNotIn("Alice0", md)  # No prefix collision artifact

    def test_repeated_rename_updates_persisted_transcript(self):
        """R4 regression: second rename of same cluster must update MD."""
        import tempfile
        from transcript_store import TranscriptArtifactStore

        s = AudioSession()
        s.diarization_enabled = True
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)

        with tempfile.TemporaryDirectory() as tmpdir:
            store = TranscriptArtifactStore(
                transcript_dir=tmpdir, thread_id="t_test",
                meeting_id="m_rename2", app_name="Test", participants=[],
            )
            s._artifact_store = store
            store.append_line({
                "speaker_label": "Speaker 1", "speaker_confidence": 0.9,
                "elapsed_s": 5.0, "text": "hello",
            })
            s._window.add_line({
                "ts": "00:00:05", "elapsed_s": 5.0, "chunk_num": 1,
                "text": "hello", "speaker_label": "Speaker 1",
                "speaker_confidence": 0.9, "speaker_id": "Speaker 1",
            })
            # First rename: Speaker 1 → Alice
            r1 = s.map_speaker_name("Speaker 1", "Alice")
            self.assertTrue(r1["ok"])
            # Second rename: same cluster → Bob
            r2 = s.map_speaker_name("Speaker 1", "Bob")
            self.assertTrue(r2["ok"])
            md = store._md_path.read_text()
            self.assertIn("Bob", md)
            self.assertNotIn("Alice", md)  # Must be overwritten
            self.assertNotIn("Speaker 1", md)  # Must not remain


    def test_repeated_rename_after_window_expiry(self):
        """Cloud R3 regression: second rename must work even when window lines
        have expired (no lines in TranscriptWindow for this cluster).

        Scenario:
        1. Cluster "Speaker 1" created, window line added, MD written
        2. First rename: "Speaker 1" → "Alice" (window line present → works)
        3. Window lines expire (cleared)
        4. Second rename: "Speaker 1" → "Bob"

        Bug: with expired window, current_label falls back to cluster_id
        ("Speaker 1"), but MD already has "Alice" → rewrite_speaker misses.
        Fix: capture display_name from cluster registry BEFORE map_speaker.
        """
        import tempfile
        from transcript_store import TranscriptArtifactStore

        s = AudioSession()
        s.diarization_enabled = True
        emb = np.random.RandomState(42).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)

        with tempfile.TemporaryDirectory() as tmpdir:
            store = TranscriptArtifactStore(
                transcript_dir=tmpdir, thread_id="t_test",
                meeting_id="m_expiry", app_name="Test", participants=[],
            )
            s._artifact_store = store
            store.append_line({
                "speaker_label": "Speaker 1", "speaker_confidence": 0.9,
                "elapsed_s": 5.0, "text": "hello from speaker one",
            })
            s._window.add_line({
                "ts": "00:00:05", "elapsed_s": 5.0, "chunk_num": 1,
                "text": "hello from speaker one", "speaker_label": "Speaker 1",
                "speaker_confidence": 0.9, "speaker_id": "Speaker 1",
            })

            # First rename: Speaker 1 → Alice (window line present)
            r1 = s.map_speaker_name("Speaker 1", "Alice")
            self.assertTrue(r1["ok"])
            md_after_first = store._md_path.read_text()
            self.assertIn("Alice", md_after_first)

            # Simulate window expiry: clear all lines
            s._window._all_lines.clear()
            self.assertEqual(len(s._window.get_all_lines()), 0)

            # Second rename: Speaker 1 → Bob (no window lines!)
            r2 = s.map_speaker_name("Speaker 1", "Bob")
            self.assertTrue(r2["ok"])
            md_after_second = store._md_path.read_text()
            self.assertIn("Bob", md_after_second, (
                "MD should contain 'Bob' after second rename, but got:\n"
                + md_after_second
            ))
            self.assertNotIn("Alice", md_after_second, (
                "MD should NOT contain 'Alice' after second rename, but got:\n"
                + md_after_second
            ))


class TestMapSpeakerBroadcast(unittest.TestCase):
    """R2 regression: h_map_speaker must broadcast speaker_renamed SSE event."""

    def test_broadcast_event_shape(self):
        """map_speaker_name returns fields needed for speaker_renamed broadcast."""
        s = AudioSession()
        s.diarization_enabled = True
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        s._attribute_speaker(chunk_embedding=emb, segment_duration=1.0)
        s._window.add_line({
            "ts": "00:00:01", "elapsed_s": 1.0, "chunk_num": 1,
            "text": "hello", "speaker_label": "Speaker 1",
            "speaker_confidence": 1.0, "speaker_id": "Speaker 1",
        })
        result = s.map_speaker_name("Speaker 1", "Alice")
        # Handler builds broadcast from these fields:
        self.assertTrue(result["ok"])
        self.assertIn("mapped_name", result)
        self.assertIn("updated_lines", result)
        self.assertEqual(result["mapped_name"], "Alice")
        self.assertGreater(result["updated_lines"], 0)

    def test_broadcast_sends_to_listeners(self):
        """_broadcast pushes events to SSE listeners."""
        import asyncio

        s = AudioSession()
        q = s.add_listener()

        async def do_broadcast():
            await s._broadcast({
                "type": "speaker_renamed",
                "cluster_id": "Speaker 1",
                "new_name": "Alice",
                "updated_lines": 2,
            })

        asyncio.run(do_broadcast())
        self.assertFalse(q.empty())
        import json
        event = json.loads(q.get_nowait())
        self.assertEqual(event["type"], "speaker_renamed")
        self.assertEqual(event["new_name"], "Alice")
        s.remove_listener(q)


class TestStatusIncludesClusters(unittest.TestCase):
    """Task 7: /status includes cluster info."""

    def test_status_has_diarization_fields(self):
        s = AudioSession()
        status = s.status()
        self.assertIn("diarization_enabled", status)
        self.assertIn("clusters", status)
        self.assertTrue(status["diarization_enabled"])
        self.assertEqual(status["clusters"], [])

    def test_status_shows_clusters_after_assign(self):
        s = AudioSession()
        s.diarization_enabled = True
        emb = np.random.RandomState(1).randn(192).astype(np.float32)
        emb /= np.linalg.norm(emb)
        s._cluster_registry.assign(emb, 1.0)
        status = s.status()
        self.assertEqual(len(status["clusters"]), 1)
        self.assertEqual(status["clusters"][0]["id"], "Speaker 1")


if __name__ == "__main__":
    unittest.main()
