#!/usr/bin/env python3
"""Tests for AudioSession — enrollment, attribution, correction."""

import importlib.util
import os
import sys
import types
import unittest

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


if __name__ == "__main__":
    unittest.main()
