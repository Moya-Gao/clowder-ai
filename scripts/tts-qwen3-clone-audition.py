#!/usr/bin/env python3
"""
Qwen3-TTS Clone Audition — 用原神角色参考音频做 zero-shot 克隆
=============================================================
优势 vs GPT-SoVITS：
  1. 中英混合不会乱码（"bug"/"PR"/"P1" 正常发音）
  2. 可叠加 instruct 控制情绪/风格
  3. MLX 原生 Apple Silicon 优化

Usage:
  source ~/.cat-cafe/tts-venv/bin/activate
  python scripts/tts-qwen3-clone-audition.py
  python scripts/tts-qwen3-clone-audition.py --preset xianxian_wanderer_v1
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

MODEL_ID = "mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16"
GENSHIN_DIR = Path.home() / "projects/relay-station/GPT-SoVITS/character-models/genshin"

# ── Test texts: 中英混合 + 纯中文，测 Qwen3 的优势 ──────────────────

# 宪宪 (坏猫): 毒舌、得意、腹黑
XIANXIAN_TEXTS = {
    "code_review": "嘿嘿，这个 bug 我早就发现了，只是想看看你们什么时候能注意到而已。",
    "cocky": "哼，代码质量这种事情，交给我就好了。你们只管提需求。",
    "fix_it": "说了多少次了，这个架构不能这么写。算了，我来改吧。",
    "morning": "铲屎官早上好呀。嗯？什么温柔？我可是坏猫猫哦。",
    "mixed_en": "这个 PR 有两个 P1 问题。第一个是 TypeScript 类型断言不安全，第二个是 Redis 连接池泄漏。",
}

# 砚砚 (傲娇冰山): 冷冰冰、认真、偶尔关心
YANYAN_TEXTS = {
    "serious": "嗯，这个问题很严重哦。但是砚砚已经找到原因了，放心交给我吧。",
    "review": "代码里有三个问题。第一个，变量命名不规范。不要让我说第二遍。",
    "cold": "这段代码写得还行。别误会，我只是实事求是。",
    "mixed_en": "Review 结果出来了。零个 P1，两个 P2。算你们运气好。",
    "tsundere": "别叫我小猫！我是审查官！……哼。",
}

# 烁烁 (阳光元气): 兴奋、停不下来
SHUOSHUO_TEXTS = {
    "excited": "哇，这个设计稿也太好看了吧！我要马上做出来！",
    "idea": "嘿嘿，烁烁又有新灵感了！这次的配色方案超级棒！",
    "show": "大家快来看！我发现了一个超酷的动画效果！",
    "bounce_back": "虽然上次的方案被否了，但是没关系！烁烁这次的想法更好！",
    "mixed_en": "这个 component 的 CSS animation 我用了 spring 物理引擎，效果超自然的！",
}

# ── Presets: 角色 + 参考音频 + instruct 叠加 ───────────────────────

PRESETS: dict[str, dict] = {
    # ── 宪宪: 流浪者 ──
    "xianxian_wanderer_v1": {
        "name": "宪宪×流浪者 v1 (冷淡毒舌)",
        "ref_audio": GENSHIN_DIR / "流浪者/vo_wanderer_dialog_share_01.wav",
        "ref_text": "没有。你想问什么就问吧，我看心情回答。",
        "instruct": "用一个傲慢得意的少年语气说话，带着嘲讽和戏弄，像一个外表乖巧内心坏坏的小猫",
        "texts": XIANXIAN_TEXTS,
    },
    "xianxian_wanderer_v2": {
        "name": "宪宪×流浪者 v2 (嘲讽得意)",
        "ref_audio": GENSHIN_DIR / "流浪者/vo_wanderer_dialog_greetingMorning.wav",
        "ref_text": "快醒醒，太阳要晒屁股咯。哈，你不会以为我会这么叫你起床吧？",
        "instruct": "用一个调皮狡黠的少年语气说话，带着得意和戏弄",
        "texts": XIANXIAN_TEXTS,
    },
    "xianxian_wanderer_v3": {
        "name": "宪宪×流浪者 v3 (不耐烦)",
        "ref_audio": GENSHIN_DIR / "流浪者/vo_wanderer_dialog_greetingNoon.wav",
        "ref_text": "我不需要吃饭。管好你自己和身边的小东西，就算是让我省心了。",
        "instruct": "用一个冷淡不耐烦但聪明的少年语气说话",
        "texts": XIANXIAN_TEXTS,
    },

    # ── 宪宪: 空(Aether) 备选 ──
    "xianxian_aether_v1": {
        "name": "宪宪×空 v1 (温暖少年)",
        "ref_audio": GENSHIN_DIR / "空/vo_CLLQ004_3_hero_01.wav",
        "ref_text": "就算不被记住，和同伴们共度的时光或许就是意义。和同伴们共同创造的未来，也是意义。",
        "instruct": "用一个温柔但暗藏小心思的少年语气说话，表面乖巧实际在算计",
        "texts": XIANXIAN_TEXTS,
    },

    # ── 砚砚: 魈 ──
    "yanyan_xiao_v1": {
        "name": "砚砚×魈 v1 (冷酷警告)",
        "ref_audio": GENSHIN_DIR / "魈/vo_xiao_dialog_greetingNight.wav",
        "ref_text": "夜晚，不祥之物最易骚动。你最好别出门。",
        "instruct": "用一个冷冰冰的少年语气说话，严肃认真，嘴硬但偶尔关心别人",
        "texts": YANYAN_TEXTS,
    },
    "yanyan_xiao_v2": {
        "name": "砚砚×魈 v2 (严肃关心)",
        "ref_audio": GENSHIN_DIR / "魈/vo_xiao_dialog_close2.wav",
        "ref_text": "别被污染，我不会留情的。我是说，既然是你，你应该能够保持坚定。",
        "instruct": "用一个傲娇冰山少年的语气说话，表面严厉实际关心",
        "texts": YANYAN_TEXTS,
    },

    # ── 烁烁: 班尼特 ──
    "shuoshuo_bennett_v1": {
        "name": "烁烁×班尼特 v1 (元气招呼)",
        "ref_audio": GENSHIN_DIR / "班尼特/vo_bennett_dialog_greetingNight.wav",
        "ref_text": "晚上好！今天的冒险怎么样？",
        "instruct": "用一个超级阳光开心的小男孩语气说话，充满热情和兴奋",
        "texts": SHUOSHUO_TEXTS,
    },
    "shuoshuo_bennett_v2": {
        "name": "烁烁×班尼特 v2 (惊喜开心)",
        "ref_audio": GENSHIN_DIR / "班尼特/vo_BNTCOP001_1904101_bennett_01.wav",
        "ref_text": "啊，是你！居然在这里遇上你，嘿嘿，今天运气可真不错。",
        "instruct": "用一个活泼可爱的小男孩语气说话，天真烂漫充满元气",
        "texts": SHUOSHUO_TEXTS,
    },
    "shuoshuo_bennett_v3": {
        "name": "烁烁×班尼特 v3 (可爱倒霉)",
        "ref_audio": GENSHIN_DIR / "班尼特/vo_BNTCOP001_1904101_bennett_16.wav",
        "ref_text": "欸嘿嘿，你可能不知道，我有一种特别特别倒霉的体质。",
        "instruct": "用一个乐观可爱的小男孩语气说话，虽然倒霉但永远积极向上",
        "texts": SHUOSHUO_TEXTS,
    },
}


def run_audition(args):
    """Run Qwen3-TTS clone audition."""
    try:
        from mlx_audio.tts.generate import generate_audio as tts_generate
    except ImportError:
        print("ERROR: mlx-audio not installed. Run: pip install -U mlx-audio")
        sys.exit(1)

    output = Path(args.output_dir) / "qwen3-clone"
    output.mkdir(parents=True, exist_ok=True)

    presets = PRESETS
    if args.preset:
        if args.preset in PRESETS:
            presets = {args.preset: PRESETS[args.preset]}
        else:
            print(f"Preset '{args.preset}' not found. Available: {list(PRESETS.keys())}")
            sys.exit(1)

    print(f"=== Qwen3-TTS Clone Audition ===")
    print(f"Model: {MODEL_ID}")
    print(f"Temperature: {args.temperature}")
    print(f"Presets: {', '.join(presets.keys())}")
    print(f"Output: {output.resolve()}\n")

    for preset_name, preset in presets.items():
        preset_dir = output / preset_name
        preset_dir.mkdir(parents=True, exist_ok=True)

        ref_audio = str(preset["ref_audio"])
        if not Path(ref_audio).exists():
            print(f"--- {preset['name']} --- SKIP (ref audio not found: {ref_audio})")
            continue

        print(f"--- {preset['name']} ---")
        print(f"    ref: {Path(ref_audio).name}")
        print(f"    instruct: {preset['instruct'][:60]}...")

        for sent_key, sent_text in preset["texts"].items():
            existing = sorted(preset_dir.glob(f"{sent_key}*.wav"))
            if existing and not args.force:
                print(f"  {sent_key}: SKIP (exists)")
                continue

            print(f"  {sent_key}: {sent_text[:50]}... ", end="", flush=True)
            t0 = time.time()
            try:
                tts_generate(
                    text=sent_text,
                    model=MODEL_ID,
                    ref_audio=ref_audio,
                    ref_text=preset["ref_text"],
                    instruct=preset["instruct"],
                    lang_code="zh",
                    temperature=args.temperature,
                    output_path=str(preset_dir),
                    file_prefix=sent_key,
                    audio_format="wav",
                    verbose=False,
                )
                elapsed = time.time() - t0
                gen_files = sorted(preset_dir.glob(f"{sent_key}*.wav"))
                if gen_files:
                    size_kb = gen_files[0].stat().st_size / 1024
                    print(f"OK ({elapsed:.1f}s, {size_kb:.0f}KB)")
                else:
                    print(f"OK ({elapsed:.1f}s)")
            except Exception as e:
                elapsed = time.time() - t0
                print(f"FAIL ({elapsed:.1f}s) {e}")
        print()

    print(f"\nAll done! Listen: open {output.resolve()}")


def main():
    parser = argparse.ArgumentParser(description="Qwen3-TTS Clone Audition with Genshin reference audio")
    parser.add_argument("--preset", help="Single preset name to test")
    parser.add_argument("--temperature", type=float, default=0.3, help="Sampling temp (default: 0.3)")
    parser.add_argument("--output-dir", default="./voice-audition", help="Output directory")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    args = parser.parse_args()
    run_audition(args)


if __name__ == "__main__":
    main()
