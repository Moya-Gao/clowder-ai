#!/usr/bin/env python3
"""Tests for AdvisoryRateLimiter, SilenceMonitor, InterventionDetector."""

import os
import sys
import unittest

_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _dir)

from intervention import AdvisoryRateLimiter, SilenceMonitor, InterventionDetector


class TestAdvisoryRateLimiter(unittest.TestCase):
    def test_first_emission_allowed(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300)
        assert limiter.can_emit(now=1000) is True

    def test_second_emission_within_interval_blocked(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300)
        limiter.record_emission(now=1000)
        assert limiter.can_emit(now=1100) is False

    def test_emission_after_interval_allowed(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300)
        limiter.record_emission(now=1000)
        assert limiter.can_emit(now=1301) is True

    def test_dnd_blocks_all(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300, dnd_duration_s=900)
        limiter.set_dnd(now=1000)
        assert limiter.can_emit(now=1500) is False

    def test_dnd_expires(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300, dnd_duration_s=900)
        limiter.set_dnd(now=1000)
        assert limiter.can_emit(now=1901) is True

    def test_status_reports_state(self):
        limiter = AdvisoryRateLimiter()
        s = limiter.status()
        assert "can_emit" in s
        assert "dnd_until" in s
        assert "last_emission" in s

    def test_dnd_plus_interval(self):
        limiter = AdvisoryRateLimiter(min_interval_s=300, dnd_duration_s=900)
        limiter.record_emission(now=1000)
        limiter.set_dnd(now=1000)
        assert limiter.can_emit(now=1301) is False
        assert limiter.can_emit(now=1901) is True


class TestSilenceMonitor(unittest.TestCase):
    def test_no_event_during_speech(self):
        mon = SilenceMonitor(threshold_s=5.0)
        mon.on_speech(ts=100, chunk_num=1, text="hello")
        result = mon.on_chunk(ts=103, has_speech=True)
        assert result is None

    def test_emits_after_silence_threshold(self):
        mon = SilenceMonitor(threshold_s=5.0)
        mon.on_speech(ts=100, chunk_num=1, text="last words")
        for t in range(101, 105):
            mon.on_chunk(ts=float(t), has_speech=False)
        result = mon.on_chunk(ts=105.0, has_speech=False)
        assert result is not None
        assert result["reason"] == "extended_silence"
        assert result["source_text"] == "last words"
        assert result["source_chunk_num"] == 1

    def test_no_re_emit_for_same_silence(self):
        mon = SilenceMonitor(threshold_s=5.0)
        mon.on_speech(ts=100, chunk_num=1, text="hello")
        for t in range(101, 105):
            mon.on_chunk(ts=float(t), has_speech=False)
        mon.on_chunk(ts=105.0, has_speech=False)  # first emit
        result = mon.on_chunk(ts=108.0, has_speech=False)
        assert result is None

    def test_resets_on_new_speech(self):
        mon = SilenceMonitor(threshold_s=5.0)
        mon.on_speech(ts=100, chunk_num=1, text="first")
        for t in range(101, 106):
            mon.on_chunk(ts=float(t), has_speech=False)
        mon.on_speech(ts=110, chunk_num=2, text="second")
        mon.on_chunk(ts=110.0, has_speech=True)
        for t in range(111, 115):
            mon.on_chunk(ts=float(t), has_speech=False)
        result = mon.on_chunk(ts=115.0, has_speech=False)
        assert result is not None
        assert result["source_text"] == "second"

    def test_no_emit_before_any_speech(self):
        mon = SilenceMonitor(threshold_s=5.0)
        for t in range(0, 10):
            result = mon.on_chunk(ts=float(t), has_speech=False)
        assert result is None

    def test_evidence_fields_present(self):
        mon = SilenceMonitor(threshold_s=5.0)
        mon.on_speech(ts=100, chunk_num=3, text="test speech")
        for t in range(101, 105):
            mon.on_chunk(ts=float(t), has_speech=False)
        result = mon.on_chunk(ts=105.0, has_speech=False)
        assert result is not None
        for field in ["reason", "confidence", "source_chunk_num",
                      "source_text", "talking_point", "ts"]:
            assert field in result


class TestInterventionDetector(unittest.TestCase):
    def test_detects_question_english(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "What do you think about this?", "chunk_num": 5,
                  "ts": 100, "elapsed_s": 60},
            talking_points=[])
        assert result is not None
        assert result["reason"] == "question_detected"
        assert result["source_chunk_num"] == 5

    def test_detects_question_chinese(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "你觉得呢？", "chunk_num": 6,
                  "ts": 101, "elapsed_s": 61},
            talking_points=[])
        assert result is not None
        assert result["reason"] == "question_detected"

    def test_detects_question_chinese_without_mark(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "你怎么看", "chunk_num": 7,
                  "ts": 102, "elapsed_s": 62},
            talking_points=[])
        assert result is not None
        assert result["reason"] == "question_detected"

    def test_keyword_match_with_talking_point(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "We should discuss the budget allocation plan",
                  "chunk_num": 15, "ts": 200, "elapsed_s": 100},
            talking_points=["budget should stay under 50k"])
        assert result is not None
        assert result["reason"] == "keyword_match"
        assert result["talking_point"] == "budget should stay under 50k"

    def test_no_detection_on_normal_speech(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "The weather is nice today", "chunk_num": 1,
                  "ts": 100, "elapsed_s": 1},
            talking_points=[])
        assert result is None

    def test_keyword_match_without_talking_points_no_trigger(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "We should discuss the budget",
                  "chunk_num": 15, "ts": 200, "elapsed_s": 100},
            talking_points=[])
        assert result is None

    def test_every_event_has_evidence_fields(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "你怎么看？", "chunk_num": 3,
                  "ts": 100, "elapsed_s": 30},
            talking_points=[])
        assert result is not None
        for field in ["reason", "confidence", "source_chunk_num",
                      "source_text", "talking_point"]:
            assert field in result

    def test_single_keyword_overlap_not_enough(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "The budget looks fine", "chunk_num": 20,
                  "ts": 300, "elapsed_s": 200},
            talking_points=["budget should stay under 50k"])
        assert result is None


    def test_keyword_match_chinese_talking_point(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "下个季度的预算分配方案需要调整", "chunk_num": 20,
                  "ts": 300, "elapsed_s": 200},
            talking_points=["预算分配不要超过去年"])
        assert result is not None
        assert result["reason"] == "keyword_match"
        assert result["talking_point"] == "预算分配不要超过去年"

    def test_keyword_match_chinese_three_char_overlap(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "我们的时间线太紧了", "chunk_num": 23,
                  "ts": 303, "elapsed_s": 203},
            talking_points=["时间线要在Q3之前确定"])
        assert result is not None
        assert result["reason"] == "keyword_match"

    def test_chinese_single_bigram_not_enough(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "今天天气不错", "chunk_num": 21,
                  "ts": 301, "elapsed_s": 201},
            talking_points=["今天的会议议程"])
        assert result is None

    def test_mixed_cjk_english_keyword_match(self):
        det = InterventionDetector()
        result = det.check(
            line={"text": "The 预算 allocation needs review for Q3 时间线",
                  "chunk_num": 22, "ts": 302, "elapsed_s": 202},
            talking_points=["预算 should stay under 50k by Q3 时间线"])
        assert result is not None
        assert result["reason"] == "keyword_match"


if __name__ == "__main__":
    unittest.main()
