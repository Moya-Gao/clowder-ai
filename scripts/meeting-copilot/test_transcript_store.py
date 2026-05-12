#!/usr/bin/env python3
"""Tests for TranscriptArtifactStore (F195 Phase D)."""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from transcript_store import TranscriptArtifactStore


class TestTranscriptArtifactStore(unittest.TestCase):
    def test_creates_md_and_meta(self):
        with tempfile.TemporaryDirectory() as d:
            store = TranscriptArtifactStore(
                transcript_dir=d, thread_id="t1", meeting_id="m1",
                app_name="Chrome", participants=[{"id": "h", "name": "Host"}],
            )
            md_path = os.path.join(d, "t1", "transcript-m1.md")
            meta_path = os.path.join(d, "t1", "meta.json")
            self.assertTrue(os.path.exists(md_path), "transcript.md not created")
            self.assertTrue(os.path.exists(meta_path), "meta.json not created")
            with open(meta_path) as f:
                meta = json.load(f)
            self.assertTrue(meta["active"])
            self.assertEqual(meta["thread_id"], "t1")
            self.assertEqual(meta["meeting_id"], "m1")
            self.assertIn("transcript_path", meta)
            content = open(md_path).read()
            self.assertIn("Chrome", content)
            self.assertIn("m1", content)

    def test_append_lines_grouped_by_speaker(self):
        with tempfile.TemporaryDirectory() as d:
            store = TranscriptArtifactStore(d, "t1", "m1", "Chrome",
                [{"id": "a", "name": "Alice"}, {"id": "h", "name": "Host"}])
            base = store._started_at
            store.append_line({"ts": base + 5, "elapsed_s": 5, "text": "Hello",
                "speaker_label": "Alice", "speaker_confidence": 0.7, "speaker_id": "a", "chunk_num": 1})
            store.append_line({"ts": base + 8, "elapsed_s": 8, "text": "world",
                "speaker_label": "Alice", "speaker_confidence": 0.7, "speaker_id": "a", "chunk_num": 2})
            store.append_line({"ts": base + 12, "elapsed_s": 12, "text": "Hi back",
                "speaker_label": "Host", "speaker_confidence": 0.9, "speaker_id": "h", "chunk_num": 3})

            content = store._md_path.read_text()
            self.assertEqual(content.count("### 00:00:05"), 1, "Alice section header missing")
            self.assertEqual(content.count("### 00:00:12"), 1, "Host section header missing")
            self.assertIn("Alice", content)
            self.assertIn("Host", content)
            self.assertIn("Hello", content)
            self.assertIn("world", content)
            self.assertIn("Hi back", content)

    def test_same_speaker_no_duplicate_header(self):
        with tempfile.TemporaryDirectory() as d:
            store = TranscriptArtifactStore(d, "t1", "m1", "Chrome", [])
            base = store._started_at
            for i in range(5):
                store.append_line({"ts": base + i * 3, "elapsed_s": i * 3, "text": f"chunk {i}",
                    "speaker_label": "Alice", "speaker_confidence": 0.7, "speaker_id": "a", "chunk_num": i + 1})
            content = store._md_path.read_text()
            self.assertEqual(content.count("— Alice"), 1,
                f"Expected 1 Alice header, got {content.count('— Alice')}")

    def test_rolling_summary_every_30s(self):
        with tempfile.TemporaryDirectory() as d:
            store = TranscriptArtifactStore(d, "t1", "m1", "Chrome", [])
            base = store._started_at
            for i in range(12):
                store.append_line({"ts": base + i * 3, "elapsed_s": i * 3, "text": f"chunk {i}",
                    "speaker_label": "Alice", "speaker_confidence": 0.7, "speaker_id": "a", "chunk_num": i + 1})
            store.maybe_flush_summary(now=base + 35)
            content = store._md_path.read_text()
            self.assertIn("Rolling Summary", content)
            self.assertIn("00:00:00", content)

    def test_no_summary_before_30s(self):
        with tempfile.TemporaryDirectory() as d:
            store = TranscriptArtifactStore(d, "t1", "m1", "Chrome", [])
            base = store._started_at
            for i in range(5):
                store.append_line({"ts": base + i * 3, "elapsed_s": i * 3, "text": f"chunk {i}",
                    "speaker_label": "Alice", "speaker_confidence": 0.7, "speaker_id": "a", "chunk_num": i + 1})
            store.maybe_flush_summary(now=base + 20)
            content = store._md_path.read_text()
            self.assertNotIn("Rolling Summary", content)

    def test_finalize_marks_inactive_and_returns_path(self):
        with tempfile.TemporaryDirectory() as d:
            store = TranscriptArtifactStore(d, "t1", "m1", "Chrome", [])
            base = store._started_at
            store.append_line({"ts": base + 5, "elapsed_s": 5, "text": "Hello",
                "speaker_label": "Alice", "speaker_confidence": 0.7, "speaker_id": "a", "chunk_num": 1})
            result = store.finalize()
            self.assertEqual(result, str(store._md_path))
            with open(os.path.join(d, "t1", "meta.json")) as f:
                meta = json.load(f)
            self.assertFalse(meta["active"], "meta should be inactive after finalize")
            content = store._md_path.read_text()
            self.assertIn("Session ended", content)

    def test_finalize_flushes_pending_summary(self):
        with tempfile.TemporaryDirectory() as d:
            store = TranscriptArtifactStore(d, "t1", "m1", "Chrome", [])
            base = store._started_at
            for i in range(12):
                store.append_line({"ts": base + i * 3, "elapsed_s": i * 3, "text": f"chunk {i}",
                    "speaker_label": "Alice", "speaker_confidence": 0.7, "speaker_id": "a", "chunk_num": i + 1})
            store.finalize(now=base + 40)
            content = store._md_path.read_text()
            self.assertIn("Rolling Summary", content)
            self.assertIn("Session ended", content)

    def test_rejects_path_traversal_thread_id(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                TranscriptArtifactStore(d, "../escape", "m1")

    def test_rejects_slash_in_thread_id(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                TranscriptArtifactStore(d, "a/b/c", "m1")

    def test_rejects_null_byte_in_thread_id(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                TranscriptArtifactStore(d, "abc\x00def", "m1")

    def test_second_meeting_does_not_overwrite_first(self):
        with tempfile.TemporaryDirectory() as d:
            store1 = TranscriptArtifactStore(d, "t1", "m1", "Chrome", [])
            base = store1._started_at
            store1.append_line({"ts": base + 5, "elapsed_s": 5, "text": "First meeting content",
                "speaker_label": "Alice", "speaker_confidence": 0.7, "speaker_id": "a", "chunk_num": 1})
            path1 = store1.finalize()

            store2 = TranscriptArtifactStore(d, "t1", "m2", "Chrome", [])
            base2 = store2._started_at
            store2.append_line({"ts": base2 + 5, "elapsed_s": 5, "text": "Second meeting content",
                "speaker_label": "Bob", "speaker_confidence": 0.7, "speaker_id": "b", "chunk_num": 1})
            store2.finalize()

            self.assertTrue(os.path.exists(path1), "First meeting file should still exist")
            content1 = open(path1).read()
            self.assertIn("First meeting content", content1,
                "First meeting content must not be overwritten by second meeting")

    def test_different_meetings_produce_different_files(self):
        with tempfile.TemporaryDirectory() as d:
            store1 = TranscriptArtifactStore(d, "t1", "meeting-a", "Chrome", [])
            path1 = store1.finalize()
            store2 = TranscriptArtifactStore(d, "t1", "meeting-b", "Chrome", [])
            path2 = store2.finalize()
            self.assertNotEqual(path1, path2,
                "Different meeting_ids must produce different transcript files")

    def test_three_consecutive_no_meeting_id(self):
        """Three stores with empty meeting_id must all produce unique files."""
        with tempfile.TemporaryDirectory() as d:
            paths = []
            for i in range(3):
                store = TranscriptArtifactStore(d, "t1", "", "Chrome", [])
                base = store._started_at
                store.append_line({"ts": base + 5, "elapsed_s": 5, "text": f"Meeting {i} content",
                    "speaker_label": "Alice", "speaker_confidence": 0.7, "speaker_id": "a", "chunk_num": 1})
                paths.append(store.finalize())

            self.assertEqual(len(set(paths)), 3,
                f"All 3 paths must be unique, got: {paths}")
            for i, p in enumerate(paths):
                self.assertTrue(os.path.exists(p), f"File {i} must exist: {p}")
                content = open(p).read()
                self.assertIn(f"Meeting {i} content", content,
                    f"File {i} must contain its own content, not be overwritten")


    def test_meta_json_atomic_write_no_temp_residue(self):
        """After write, no .tmp file should linger and meta.json must be valid."""
        with tempfile.TemporaryDirectory() as d:
            store = TranscriptArtifactStore(d, "t1", "m1", "Chrome", [])
            base = store._started_at
            for i in range(10):
                store.append_line({"ts": base + i, "elapsed_s": i, "text": f"w{i}",
                    "speaker_label": "Alice", "speaker_confidence": 0.7, "speaker_id": "a", "chunk_num": i + 1})
            meta_path = store._meta_path
            self.assertTrue(meta_path.exists(), "meta.json must exist")
            with open(meta_path) as f:
                meta = json.load(f)
            self.assertTrue(meta["active"])
            tmp_files = list(store._dir.glob("*.tmp"))
            self.assertEqual(len(tmp_files), 0,
                f"No .tmp residue should remain after writes, found: {tmp_files}")


if __name__ == "__main__":
    unittest.main()
