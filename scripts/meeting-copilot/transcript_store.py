"""Transcript artifact persistence (F195 Phase D).

Writes meeting transcripts to a growing MD file, grouped by speaking turn.
Interleaves 30-second rolling summaries. Writes meta.json sidecar for
Node-side path injection detection.
"""

import json
import os
import subprocess
import tempfile
import time
from pathlib import Path


class TranscriptArtifactStore:
    def __init__(self, transcript_dir: str, thread_id: str, meeting_id: str,
                 app_name: str | None = None, participants: list[dict] | None = None):
        if '..' in thread_id or '/' in thread_id or '\\' in thread_id or '\0' in thread_id:
            raise ValueError(f"Invalid thread_id: contains unsafe characters: {thread_id!r}")
        target = (Path(transcript_dir) / thread_id).resolve()
        root = Path(transcript_dir).resolve()
        if not target.is_relative_to(root):
            raise ValueError(f"Invalid thread_id: resolves outside transcript directory: {thread_id!r}")
        self._dir = target
        self._dir.mkdir(parents=True, exist_ok=True)
        safe_mid = "".join(c for c in meeting_id if c.isalnum() or c in "-_")[:80] or "unknown"
        candidate = self._dir / f"transcript-{safe_mid}.md"
        seq = 0
        while candidate.exists():
            seq += 1
            candidate = self._dir / f"transcript-{safe_mid}-{seq}.md"
        self._md_path = candidate
        self._meta_path = self._dir / "meta.json"
        self._thread_id = thread_id
        self._meeting_id = meeting_id
        self._started_at = time.time()
        self._participants = participants or []
        self._last_speaker: str | None = None
        self._last_summary_ts: float = self._started_at
        self._summary_buf: list[dict] = []
        self._pcm_path: Path | None = None
        self._has_pcm = False

        label = app_name or "Meeting"
        ts_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self._started_at))
        with open(self._md_path, "w") as f:
            f.write(f"# Meeting Transcript — {ts_str} {label}\n\n")
            f.write(f"Meeting ID: {meeting_id} | Thread: {thread_id} | Started: {ts_str}\n\n")

        self._write_meta(active=True, latest_range=None)

    def _write_meta(self, active: bool, latest_range: str | None,
                    recording_path: str | None = None) -> None:
        meta = {
            "active": active,
            "meeting_id": self._meeting_id,
            "thread_id": self._thread_id,
            "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(self._started_at)),
            "transcript_path": str(self._md_path),
            "latest_range": latest_range,
            "participants": self._participants,
        }
        if recording_path:
            meta["recording_path"] = recording_path
        fd, tmp = tempfile.mkstemp(dir=self._dir, suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(meta, f, ensure_ascii=False, indent=2)
            os.replace(tmp, self._meta_path)
        except BaseException:
            os.unlink(tmp)
            raise

    def append_pcm(self, data: bytes) -> None:
        if self._pcm_path is None:
            safe_mid = self._md_path.stem.replace("transcript-", "recording-")
            self._pcm_path = self._dir / f"{safe_mid}.pcm"
        with open(self._pcm_path, "ab") as f:
            f.write(data)
        self._has_pcm = True

    def _convert_recording(self) -> str | None:
        if not self._has_pcm or self._pcm_path is None or not self._pcm_path.exists():
            return None
        mp3_path = self._pcm_path.with_suffix(".mp3")
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-f", "s16le", "-ar", "16000", "-ac", "1",
                 "-i", str(self._pcm_path), str(mp3_path)],
                capture_output=True, timeout=60, check=True,
            )
            self._pcm_path.unlink(missing_ok=True)
            return str(mp3_path)
        except (subprocess.SubprocessError, OSError):
            mp3_path.unlink(missing_ok=True)
            return str(self._pcm_path)

    def append_line(self, line: dict) -> None:
        speaker = line.get("speaker_label", "Unknown")
        confidence = line.get("speaker_confidence", 0)
        elapsed = line.get("elapsed_s", 0)
        text = line.get("text", "")

        self._summary_buf.append(line)

        with open(self._md_path, "a") as f:
            if speaker != self._last_speaker:
                conf_str = f" [{confidence:.2f}]" if confidence > 0 else ""
                f.write(f"\n### {self._format_elapsed(elapsed)} — {speaker}{conf_str}\n")
                self._last_speaker = speaker
            f.write(f"{text} ")

        range_start = max(0, elapsed - 30)
        self._write_meta(
            active=True,
            latest_range=f"{self._format_elapsed(range_start)}–{self._format_elapsed(elapsed)}",
        )

    def finalize(self, now: float | None = None) -> dict:
        t = now or time.time()
        self.maybe_flush_summary(now=t)
        elapsed = t - self._started_at
        with open(self._md_path, "a") as f:
            f.write(f"\n\n---\n*Session ended at {self._format_elapsed(elapsed)}*\n")
        recording_path = self._convert_recording()
        self._write_meta(active=False, latest_range=None, recording_path=recording_path)
        return {"transcript_path": str(self._md_path), "recording_path": recording_path}

    def maybe_flush_summary(self, now: float | None = None) -> None:
        t = now or time.time()
        if t - self._last_summary_ts < 30:
            return
        if not self._summary_buf:
            return
        lines = self._summary_buf
        self._summary_buf = []
        self._last_summary_ts = t

        start_e = lines[0].get("elapsed_s", 0)
        end_e = lines[-1].get("elapsed_s", 0)
        key_texts = [l["text"] for l in lines[:3]]
        if len(lines) > 3:
            key_texts.extend(l["text"] for l in lines[-2:])
        summary_text = "；".join(t for t in key_texts if t.strip())
        if len(summary_text) > 120:
            summary_text = summary_text[:117] + "..."

        with open(self._md_path, "a") as f:
            f.write(f"\n\n---\n#### ⏱ Rolling Summary · {self._format_elapsed(start_e)}–{self._format_elapsed(end_e)}\n")
            f.write(f"{summary_text}\n---\n")
        self._last_speaker = None

    @staticmethod
    def _format_elapsed(secs: float) -> str:
        h, rem = divmod(int(secs), 3600)
        m, s = divmod(rem, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"
