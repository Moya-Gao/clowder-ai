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


# Voice clone profiles — mirrors packages/api/src/config/cat-voices.ts defaults
# Qwen3-TTS Base clone: ref_audio + ref_text + instruct → zero-shot voice cloning
VOICE_PROFILES: dict[str, dict] = {
    "opus": {
        "ref_audio": str(Path.home() / "projects/relay-station/GPT-SoVITS/character-models/genshin/流浪者/vo_wanderer_dialog_greetingMorning.wav"),
        "ref_text": "快醒醒，太阳要晒屁股咯。哈，你不会以为我会这么叫你起床吧？",
        "instruct": "用一个调皮狡黠的少年语气说话，带着得意和戏弄",
    },
    "codex": {
        "ref_audio": str(Path.home() / "projects/relay-station/GPT-SoVITS/character-models/genshin/魈/vo_xiao_dialog_close2.wav"),
        "ref_text": "别被污染，我不会留情的。我是说，既然是你，你应该能够保持坚定。",
        "instruct": "用一个傲娇冰山少年的语气说话，表面严厉实际关心",
    },
    "gemini": {
        "ref_audio": str(Path.home() / "projects/relay-station/GPT-SoVITS/character-models/genshin/班尼特/vo_bennett_dialog_greetingNight.wav"),
        "ref_text": "晚上好！今天的冒险怎么样？",
        "instruct": "用一个超级阳光开心的小男孩语气说话，充满热情和兴奋",
    },
}


def synthesize(text: str, voice: str, tts_url: str, output_path: str, fmt: str = "wav"):
    """Call TTS server and save audio file."""
    url = f"{tts_url}/v1/audio/speech"
    payload: dict = {
        "input": text,
        "voice": voice,
        "model": "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16",
        "response_format": fmt,
    }
    # Add voice clone params if profile exists
    profile = VOICE_PROFILES.get(voice)
    if profile:
        ref_path = profile["ref_audio"]
        if Path(ref_path).exists():
            payload["ref_audio"] = ref_path
            payload["ref_text"] = profile["ref_text"]
            payload["instruct"] = profile["instruct"]
            payload["temperature"] = 0.3
            print(f"Voice clone: {Path(ref_path).parent.name}/{Path(ref_path).name}", file=sys.stderr)
        else:
            print(f"Warning: ref_audio not found: {ref_path}, falling back to base voice", file=sys.stderr)
    body = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
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

    # TTS server can't handle literal newlines — strip them; punctuation provides natural pauses
    text = text.replace("\n", "")
    print(f"Narration: {len(text)} chars, voice={args.voice}", file=sys.stderr)
    synthesize(text, args.voice, args.tts_url, args.output, args.format)


if __name__ == "__main__":
    main()
