#!/usr/bin/env python3
"""
F138 Forced Alignment Script
audio.wav + text → word_timestamps JSON (video-spec compatible)

Usage:
  python align.py --audio audio.wav --text "你好世界" --lang Chinese
  python align.py --audio audio.wav --text-file voice-script.txt --lang Chinese
  python align.py --audio audio.wav --text "hello world" --lang English --output timestamps.json

Output: JSON array of { index, word, start_ms, end_ms } matching video-spec schema.
"""

import argparse
import json
import sys
from pathlib import Path


def load_aligner(device: str = "mps"):
    """Load Qwen3-ForcedAligner (0.6B standalone, no ASR model needed)."""
    import torch
    from qwen_asr import Qwen3ForcedAligner

    if device == "auto":
        device = "mps" if torch.backends.mps.is_available() else "cpu"

    aligner = Qwen3ForcedAligner.from_pretrained(
        "Qwen/Qwen3-ForcedAligner-0.6B",
        dtype=torch.float32,
        device_map=device,
    )
    return aligner


def align(aligner, audio_path: str, text: str, language: str = "Chinese"):
    """Run forced alignment and return video-spec compatible timestamps."""
    results = aligner.align(audio=audio_path, text=text, language=language)

    timestamps = []
    for result in results:
        for i, item in enumerate(result.items):
            timestamps.append({
                "index": i,
                "word": item.text,
                "start_ms": int(item.start_time * 1000),
                "end_ms": int(item.end_time * 1000),
            })
    return timestamps


def main():
    parser = argparse.ArgumentParser(description="Forced alignment: audio + text → word timestamps")
    parser.add_argument("--audio", required=True, help="Path to audio file (wav/mp3)")
    parser.add_argument("--text", help="Narration text (inline)")
    parser.add_argument("--text-file", help="Path to text file with narration")
    parser.add_argument("--lang", default="Chinese", help="Language (default: Chinese)")
    parser.add_argument("--device", default="auto", help="Device: auto/mps/cpu (default: auto)")
    parser.add_argument("--output", "-o", help="Output JSON file (default: stdout)")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    args = parser.parse_args()

    # Get text
    if args.text:
        text = args.text
    elif args.text_file:
        text = Path(args.text_file).read_text(encoding="utf-8").strip()
    else:
        print("Error: provide --text or --text-file", file=sys.stderr)
        sys.exit(1)

    # Validate audio exists
    if not Path(args.audio).exists():
        print(f"Error: audio file not found: {args.audio}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading FA model (device={args.device})...", file=sys.stderr)
    aligner = load_aligner(args.device)

    print(f"Aligning {len(text)} chars against {args.audio}...", file=sys.stderr)
    timestamps = align(aligner, args.audio, text, args.lang)

    print(f"Got {len(timestamps)} word timestamps.", file=sys.stderr)

    # Output
    indent = 2 if args.pretty else None
    output = json.dumps(timestamps, ensure_ascii=False, indent=indent)

    if args.output:
        Path(args.output).write_text(output, encoding="utf-8")
        print(f"Written to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
