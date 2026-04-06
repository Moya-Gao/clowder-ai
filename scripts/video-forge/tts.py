#!/usr/bin/env python3
"""
F138 TTS Script — Generate global narration audio for video-spec.

Calls the existing tts-api.py server (OpenAI-compatible /v1/audio/speech)
to generate a single continuous audio file from the full narration script.

Usage:
  # From voice-script text:
  python tts.py --text "Cat Cafe 是四只猫猫..." --voice opus --output audio.wav

  # From voice-script.md (auto-extract full script):
  python tts.py --script docs/videos/showcase-60s/voice-script.md --output audio.wav

  # With custom TTS server:
  python tts.py --script voice-script.md --tts-url http://localhost:9879 --output audio.wav

Prerequisites:
  - TTS server running: source ~/.cat-cafe/tts-venv/bin/activate && python scripts/tts-api.py
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path


def extract_script_text(script_path: str) -> str:
    """Extract full narration text from voice-script.md."""
    content = Path(script_path).read_text(encoding="utf-8")
    match = re.search(
        r"## 完整剧本[^\n]*\n\n(.*?)(?=\n---|\n## )", content, re.DOTALL
    )
    if not match:
        print("Error: could not find '## 完整剧本' section", file=sys.stderr)
        sys.exit(1)
    return match.group(1).strip()


def synthesize(text: str, voice: str, tts_url: str, output_path: str, fmt: str = "wav"):
    """Call TTS server and save audio file."""
    url = f"{tts_url}/v1/audio/speech"
    body = json.dumps({
        "input": text,
        "voice": voice,
        "model": "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16",
        "response_format": fmt,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            audio_data = resp.read()
            Path(output_path).write_bytes(audio_data)
            print(f"Audio saved: {output_path} ({len(audio_data)} bytes)", file=sys.stderr)
    except urllib.error.URLError as e:
        print(f"Error calling TTS server at {url}: {e}", file=sys.stderr)
        print("Is the TTS server running? Start with:", file=sys.stderr)
        print("  source ~/.cat-cafe/tts-venv/bin/activate && python scripts/tts-api.py", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Generate narration audio via TTS server")
    parser.add_argument("--text", help="Narration text (inline)")
    parser.add_argument("--script", help="Path to voice-script.md (auto-extract)")
    parser.add_argument("--voice", default="opus", help="Voice ID (default: opus)")
    parser.add_argument("--tts-url", default="http://localhost:9879", help="TTS server URL")
    parser.add_argument("--format", default="wav", choices=["wav", "mp3", "opus"], help="Audio format")
    parser.add_argument("--output", "-o", required=True, help="Output audio file path")
    args = parser.parse_args()

    if args.text:
        text = args.text
    elif args.script:
        text = extract_script_text(args.script)
    else:
        print("Error: provide --text or --script", file=sys.stderr)
        sys.exit(1)

    print(f"Narration: {len(text)} chars, voice={args.voice}", file=sys.stderr)
    synthesize(text, args.voice, args.tts_url, args.output, args.format)


if __name__ == "__main__":
    main()
