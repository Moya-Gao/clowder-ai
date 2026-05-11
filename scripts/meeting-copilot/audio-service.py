#!/usr/bin/env python3
"""F195 Phase B — Audio Capture & Transcription Service.

HTTP server managing real-time audio capture + ASR transcription.

Modes:
  app:  ScreenCaptureKit via CaptureAppAudio (per-app audio)
  mic:  System microphone via sounddevice

Endpoints:
  POST /start       {source: "app"|"mic", app_name?, device?, chunk_sec?}
  POST /stop
  GET  /status
  GET  /transcript   ?from=&to=&latest=
  GET  /events       SSE stream
  GET  /sources      Available apps + mic devices
"""

import asyncio
import io
import json
import os
import struct
import subprocess
import sys
import threading
import time
from pathlib import Path

from aiohttp import web, ClientSession, ClientTimeout, FormData
from transcript_window import TranscriptWindow

ASR_URL = os.getenv("ASR_URL", "http://localhost:9876")
PORT = int(os.getenv("AUDIO_SERVICE_PORT", "9877"))
SAMPLE_RATE = 16000
DEFAULT_CHUNK_SEC = 3.0
CAPTURE_BIN = os.getenv("CAPTURE_APP_AUDIO_BIN") or str(
    Path(__file__).resolve().parent
    / "CaptureAppAudio.app"
    / "Contents"
    / "MacOS"
    / "CaptureAppAudio"
)


def pcm_to_wav(pcm: bytes, sr: int = SAMPLE_RATE) -> bytes:
    buf = io.BytesIO()
    n = len(pcm)
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + n))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, 1, sr, sr * 2, 2, 16))
    buf.write(b"data")
    buf.write(struct.pack("<I", n))
    buf.write(pcm)
    return buf.getvalue()


