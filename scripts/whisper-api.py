#!/usr/bin/env python3
"""
Minimal Whisper ASR server for Cat Cafe voice input.
OpenAI-compatible endpoint: POST /v1/audio/transcriptions

Usage:
  source ~/.cat-cafe/whisper-venv/bin/activate
  python scripts/whisper-api.py                    # default: small model
  python scripts/whisper-api.py --model large-v3   # production model
  python scripts/whisper-api.py --port 9876        # custom port
"""

import argparse
import logging
import signal
import sys
import tempfile
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

MAX_FILE_BYTES = 25 * 1024 * 1024  # 25 MB (matches OpenAI limit)

log = logging.getLogger("whisper-api")

app = FastAPI(title="Cat Cafe Whisper Server")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

model: WhisperModel | None = None
model_name: str = ""


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form("zh"),
    initial_prompt: str = Form(""),
):
    """OpenAI-compatible transcription endpoint."""
    if model is None:
        raise HTTPException(503, detail="Model not loaded yet")

    content = await file.read()
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, detail=f"File too large ({len(content)} bytes, max {MAX_FILE_BYTES})")
    if len(content) == 0:
        raise HTTPException(400, detail="Empty audio file")

    suffix = Path(file.filename or "audio.webm").suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(
            tmp_path,
            language=language if language else None,
            initial_prompt=initial_prompt if initial_prompt else None,
            vad_filter=True,
        )
        text = " ".join(seg.text.strip() for seg in segments)
        log.info("Transcribed %d bytes → %d chars (lang=%s)", len(content), len(text), language)
        return {"text": text}
    except Exception as exc:
        log.exception("Transcription failed for %d-byte upload", len(content))
        raise HTTPException(500, detail=f"Transcription error: {exc}") from exc
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.get("/health")
async def health():
    return {
        "status": "ok" if model is not None else "loading",
        "model": model_name or "none",
    }


def main():
    global model, model_name

    parser = argparse.ArgumentParser(description="Cat Cafe Whisper Server")
    parser.add_argument("--model", default="small", help="Whisper model name (default: small)")
    parser.add_argument("--port", type=int, default=9876, help="Server port (default: 9876)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    # Graceful shutdown on SIGTERM
    def handle_sigterm(signum, frame):
        log.info("Received SIGTERM, shutting down...")
        sys.exit(0)
    signal.signal(signal.SIGTERM, handle_sigterm)

    model_name = args.model
    log.info("=== Cat Cafe Whisper Server ===")
    log.info("Model: %s | Port: %d", args.model, args.port)
    log.info("Loading model...")

    try:
        model = WhisperModel(args.model, device="cpu", compute_type="int8")
    except Exception:
        log.exception("Failed to load model '%s'", args.model)
        sys.exit(1)

    log.info("Model loaded! API: http://localhost:%d/v1/audio/transcriptions", args.port)

    uvicorn.run(app, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
