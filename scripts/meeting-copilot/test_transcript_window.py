#!/usr/bin/env python3
"""Tests for TranscriptWindow — rolling buffer + heuristic summarization."""

import os
import sys
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class TestTranscriptWindow(unittest.TestCase):
    def _make_window(self, window_sec=300, summary_interval_sec=300):
        from transcript_window import TranscriptWindow
        return TranscriptWindow(
            window_sec=window_sec,
            summary_interval_sec=summary_interval_sec,
        )

    def _make_line(self, ts, text, chunk_num=1):
        return {
            "ts": ts,
            "elapsed_s": 0,
            "chunk_num": chunk_num,
            "asr_latency": 0.1,
            "text": text,
        }

    def test_add_line_stores_in_raw(self):
        w = self._make_window()
        now = time.time()
        w.add_line(self._make_line(now, "hello"))
        assert len(w.get_raw_lines()) == 1
        assert w.get_raw_lines()[0]["text"] == "hello"

    def test_raw_lines_within_window(self):
        w = self._make_window(window_sec=60)
        now = time.time()
        w.add_line(self._make_line(now - 120, "old"))
        w.add_line(self._make_line(now - 30, "recent"))
        w.add_line(self._make_line(now, "now"))
        raw = w.get_raw_lines(now=now)
        texts = [l["text"] for l in raw]
        assert "old" not in texts
        assert "recent" in texts
        assert "now" in texts

    def test_summarize_old_lines(self):
        w = self._make_window(window_sec=60, summary_interval_sec=60)
        now = time.time()
        for i in range(10):
            w.add_line(self._make_line(now - 200 + i * 3, f"line {i}", chunk_num=i + 1))
        for i in range(5):
            w.add_line(self._make_line(now - 10 + i * 2, f"recent {i}", chunk_num=11 + i))

        w.maybe_summarize(now=now)
        summaries = w.get_summaries()
        assert len(summaries) >= 1
        s = summaries[0]
        assert "time_range" in s
        assert "line_count" in s
        assert s["line_count"] > 0
        assert "key_lines" in s

    def test_get_full_returns_summaries_plus_raw(self):
        w = self._make_window(window_sec=60, summary_interval_sec=60)
        now = time.time()
        for i in range(10):
            w.add_line(self._make_line(now - 200 + i * 3, f"old {i}", chunk_num=i + 1))
        for i in range(3):
            w.add_line(self._make_line(now - 5 + i, f"new {i}", chunk_num=11 + i))

        w.maybe_summarize(now=now)
        full = w.get_full(now=now)
        assert "summaries" in full
        assert "raw_lines" in full
        assert len(full["raw_lines"]) <= 5
        assert len(full["summaries"]) >= 1

    def test_get_summary_only(self):
        w = self._make_window(window_sec=60, summary_interval_sec=60)
        now = time.time()
        for i in range(10):
            w.add_line(self._make_line(now - 200 + i * 3, f"item {i}"))
        w.maybe_summarize(now=now)
        summaries = w.get_summaries()
        assert isinstance(summaries, list)

    def test_no_summarize_when_all_lines_in_window(self):
        w = self._make_window(window_sec=300)
        now = time.time()
        for i in range(5):
            w.add_line(self._make_line(now - 10 + i, f"recent {i}"))
        w.maybe_summarize(now=now)
        assert len(w.get_summaries()) == 0

    def test_summary_key_lines_capped(self):
        w = self._make_window(window_sec=10, summary_interval_sec=10)
        now = time.time()
        for i in range(50):
            w.add_line(self._make_line(now - 200 + i, f"bulk line {i}"))
        w.maybe_summarize(now=now)
        summaries = w.get_summaries()
        assert len(summaries) >= 1
        for s in summaries:
            assert len(s["key_lines"]) <= 6


    def test_get_full_no_gap_between_window_and_summaries(self):
        w = self._make_window(window_sec=60, summary_interval_sec=300)
        now = time.time()
        for i in range(20):
            w.add_line(self._make_line(now - 200 + i * 5, f"old {i}", chunk_num=i + 1))
        for i in range(3):
            w.add_line(self._make_line(now - 5 + i, f"new {i}", chunk_num=21 + i))
        full = w.get_full(now=now)
        raw_count = len(full["raw_lines"])
        sum_line_count = sum(s["line_count"] for s in full["summaries"])
        total = raw_count + sum_line_count
        assert total == 23, f"Expected 23 lines covered, got {total} (raw={raw_count}, summarized={sum_line_count})"

    def test_get_full_no_gap_when_interval_gate_blocks(self):
        """After a recent summary, new aged-out lines must still be captured."""
        w = self._make_window(window_sec=60, summary_interval_sec=300)
        now = time.time()
        for i in range(5):
            w.add_line(self._make_line(now - 400 + i * 3, f"batch1 {i}", chunk_num=i + 1))
        w.maybe_summarize(now=now - 100)
        assert len(w.get_summaries()) == 1
        for i in range(5):
            w.add_line(self._make_line(now - 90 + i * 3, f"batch2 {i}", chunk_num=6 + i))
        for i in range(3):
            w.add_line(self._make_line(now - 5 + i, f"recent {i}", chunk_num=11 + i))
        full = w.get_full(now=now)
        raw_count = len(full["raw_lines"])
        sum_line_count = sum(s["line_count"] for s in full["summaries"])
        total = raw_count + sum_line_count
        assert total == 13, f"Expected 13 lines covered, got {total} (raw={raw_count}, summarized={sum_line_count})"


class TestAudioSessionInitFields(unittest.TestCase):
    """Verify __init__ and _reset stay in sync for meeting metadata fields."""

    def test_init_has_meeting_fields(self):
        src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio-service.py")
        with open(src) as f:
            content = f.read()
        init_start = content.index("def __init__(self):")
        init_end = content.index("def _reset(self):")
        init_block = content[init_start:init_end]
        assert "self.meeting_id" in init_block, "__init__ must initialize meeting_id"
        assert "self.thread_id" in init_block, "__init__ must initialize thread_id"


if __name__ == "__main__":
    unittest.main()