class AudioSession:
    def __init__(self):
        self._sse_queues: list[asyncio.Queue] = []
        self._http: ClientSession | None = None
        self._process = None
        self._task = None
        self.running = False
        self.source = None
        self.app_name = None
        self.device = None
        self.started_at = None
        self.chunk_count = 0
        self.total_asr_time = 0.0
        self.meeting_id = None
        self.thread_id = None
        self.participants: list[dict] = []
        self._window = TranscriptWindow(window_sec=300, summary_interval_sec=300)

    def _reset(self):
        self.running = False
        self.source = None
        self.app_name = None
        self.device = None
        self.started_at = None
        self.chunk_count = 0
        self.total_asr_time = 0.0
        self.meeting_id = None
        self.thread_id = None
        self._window = TranscriptWindow(window_sec=300, summary_interval_sec=300)
        self._process = None
        self._task = None

    def enroll(self, participants: list[dict]) -> None:
        if not isinstance(participants, list):
            raise TypeError("participants must be a list")
        if not participants:
            raise ValueError("participants list must not be empty")
        for p in participants:
            if not isinstance(p, dict):
                raise TypeError("Each participant must be a dict")
            if not p.get("id"):
                raise ValueError("Each participant must have an 'id'")
            if not p.get("name"):
                raise ValueError("Each participant must have a 'name'")
        self.participants = [
            {"id": p["id"], "name": p["name"], "role": p.get("role", "participant")}
            for p in participants
        ]

    def _attribute_speaker(self) -> dict:
        host = next((p for p in self.participants if p.get("role") == "host"), None)
        non_hosts = [p for p in self.participants if p.get("role") != "host"]
        if self.source == "mic":
            if host:
                return {"speaker_label": host["name"], "speaker_confidence": 0.9, "speaker_id": host["id"]}
            return {"speaker_label": "发言者", "speaker_confidence": 0.5, "speaker_id": None}
        if len(self.participants) == 2 and len(non_hosts) == 1:
            other = non_hosts[0]
            return {"speaker_label": other["name"], "speaker_confidence": 0.7, "speaker_id": other["id"]}
        return {"speaker_label": "有人说", "speaker_confidence": 0.4, "speaker_id": None}

    def correct_line(self, chunk_num: int, speaker_label: str, speaker_id: str | None = None) -> bool:
        if not isinstance(chunk_num, int):
            raise TypeError(f"chunk_num must be int, got {type(chunk_num).__name__}")
        for line in self._window.get_all_lines():
            if line.get("chunk_num") == chunk_num:
                line["speaker_label"] = speaker_label
                line["speaker_confidence"] = 1.0
                line["speaker_id"] = speaker_id
                return True
        return False

    async def start(self, source: str, app_name=None, device=None,
                    chunk_sec: float = DEFAULT_CHUNK_SEC,
                    meeting_id=None, thread_id=None):
        if self.running:
            raise RuntimeError("Already running — stop first")
        if source == "app" and not app_name:
            raise ValueError("app_name required for source=app")
        if source not in ("app", "mic"):
            raise ValueError(f"Unknown source: {source}")
        if chunk_sec < 0.5:
            raise ValueError(f"chunk_sec must be >= 0.5, got {chunk_sec}")
        if source == "app" and not Path(CAPTURE_BIN).exists():
            raise FileNotFoundError(
                f"CaptureAppAudio not found: {CAPTURE_BIN} — run build-capture.sh first"
            )
        self._reset()
        self.running = True
        self.source = source
        self.app_name = app_name
        self.device = device
        self.meeting_id = meeting_id
        self.thread_id = thread_id
        self.started_at = time.time()
        if not self._http:
            self._http = ClientSession()
        if source == "app":
            self._task = asyncio.create_task(self._run_app(app_name, chunk_sec))
        else:
            self._task = asyncio.create_task(self._run_mic(device, chunk_sec))
        await asyncio.sleep(0.15)
        if self._task.done():
            self.running = False
            exc = self._task.exception()
            if exc:
                raise RuntimeError(f"Capture failed to start: {exc}") from exc
            raise RuntimeError("Capture task exited immediately")
        await self._broadcast({"type": "status", "status": "started",
                               "source": source, "app_name": app_name,
                               "meeting_id": meeting_id, "thread_id": thread_id})
        label = f"{source}" + (f" ({app_name})" if app_name else "")
        meeting = f" [meeting={meeting_id}]" if meeting_id else ""
        print(f"  ▶ Started: {label}{meeting}")

    async def stop(self) -> dict:
        if not self.running:
            return {"error": "Not running"}
        self.running = False
        if self._process:
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=3)
            except asyncio.TimeoutError:
                self._process.kill()
            self._process = None
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None
        dur = time.time() - self.started_at if self.started_at else 0
        summary = {
            "chunks": self.chunk_count,
            "duration_s": round(dur, 1),
            "avg_asr_latency": round(
                self.total_asr_time / max(self.chunk_count, 1), 3
            ),
        }
        await self._broadcast({"type": "status", "status": "stopped", **summary})
        print(f"  ■ Stopped: {self.chunk_count} chunks, {dur:.1f}s")
        return summary

    def status(self) -> dict:
        dur = time.time() - self.started_at if self.started_at and self.running else None
        return {
            "running": self.running,
            "source": self.source,
            "app_name": self.app_name,
            "device": self.device,
            "started_at": self.started_at,
            "duration_s": round(dur, 1) if dur else None,
            "chunk_count": self.chunk_count,
            "avg_asr_latency": round(
                self.total_asr_time / max(self.chunk_count, 1), 3
            ) if self.chunk_count else None,
            "meeting_id": self.meeting_id,
            "thread_id": self.thread_id,
            "participants": self.participants,
        }

    def get_transcript(self, from_ts=None, to_ts=None, latest=None,
                       mode="raw") -> dict | list[dict]:
        if mode in ("summary", "full"):
            self._window.maybe_summarize(force=True)
        if mode == "summary":
            return {"summaries": self._window.get_summaries()}
        if mode == "full":
            return self._window.get_full()
        lines = self._window.get_all_lines()
        if from_ts is not None:
            lines = [l for l in lines if l["ts"] >= from_ts]
        if to_ts is not None:
            lines = [l for l in lines if l["ts"] <= to_ts]
        if latest is not None:
            lines = lines[-latest:]
        return lines

    async def _run_app(self, app_name: str, chunk_sec: float):
        chunk_bytes = int(chunk_sec * SAMPLE_RATE * 2)
        if not Path(CAPTURE_BIN).exists():
            print(f"  ✗ CaptureAppAudio not found: {CAPTURE_BIN}", file=sys.stderr)
            self.running = False
            await self._broadcast({"type": "status", "status": "error",
                                   "error": "CaptureAppAudio binary not found"})
            return
        self._process = await asyncio.create_subprocess_exec(
            CAPTURE_BIN, "stream", app_name, "86400", str(chunk_sec),
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
        )
        try:
            while self.running:
                pcm = await self._process.stdout.readexactly(chunk_bytes)
                await self._process_chunk(pcm)
        except asyncio.CancelledError:
            pass
        except asyncio.IncompleteReadError:
            pass
        finally:
            if self.running:
                self.running = False
                await self._broadcast({"type": "status", "status": "stopped",
                                       "reason": "capture process ended"})

    async def _run_mic(self, device_idx, chunk_sec: float):
        import numpy as np
        import sounddevice as sd

        chunk_samples = int(chunk_sec * SAMPLE_RATE)
        buf_data = np.zeros(chunk_samples, dtype=np.float32)
        buf_pos = [0]
        loop = asyncio.get_event_loop()
        q: asyncio.Queue = asyncio.Queue()
        lock = threading.Lock()

        def cb(indata, frames, time_info, status_flags):
            if not self.running:
                return
            mono = indata[:, 0] if indata.ndim > 1 else indata.flatten()
            with lock:
                rem = chunk_samples - buf_pos[0]
                n = min(len(mono), rem)
                buf_data[buf_pos[0] : buf_pos[0] + n] = mono[:n]
                buf_pos[0] += n
                if buf_pos[0] >= chunk_samples:
                    pcm = (buf_data * 32767).astype(np.int16).tobytes()
                    overflow = len(mono) - n
                    buf_data[:] = 0
                    buf_pos[0] = 0
                    if overflow > 0:
                        buf_data[:overflow] = mono[n:]
                        buf_pos[0] = overflow
                    loop.call_soon_threadsafe(q.put_nowait, pcm)

        stream = sd.InputStream(
            device=device_idx, samplerate=SAMPLE_RATE, channels=1,
            dtype="float32", blocksize=1024, callback=cb,
        )
        try:
            stream.start()
            while self.running:
                try:
                    pcm = await asyncio.wait_for(q.get(), timeout=1.0)
                    await self._process_chunk(pcm)
                except asyncio.TimeoutError:
                    continue
        except asyncio.CancelledError:
            pass
        finally:
            stream.stop()
            stream.close()
            if self.running:
                self.running = False
                await self._broadcast({"type": "status", "status": "stopped",
                                       "reason": "mic stream ended"})

    async def _process_chunk(self, pcm: bytes):
        wav = pcm_to_wav(pcm)
        self.chunk_count += 1
        ts = time.time()
        elapsed = ts - self.started_at if self.started_at else 0
        text, asr_latency = "", 0.0
        try:
            form = FormData()
            form.add_field("file", wav, filename="chunk.wav", content_type="audio/wav")
            form.add_field("language", "zh")
            t0 = time.perf_counter()
            async with self._http.post(
                f"{ASR_URL}/v1/audio/transcriptions",
                data=form,
                timeout=ClientTimeout(total=30),
            ) as resp:
                result = await resp.json()
                text = result.get("text", "")
            asr_latency = time.perf_counter() - t0
        except Exception as e:
            text = f"[ASR error: {e}]"
        self.total_asr_time += asr_latency
        speaker = self._attribute_speaker()
        line = {
            "ts": ts,
            "elapsed_s": round(elapsed, 1),
            "chunk_num": self.chunk_count,
            "asr_latency": round(asr_latency, 3),
            "text": text,
            "speaker_label": speaker["speaker_label"],
            "speaker_confidence": speaker["speaker_confidence"],
            "speaker_id": speaker["speaker_id"],
        }
        self._window.add_line(line)
        self._window.maybe_summarize()
        preview = text[:55] + "…" if len(text) > 55 else text
        print(f"  [{elapsed:6.1f}s] #{self.chunk_count:3d} {asr_latency:.3f}s  {preview}")
        await self._broadcast({"type": "transcript", **line})

    async def _broadcast(self, event: dict):
        data = json.dumps(event, ensure_ascii=False)
        dead = []
        for i, q in enumerate(self._sse_queues):
            try:
                q.put_nowait(data)
            except asyncio.QueueFull:
                dead.append(i)
        for i in reversed(dead):
            self._sse_queues.pop(i)

    def add_listener(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=100)
        self._sse_queues.append(q)
        return q

    def remove_listener(self, q: asyncio.Queue):
        try:
            self._sse_queues.remove(q)
        except ValueError:
            pass

    async def cleanup(self):
        if self.running:
            await self.stop()
        if self._http:
            await self._http.close()


