#!/usr/bin/env python3
"""
Voice audition script for Cat Cafe.
Generates sample audio for all available Kokoro Chinese voices.

Usage:
  source ~/.cat-cafe/tts-venv/bin/activate
  python scripts/tts-voice-audition.py                    # all zh male voices
  python scripts/tts-voice-audition.py zm_yunjian         # specific voice
  python scripts/tts-voice-audition.py --all              # all zh voices (male + female)
  python scripts/tts-voice-audition.py --text "自定义文本"  # custom text
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Kokoro-82M Chinese voices (from mlx-community/Kokoro-82M-bf16 VOICES.md)
ZH_MALE_VOICES: dict[str, str] = {
    "zm_yunjian": "男·云健 — 偏低沉温暖（宪宪候选）",
    "zm_yunxi": "男·云希 — 清朗书生（砚砚候选）",
    "zm_yunyang": "男·云扬 — 明快活泼（烁烁候选）",
    "zm_yunze": "男·云泽 — 沉稳大气",
}

ZH_FEMALE_VOICES: dict[str, str] = {
    "zf_xiaobei": "女·小北",
    "zf_xiaoni": "女·小妮",
    "zf_xiaoyi": "女·小艺",
    "zf_yunxia": "女·云霞",
}

ALL_ZH_VOICES = {**ZH_MALE_VOICES, **ZH_FEMALE_VOICES}

DEFAULT_TEXT = (
    "你好！我是猫猫咖啡馆的一员。"
    "今天天气真不错，我们一起来讨论一下代码架构吧。"
    "这个函数的职责是不是太多了？我觉得应该拆分成两个模块。"
)


def main():
    parser = argparse.ArgumentParser(description="Cat Cafe Voice Audition")
    parser.add_argument("voices", nargs="*", help="Specific voice(s) to audition")
    parser.add_argument("--all", action="store_true", help="Include female voices too")
    parser.add_argument("--text", default=DEFAULT_TEXT, help="Text to synthesize")
    parser.add_argument("--model", default="mlx-community/Kokoro-82M-bf16")
    parser.add_argument("--output-dir", default="./voice-audition")
    args = parser.parse_args()

    try:
        from mlx_audio.tts.generate import generate_audio as tts_generate
    except ImportError:
        print("ERROR: mlx-audio not installed. Run: pip install mlx-audio 'misaki[zh]'")
        sys.exit(1)

    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)

    if args.voices:
        voices = {v: ALL_ZH_VOICES.get(v, "custom") for v in args.voices}
    elif args.all:
        voices = ALL_ZH_VOICES
    else:
        voices = ZH_MALE_VOICES  # Default: male only (三猫都是公猫)

    print("=== Cat Cafe Voice Audition ===")
    print(f"Model: {args.model}")
    print(f"Text: {args.text[:60]}...")
    print(f"Voices: {len(voices)}")
    print(f"Output: {output.resolve()}\n")

    for voice, desc in voices.items():
        print(f"  🎤 {voice} ({desc})... ", end="", flush=True)
        voice_dir = output / voice
        voice_dir.mkdir(parents=True, exist_ok=True)
        try:
            tts_generate(
                text=args.text,
                model=args.model,
                voice=voice,
                lang_code="z",
                output_path=str(voice_dir),
            )
            # Find generated file
            wav_files = list(voice_dir.glob("*.wav"))
            if wav_files:
                print(f"✅ → {wav_files[0].name}")
            else:
                print("✅ (check output dir)")
        except Exception as e:
            print(f"❌ {e}")

    print(f"\n🎧 试听文件在: {output.resolve()}/")
    print("\n铲屎官请逐个播放，为每只猫选一个最合适的声线！")
    print("\n猫猫期望：")
    print("  宪宪 (布偶猫): 偏低沉温暖，语速略慢 (0.95)，'安静讲故事的人'")
    print("  砚砚 (缅因猫): 清朗干脆，语速标准 (1.0)，'认真审稿的编辑'")
    print("  烁烁 (暹罗猫): 明快年轻，语速略快 (1.05)，'灵感停不下来的设计师'")


if __name__ == "__main__":
    main()
