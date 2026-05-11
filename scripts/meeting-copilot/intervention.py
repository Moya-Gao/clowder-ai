"""Intervention advisory loop: detection, silence monitoring, rate limiting."""

from __future__ import annotations

import re
import time


class AdvisoryRateLimiter:
    """Runtime rate gate — enforces frequency caps in code, not skill ref."""

    def __init__(self, min_interval_s: float = 300, dnd_duration_s: float = 900):
        self.min_interval_s = min_interval_s
        self.dnd_duration_s = dnd_duration_s
        self._last_emission: float = 0
        self._dnd_until: float = 0

    def can_emit(self, now: float | None = None) -> bool:
        now = now if now is not None else time.time()
        if now < self._dnd_until:
            return False
        if self._last_emission > 0 and (now - self._last_emission) < self.min_interval_s:
            return False
        return True

    def record_emission(self, now: float | None = None) -> None:
        self._last_emission = now if now is not None else time.time()

    def set_dnd(self, now: float | None = None) -> None:
        now = now if now is not None else time.time()
        self._dnd_until = now + self.dnd_duration_s

    def status(self) -> dict:
        now = time.time()
        return {
            "can_emit": self.can_emit(now),
            "dnd_until": self._dnd_until if self._dnd_until > now else None,
            "last_emission": self._last_emission if self._last_emission > 0 else None,
        }


class SilenceMonitor:
    """Tracks continuous silence from audio chunks — fires DURING silence."""

    def __init__(self, threshold_s: float = 5.0):
        self.threshold_s = threshold_s
        self._last_speech_ts: float = 0
        self._last_speech_chunk_num: int = 0
        self._last_speech_text: str = ""
        self._silence_emitted: bool = False

    def on_speech(self, ts: float, chunk_num: int, text: str) -> None:
        self._last_speech_ts = ts
        self._last_speech_chunk_num = chunk_num
        self._last_speech_text = text
        self._silence_emitted = False

    def on_chunk(self, ts: float, has_speech: bool) -> dict | None:
        if has_speech:
            return None
        if self._last_speech_ts == 0:
            return None
        if self._silence_emitted:
            return None
        gap = ts - self._last_speech_ts
        if gap >= self.threshold_s:
            self._silence_emitted = True
            return {
                "type": "intervention_advisory",
                "ts": ts,
                "reason": "extended_silence",
                "confidence": min(0.5 + (gap - self.threshold_s) * 0.05, 0.9),
                "source_chunk_num": self._last_speech_chunk_num,
                "source_text": self._last_speech_text,
                "talking_point": None,
            }
        return None


_QUESTION_EN = re.compile(
    r"\?\s*$"
    r"|(?:^|\s)(?:what|how|why|who|where|when|which|could you|can you|do you|would you)"
    r".*\?\s*$",
    re.IGNORECASE,
)

_QUESTION_ZH = re.compile(
    r"[？?]\s*$"
    r"|(?:你觉得|你怎么看|你认为|怎么样|什么|为什么|怎么|谁|哪|吗\s*$|呢\s*$)"
)

_CJK_RE = re.compile(r"[一-鿿]+")


def _cjk_bigrams(text: str) -> set[str]:
    bigrams: set[str] = set()
    for run in _CJK_RE.findall(text):
        for i in range(len(run) - 1):
            bigrams.add(run[i : i + 2])
    return bigrams


class InterventionDetector:
    """Rule-based intervention window detection (transcript-triggered)."""

    def check(self, line: dict, talking_points: list[str]) -> dict | None:
        text = line.get("text", "")
        chunk_num = line.get("chunk_num", 0)
        ts = line.get("ts", 0)

        hit, conf = self._check_question(text)
        if hit:
            return self._event("question_detected", conf, chunk_num, ts, text, None)

        hit, conf, tp = self._check_keyword(text, talking_points)
        if hit:
            return self._event("keyword_match", conf, chunk_num, ts, text, tp)

        return None

    def _check_question(self, text: str) -> tuple[bool, float]:
        if _QUESTION_EN.search(text):
            return True, 0.8
        if _QUESTION_ZH.search(text):
            return True, 0.8
        return False, 0.0

    def _check_keyword(
        self, text: str, talking_points: list[str]
    ) -> tuple[bool, float, str | None]:
        if not talking_points:
            return False, 0.0, None
        text_tokens = set(re.findall(r"\w+", text.lower()))
        text_bigrams = _cjk_bigrams(text)
        for tp in talking_points:
            tp_tokens = set(re.findall(r"\w+", tp.lower()))
            word_overlap = text_tokens & tp_tokens
            cjk_overlap = text_bigrams & _cjk_bigrams(tp)
            total = len(word_overlap) + len(cjk_overlap)
            if total >= 2:
                conf = min(0.6 + total * 0.1, 0.95)
                return True, conf, tp
        return False, 0.0, None

    @staticmethod
    def _event(reason: str, confidence: float, chunk_num: int,
               ts: float, text: str, talking_point: str | None) -> dict:
        return {
            "type": "intervention_advisory",
            "ts": ts,
            "reason": reason,
            "confidence": confidence,
            "source_chunk_num": chunk_num,
            "source_text": text,
            "talking_point": talking_point,
        }
