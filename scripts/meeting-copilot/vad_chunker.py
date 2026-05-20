"""VAD-driven speech segmentation for ASR pipeline.

Replaces fixed 3-second chunking with Silero VAD to detect speech segments
dynamically. Eliminates broken word boundaries and silence hallucinations.
"""

import os
import struct
from typing import List, Optional

SAMPLE_RATE = 16000
FRAME_SAMPLES = 512  # 32ms at 16kHz — Silero VAD optimal frame size
FRAME_BYTES = FRAME_SAMPLES * 2  # 16-bit PCM

DEFAULT_SPEECH_THRESHOLD = 0.5
DEFAULT_SILENCE_PADDING_MS = 300
DEFAULT_MIN_SPEECH_MS = 150
DEFAULT_MAX_SPEECH_SEC = 15.0


class VadChunker:
    """Segments audio into speech chunks using Silero VAD.

    When disabled, falls back to fixed-size chunking (backward compatible).
    """

    def __init__(
        self,
        enabled: bool = True,
        chunk_sec: float = 3.0,
        speech_threshold: float = DEFAULT_SPEECH_THRESHOLD,
        silence_padding_ms: int = DEFAULT_SILENCE_PADDING_MS,
        min_speech_ms: int = DEFAULT_MIN_SPEECH_MS,
        max_speech_sec: float = DEFAULT_MAX_SPEECH_SEC,
    ):
        self.enabled = enabled
        self._chunk_sec = chunk_sec
        self._speech_threshold = speech_threshold
        self._silence_padding_frames = int(silence_padding_ms / (FRAME_SAMPLES / SAMPLE_RATE * 1000))
        self._min_speech_frames = int(min_speech_ms / (FRAME_SAMPLES / SAMPLE_RATE * 1000))
        self._max_speech_samples = int(max_speech_sec * SAMPLE_RATE)

        self._buf = bytearray()
        self._speech_buf = bytearray()
        self._in_speech = False
        self._silence_count = 0
        self._speech_frame_count = 0

        self._vad_model = None
        self._torch = None
        if enabled:
            self._load_vad()

    def _load_vad(self):
        try:
            import torch
            self._torch = torch
            model, _ = torch.hub.load(
                repo_or_dir="snakers4/silero-vad",
                model="silero_vad",
                trust_repo=True,
            )
            self._vad_model = model
        except Exception as e:
            import sys
            print(f"  ⚠ VAD load failed ({e}), falling back to fixed chunks", file=sys.stderr)
            self.enabled = False

    def feed(self, pcm: bytes) -> List[bytes]:
        """Feed PCM16 audio data, returns list of complete speech segments."""
        if not pcm:
            return []
        if not self.enabled:
            return self._feed_fixed(pcm)
        return self._feed_vad(pcm)

    def flush(self) -> bytes:
        """Flush any remaining buffered audio."""
        if not self.enabled:
            result = bytes(self._buf)
            self._buf.clear()
            return result

        if self._speech_buf and self._speech_frame_count >= self._min_speech_frames:
            result = bytes(self._speech_buf)
        elif self._speech_buf:
            result = b""
        else:
            result = b""
        self._speech_buf.clear()
        self._in_speech = False
        self._silence_count = 0
        self._speech_frame_count = 0
        if self._vad_model is not None:
            try:
                self._vad_model.reset_states()
            except Exception:
                pass
        return result

    def _feed_fixed(self, pcm: bytes) -> List[bytes]:
        """Fixed-size chunking (fallback when VAD disabled)."""
        self._buf.extend(pcm)
        chunk_bytes = int(self._chunk_sec * SAMPLE_RATE * 2)
        chunks = []
        while len(self._buf) >= chunk_bytes:
            chunks.append(bytes(self._buf[:chunk_bytes]))
            del self._buf[:chunk_bytes]
        return chunks

    def _feed_vad(self, pcm: bytes) -> List[bytes]:
        """VAD-driven chunking."""
        self._buf.extend(pcm)
        chunks = []

        while len(self._buf) >= FRAME_BYTES:
            frame = bytes(self._buf[:FRAME_BYTES])
            del self._buf[:FRAME_BYTES]

            samples = [struct.unpack("<h", frame[i:i+2])[0] / 32768.0
                       for i in range(0, len(frame), 2)]
            tensor = self._torch.FloatTensor(samples)
            prob = self._vad_model(tensor, SAMPLE_RATE).item()

            is_speech = prob >= self._speech_threshold

            if is_speech:
                if not self._in_speech:
                    self._in_speech = True
                    self._speech_frame_count = 0
                self._silence_count = 0
                self._speech_buf.extend(frame)
                self._speech_frame_count += 1

                if len(self._speech_buf) >= self._max_speech_samples * 2:
                    chunks.append(bytes(self._speech_buf))
                    self._speech_buf.clear()
                    self._speech_frame_count = 0
            else:
                if self._in_speech:
                    self._speech_buf.extend(frame)
                    self._silence_count += 1

                    if self._silence_count >= self._silence_padding_frames:
                        if self._speech_frame_count >= self._min_speech_frames:
                            chunks.append(bytes(self._speech_buf))
                        self._speech_buf.clear()
                        self._in_speech = False
                        self._silence_count = 0
                        self._speech_frame_count = 0

        return chunks
