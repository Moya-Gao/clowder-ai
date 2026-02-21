#!/usr/bin/env python3
"""
TTS server for Cat Cafe voice output (MLX-Audio backend, Apple Silicon native).
OpenAI-compatible endpoint: POST /v1/audio/speech

Usage:
  source ~/.cat-cafe/tts-venv/bin/activate
  python scripts/tts-api.py                                              # default: Kokoro-82M
  python scripts/tts-api.py --model mlx-community/Kokoro-82M-bf16       # explicit model
  python scripts/tts-api.py --port 9877                                  # custom port

Requires: pip install mlx-audio "misaki[zh]"
"""

import argparse
import asyncio
import logging
import signal
import sys
import tempfile
from pathlib import Path

import shutil

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

MAX_INPUT_CHARS = 5000  # Limit input text length

log = logging.getLogger("tts-api")

app = FastAPI(title="Cat Cafe TTS Server")

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

model_path: str = ""
model_loaded: bool = False

# Serialize GPU access — mlx doesn't handle concurrent synthesis well
_synthesize_lock = asyncio.Lock()


class SpeechRequest(BaseModel):
    input: str = Field(..., min_length=1, max_length=MAX_INPUT_CHARS)
    voice: str = Field(default="zm_yunjian")
    model: str = Field(default="mlx-community/Kokoro-82M-bf16")
    response_format: str = Field(default="wav")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    lang_code: str = Field(default="z")


@app.post("/v1/audio/speech")
async def synthesize(req: SpeechRequest):
    """OpenAI-compatible TTS endpoint."""
    if not model_loaded:
        raise HTTPException(503, detail="Model not loaded yet")

    try:
        from mlx_audio.tts.generate import generate_audio as tts_generate
    except ImportError:
        raise HTTPException(500, detail="mlx_audio.tts not available")

    # Generate to temp dir, read into memory, clean up immediately
    output_dir = Path(tempfile.mkdtemp(prefix="cat-cafe-tts-"))
    try:
        async with _synthesize_lock:
            await asyncio.to_thread(
                tts_generate,
                text=req.input,
                model=model_path,
                voice=req.voice,
                lang_code=req.lang_code,
                speed=req.speed,
                audio_format=req.response_format,
                output_path=str(output_dir),
            )

        # Find the generated audio file
        audio_files = list(output_dir.glob(f"*.{req.response_format}"))
        if not audio_files:
            raise HTTPException(500, detail="No audio file generated")

        audio_path = audio_files[0]
        audio_bytes = audio_path.read_bytes()

        log.info(
            "Synthesized %d chars → %d bytes (voice=%s, lang=%s)",
            len(req.input),
            len(audio_bytes),
            req.voice,
            req.lang_code,
        )

        return Response(
            content=audio_bytes,
            media_type=f"audio/{req.response_format}",
            headers={"Content-Disposition": f'inline; filename="speech.{req.response_format}"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("Synthesis failed for %d-char input", len(req.input))
        raise HTTPException(500, detail=f"Synthesis error: {exc}") from exc
    finally:
        # Always clean up temp dir — prevents disk leak (R5-P1)
        shutil.rmtree(output_dir, ignore_errors=True)


@app.get("/health")
async def health():
    return {
        "status": "ok" if model_loaded else "loading",
        "model": model_path or "none",
        "backend": "mlx-audio",
    }


def main():
    global model_path, model_loaded

    parser = argparse.ArgumentParser(description="Cat Cafe TTS Server (MLX-Audio)")
    parser.add_argument(
        "--model",
        default="mlx-community/Kokoro-82M-bf16",
        help="HuggingFace model repo (default: mlx-community/Kokoro-82M-bf16)",
    )
    parser.add_argument("--port", type=int, default=9877, help="Server port (default: 9877)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

    def handle_sigterm(signum, frame):
        log.info("Received SIGTERM, shutting down...")
        sys.exit(0)
    signal.signal(signal.SIGTERM, handle_sigterm)

    model_path = args.model
    log.info("=== Cat Cafe TTS Server (MLX-Audio) ===")
    log.info("Model: %s | Port: %d", model_path, args.port)
    log.info("Loading model (first run downloads from HuggingFace)...")

    try:
        from mlx_audio.tts.generate import generate_audio as tts_generate

        # Warmup: run a tiny synthesis to force model download + compile
        # Use Chinese voice (no espeak dependency needed)
        warmup_dir = Path(tempfile.mkdtemp(prefix="cat-cafe-tts-warmup-"))
        try:
            tts_generate(
                text="你好",
                model=model_path,
                voice="zm_yunjian",
                lang_code="z",
                output_path=str(warmup_dir),
            )
        except Exception:
            pass  # Warmup may fail, that's ok — model is loaded
        finally:
            shutil.rmtree(warmup_dir, ignore_errors=True)
        model_loaded = True
    except Exception:
        log.exception("Failed to load model '%s'", model_path)
        sys.exit(1)

    log.info("Model loaded! API: http://localhost:%d/v1/audio/speech", args.port)
    uvicorn.run(app, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