session = AudioSession()


@web.middleware
async def cors_mw(request, handler):
    if request.method == "OPTIONS":
        return web.Response(headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        })
    resp = await handler(request)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp


async def h_start(request):
    try:
        data = await request.json()
    except Exception:
        data = {}
    try:
        await session.start(
            data.get("source", "app"),
            app_name=data.get("app_name"),
            device=data.get("device"),
            chunk_sec=data.get("chunk_sec", DEFAULT_CHUNK_SEC),
            meeting_id=data.get("meeting_id"),
            thread_id=data.get("thread_id"),
        )
        return web.json_response({"ok": True, "status": session.status()})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=400)


async def h_stop(request):
    summary = await session.stop()
    return web.json_response({"ok": True, "summary": summary})


async def h_status(request):
    return web.json_response(session.status())


async def h_transcript(request):
    try:
        from_ts = float(request.query["from"]) if "from" in request.query else None
        to_ts = float(request.query["to"]) if "to" in request.query else None
        latest = int(request.query["latest"]) if "latest" in request.query else None
        mode = request.query.get("mode", "raw")
    except (ValueError, TypeError) as e:
        return web.json_response({"error": f"Invalid query param: {e}"}, status=400)
    if mode not in ("raw", "summary", "full"):
        return web.json_response({"error": f"Invalid mode: {mode}"}, status=400)
    result = session.get_transcript(from_ts=from_ts, to_ts=to_ts, latest=latest, mode=mode)
    if mode in ("summary", "full"):
        return web.json_response(
            result,
            dumps=lambda x: json.dumps(x, ensure_ascii=False),
        )
    return web.json_response(
        {"lines": result},
        dumps=lambda x: json.dumps(x, ensure_ascii=False),
    )


