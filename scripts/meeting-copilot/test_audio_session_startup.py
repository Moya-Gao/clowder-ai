#!/usr/bin/env python3
"""Tests for AudioSession startup rollback (F195 Phase D — P1 from review)."""

import asyncio
import importlib.util
import os
import sys
import unittest

_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _dir)
_spec = importlib.util.spec_from_file_location("audio_service", os.path.join(_dir, "audio-service.py"))
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
AudioSession = _mod.AudioSession


class TestAudioSessionStartupRollback(unittest.TestCase):
    def test_invalid_thread_id_does_not_leave_running_true(self):
        """If TranscriptArtifactStore throws during start(), running must stay False."""
        session = AudioSession()
        loop = asyncio.new_event_loop()
        try:
            with self.assertRaises(Exception):
                loop.run_until_complete(session.start(
                    source="mic",
                    thread_id="../escape",
                    meeting_id="m1",
                ))
            self.assertFalse(session.running,
                "session.running must be False after start() fails due to invalid thread_id")
        finally:
            loop.close()

    def test_can_retry_start_after_store_failure(self):
        """After a failed start (store throws), a second start must not raise 'Already running'."""
        session = AudioSession()
        loop = asyncio.new_event_loop()
        try:
            with self.assertRaises(Exception):
                loop.run_until_complete(session.start(
                    source="mic",
                    thread_id="../escape",
                    meeting_id="m1",
                ))
            try:
                loop.run_until_complete(session.start(
                    source="mic",
                    thread_id="valid-thread",
                    meeting_id="m2",
                ))
            except RuntimeError as e:
                if "Already running" in str(e):
                    self.fail("Second start() raised 'Already running' — startup rollback broken")
            except Exception:
                pass
        finally:
            if session.running:
                loop.run_until_complete(session.stop())
            loop.close()


if __name__ == "__main__":
    unittest.main()
