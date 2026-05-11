"""Rolling transcript window with heuristic summarization.

Keeps raw transcript lines within a configurable time window.
Older lines are compressed into summary records (first/last lines + stats).
"""

import time


class TranscriptWindow:
    def __init__(self, window_sec: float = 300, summary_interval_sec: float = 300):
        self._window_sec = window_sec
        self._summary_interval_sec = summary_interval_sec
        self._all_lines: list[dict] = []
        self._summaries: list[dict] = []
        self._last_summary_ts: float = 0

    def add_line(self, line: dict) -> None:
        self._all_lines.append(line)

    def get_raw_lines(self, now: float | None = None) -> list[dict]:
        t = now or time.time()
        cutoff = t - self._window_sec
        return [l for l in self._all_lines if l["ts"] >= cutoff]

    def get_all_lines(self) -> list[dict]:
        return list(self._all_lines)

    def get_summaries(self) -> list[dict]:
        return list(self._summaries)

    def get_full(self, now: float | None = None) -> dict:
        self.maybe_summarize(now=now, force=True)
        return {
            "summaries": self.get_summaries(),
            "raw_lines": self.get_raw_lines(now=now),
        }

    def maybe_summarize(self, now: float | None = None, force: bool = False) -> None:
        t = now or time.time()
        cutoff = t - self._window_sec
        old = [l for l in self._all_lines if l["ts"] < cutoff]
        if not old:
            return
        if not force and t - self._last_summary_ts < self._summary_interval_sec and self._last_summary_ts > 0:
            return

        summary = self._build_summary(old)
        self._summaries.append(summary)
        self._all_lines = [l for l in self._all_lines if l["ts"] >= cutoff]
        self._last_summary_ts = t

    @staticmethod
    def _build_summary(lines: list[dict]) -> dict:
        if not lines:
            return {"time_range": [0, 0], "line_count": 0, "key_lines": []}

        first_ts = lines[0]["ts"]
        last_ts = lines[-1]["ts"]
        head = lines[:3]
        tail = lines[-3:] if len(lines) > 3 else []
        seen = {id(l) for l in head}
        tail = [l for l in tail if id(l) not in seen]
        key_lines = [l["text"] for l in head + tail]

        return {
            "time_range": [first_ts, last_ts],
            "line_count": len(lines),
            "duration_s": round(last_ts - first_ts, 1),
            "key_lines": key_lines,
        }