async def h_events(request):
    resp = web.StreamResponse(headers={
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })
    await resp.prepare(request)
    q = session.add_listener()
    try:
        while True:
            try:
                data = await asyncio.wait_for(q.get(), timeout=15)
                await resp.write(f"data: {data}\n\n".encode())
            except asyncio.TimeoutError:
                await resp.write(b": keepalive\n\n")
    except (ConnectionResetError, asyncio.CancelledError):
        pass
    finally:
        session.remove_listener(q)
    return resp


async def h_sources(request):
    sources: dict = {"apps": [], "mics": []}
    try:
        r = subprocess.run(
            ["osascript", "-e",
             'tell application "System Events" to get name of every process '
             'whose background only is false'],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode == 0:
            sources["apps"] = sorted(
                a.strip() for a in r.stdout.strip().split(",") if a.strip()
            )
    except Exception:
        pass
    try:
        import sounddevice as sd
        for i, d in enumerate(sd.query_devices()):
            if d["max_input_channels"] > 0:
                sources["mics"].append({
                    "index": i, "name": d["name"],
                    "default": i == sd.default.device[0],
                })
    except Exception:
        pass
    return web.json_response(sources)


async def h_enroll(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
    participants = data.get("participants")
    if participants is None:
        return web.json_response({"error": "participants required"}, status=400)
    try:
        session.enroll(participants)
    except (ValueError, TypeError) as e:
        return web.json_response({"error": str(e)}, status=400)
    return web.json_response({"ok": True, "participants": session.participants})


async def h_correct(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON"}, status=400)
    chunk_num = data.get("chunk_num")
    speaker_label = data.get("speaker_label")
    if chunk_num is None or not speaker_label:
        return web.json_response({"error": "chunk_num and speaker_label required"}, status=400)
    try:
        chunk_num = int(chunk_num)
    except (ValueError, TypeError):
        return web.json_response({"error": "chunk_num must be an integer"}, status=400)
    ok = session.correct_line(chunk_num, speaker_label, data.get("speaker_id"))
    if not ok:
        return web.json_response({"error": f"chunk_num {chunk_num} not found"}, status=404)
    return web.json_response({"ok": True})


async def on_cleanup(app_):
    await session.cleanup()


def main():
    app = web.Application(middlewares=[cors_mw])
    app.router.add_post("/start", h_start)
    app.router.add_post("/stop", h_stop)
    app.router.add_post("/enroll", h_enroll)
    app.router.add_post("/transcript/correct", h_correct)
    app.router.add_get("/status", h_status)
    app.router.add_get("/transcript", h_transcript)
    app.router.add_get("/events", h_events)
    app.router.add_get("/sources", h_sources)
    app.on_cleanup.append(on_cleanup)
    cap = "found" if Path(CAPTURE_BIN).exists() else "NOT FOUND"
    print("=" * 60)
    print("  F195 Audio Capture Service")
    print("=" * 60)
    print(f"  Port:       :{PORT}")
    print(f"  ASR:        {ASR_URL}")
    print(f"  CaptureApp: {cap}")
    print()
    print("  POST /start   POST /stop   GET /status")
    print("  GET /transcript   GET /events   GET /sources")
    print("=" * 60)
    web.run_app(app, host="127.0.0.1", port=PORT, print=None)


if __name__ == "__main__":
    main()
