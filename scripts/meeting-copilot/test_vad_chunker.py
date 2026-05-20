"""Tests for VadChunker — VAD-driven speech segmentation for ASR."""
import struct
import unittest
from unittest.mock import MagicMock, patch

from vad_chunker import VadChunker, FRAME_SAMPLES


def _make_pcm(samples: int, amplitude: float = 0.5) -> bytes:
    """Generate PCM16 bytes of a simple tone."""
    import math
    data = []
    for i in range(samples):
        val = int(amplitude * 32767 * math.sin(2 * math.pi * 440 * i / 16000))
        data.append(struct.pack("<h", max(-32768, min(32767, val))))
    return b"".join(data)


def _make_silence(samples: int) -> bytes:
    """Generate silent PCM16 bytes."""
    return b"\x00\x00" * samples


class TestVadChunkerDisabled(unittest.TestCase):
    """When VAD is disabled, behave like fixed-size chunker."""

    def test_fixed_chunks_when_disabled(self):
        chunk_sec = 1.0
        chunker = VadChunker(enabled=False, chunk_sec=chunk_sec)
        chunk_samples = int(chunk_sec * 16000)
        pcm = _make_pcm(chunk_samples)

        emitted = chunker.feed(pcm)
        assert len(emitted) == 1
        assert len(emitted[0]) == chunk_samples * 2

    def test_partial_accumulation_when_disabled(self):
        chunker = VadChunker(enabled=False, chunk_sec=1.0)
        half = _make_pcm(8000)

        emitted = chunker.feed(half)
        assert len(emitted) == 0

        emitted = chunker.feed(half)
        assert len(emitted) == 1

    def test_flush_returns_remainder_when_disabled(self):
        chunker = VadChunker(enabled=False, chunk_sec=1.0)
        quarter = _make_pcm(4000)
        chunker.feed(quarter)

        flushed = chunker.flush()
        assert len(flushed) == 4000 * 2


class TestVadChunkerEnabled(unittest.TestCase):
    """When VAD is enabled, use speech detection to segment."""

    def _make_chunker(self, **kwargs):
        """Create a chunker with a mock VAD model (skip real Silero load)."""
        with patch.object(VadChunker, '_load_vad'):
            chunker = VadChunker(enabled=True, **kwargs)
        chunker._vad_model = MagicMock()
        chunker._torch = MagicMock()
        return chunker

    def test_silence_produces_no_chunks(self):
        chunker = self._make_chunker()
        chunker._vad_model.return_value = MagicMock(item=MagicMock(return_value=0.01))

        silence = _make_silence(FRAME_SAMPLES * 10)
        emitted = chunker.feed(silence)
        assert len(emitted) == 0

    def test_speech_then_silence_emits_chunk(self):
        chunker = self._make_chunker(silence_padding_ms=100)
        speech_frames = 20
        silence_frames = 10
        padding_frames = int(100 / (FRAME_SAMPLES / 16000 * 1000)) + 2

        call_count = [0]
        def mock_vad(*args, **kwargs):
            call_count[0] += 1
            prob = 0.95 if call_count[0] <= speech_frames else 0.01
            m = MagicMock()
            m.item.return_value = prob
            return m

        chunker._vad_model.side_effect = mock_vad

        audio = _make_pcm(FRAME_SAMPLES * speech_frames) + _make_silence(FRAME_SAMPLES * (silence_frames + padding_frames))
        emitted = chunker.feed(audio)
        assert len(emitted) >= 1
        assert len(emitted[0]) > 0

    def test_max_duration_forces_flush(self):
        chunker = self._make_chunker(max_speech_sec=0.5)
        chunker._vad_model.return_value = MagicMock(item=MagicMock(return_value=0.95))

        long_speech = _make_pcm(16000)  # 1 second — exceeds 0.5s max
        emitted = chunker.feed(long_speech)
        assert len(emitted) >= 1

    def test_flush_emits_buffered_speech(self):
        chunker = self._make_chunker()
        chunker._vad_model.return_value = MagicMock(item=MagicMock(return_value=0.95))

        speech = _make_pcm(FRAME_SAMPLES * 5)
        chunker.feed(speech)

        flushed = chunker.flush()
        assert len(flushed) > 0


class TestVadChunkerEdgeCases(unittest.TestCase):

    def test_empty_feed(self):
        chunker = VadChunker(enabled=False, chunk_sec=1.0)
        emitted = chunker.feed(b"")
        assert len(emitted) == 0

    def test_speech_silence_speech_resets_silence_counter(self):
        """Speech after brief silence mid-utterance must reset silence count.

        Bug: silence_count only reset on first speech frame (in_speech=False),
        so a brief silence gap mid-utterance accumulated toward the padding
        threshold even after speech resumed.
        """
        with patch.object(VadChunker, '_load_vad'):
            chunker = VadChunker(enabled=True, silence_padding_ms=300)
        chunker._vad_model = MagicMock()
        chunker._torch = MagicMock()

        silence_padding_frames = chunker._silence_padding_frames
        gap_frames = silence_padding_frames - 2

        call_count = [0]
        def mock_vad(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] <= 10:
                return MagicMock(item=MagicMock(return_value=0.95))
            elif call_count[0] <= 10 + gap_frames:
                return MagicMock(item=MagicMock(return_value=0.01))
            elif call_count[0] <= 10 + gap_frames + 10:
                return MagicMock(item=MagicMock(return_value=0.95))
            elif call_count[0] <= 10 + gap_frames + 10 + gap_frames:
                return MagicMock(item=MagicMock(return_value=0.01))
            else:
                return MagicMock(item=MagicMock(return_value=0.95))

        chunker._vad_model.side_effect = mock_vad

        total_frames = 10 + gap_frames + 10 + gap_frames + 5
        audio = _make_pcm(FRAME_SAMPLES * total_frames)
        emitted = chunker.feed(audio)
        assert len(emitted) == 0, (
            f"Expected 0 chunks (two sub-threshold gaps should not trigger end-of-speech), "
            f"got {len(emitted)}"
        )

    def test_very_short_speech_ignored(self):
        """Speech shorter than min_speech_ms should be discarded."""
        with patch.object(VadChunker, '_load_vad'):
            chunker = VadChunker(enabled=True, min_speech_ms=200)
        chunker._vad_model = MagicMock()
        chunker._torch = MagicMock()

        call_count = [0]
        def mock_vad(*args, **kwargs):
            call_count[0] += 1
            prob = 0.95 if call_count[0] <= 2 else 0.01
            m = MagicMock()
            m.item.return_value = prob
            return m

        chunker._vad_model.side_effect = mock_vad

        short_speech = _make_pcm(FRAME_SAMPLES * 2) + _make_silence(FRAME_SAMPLES * 15)
        emitted = chunker.feed(short_speech)
        assert len(emitted) == 0
