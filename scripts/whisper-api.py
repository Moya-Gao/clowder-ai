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
import io
import tempfile
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

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


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form("zh"),
    initial_prompt: str = Form(""),
):
    """OpenAI-compatible transcription endpoint."""
    assert model is not None

    # Write upload to temp file (faster-whisper needs a file path)
    suffix = Path(file.filename or "audio.webm").suffix
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
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
        return {"text": text}
    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.get("/health")
async def health():
    return {"status": "ok", "model": model_name if model_name else "none"}


model_name: str = ""


def main():
    global model, model_name
    parser = argparse.ArgumentParser(description="Cat Cafe Whisper Server")
    parser.add_argument("--model", default="small", help="Whisper model name (default: small)")
    parser.add_argument("--port", type=int, default=9876, help="Server port (default: 9876)")
    args = parser.parse_args()

    model_name = args.model
    print(f"=== Cat Cafe Whisper Server ===")
    print(f"Model: {args.model}")
    print(f"Port:  {args.port}")
    print(f"Loading model...")

    model = WhisperModel(args.model, device="cpu", compute_type="int8")

    print(f"Model loaded! Server ready.")
    print(f"API: http://localhost:{args.port}/v1/audio/transcriptions")
    print()

    uvicorn.run(app, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
