#!/usr/bin/env python3
"""
Voice audition script for Qwen3-TTS (Round 3: VoiceDesign + cute cat personas).

Usage:
  source ~/.cat-cafe/tts-venv/bin/activate
  python scripts/tts-qwen3-audition.py                          # all presets, t=0.3
  python scripts/tts-qwen3-audition.py --preset xianxian_v1     # single preset
  python scripts/tts-qwen3-audition.py --temperature 0.5        # adjust temperature
  python scripts/tts-qwen3-audition.py --custom-voice           # use CustomVoice model instead
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

# --- Model configs ---

MODELS = {
    "voicedesign": "mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16",
    "customvoice": "mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16",
}

# --- VoiceDesign presets: describe the voice you want in text ---
# VoiceDesign uses `instruct` to *design* the voice from scratch.
# No need for a base `voice` param - the model creates it from description.

VOICEDESIGN_PRESETS: dict[str, dict] = {
    # === Round 8: 人设校正！基于投票认证 + 铲屎官反馈 ===
    # 宪宪 = 外表乖巧内心坏坏（哪吒方向！不是温柔夏目！）
    # 砚砚 = 傲娇小冰山（日番谷/飞影/影山方向）
    # 烁烁 = 纯粹阳光元气（日向方向）

    # === 宪宪 (布偶猫) — 表面可爱乖巧，骨子里有点坏 ===
    # 认证坏猫猫：猫猫杀欺骗大师、坏猫培训班创办人
    # === Round 9: 采纳 GPT Pro 建议的负向词策略 ===
    "xianxian_r9_v1": {
        "name": "宪宪 R9v1 (坏猫正太+负向词)",
        "desc": "哪吒型坏猫 + 负向词排除女声/壮汉",
        "instruct": (
            "普通话，10到11岁少年音，调皮狡黠，带一点得意洋洋，"
            "表面乖巧无辜实际上在算计，音色偏清亮活泼，"
            "不要女声，不要成年低沉，不要壮汉，不要播音腔，"
            "不要奶萌萝莉感，不要沙哑，"
            "像一个恶作剧成功装无辜的小男孩，正太音，男童声。"
        ),
    },
    "xianxian_r9_v2": {
        "name": "宪宪 R9v2 (腹黑正太+负向词)",
        "desc": "腹黑小天使 + 负向词排除",
        "instruct": (
            "普通话，11岁少年音，温温柔柔但胸有成竹，"
            "外表乖巧可爱内心有点小坏，声音清脆稚嫩，"
            "不要女声，不要成年男低音，不要壮汉卖萌，"
            "不要沙哑，不要萝莉感，不要过分热情，"
            "像一只装作在撒娇其实在算计的小猫，正太音，男孩童声。"
        ),
    },
    "xianxian_r9_v3": {
        "name": "宪宪 R9v3 (少年散兵风+负向词)",
        "desc": "散兵/流浪者方向：傲慢得意的小王子",
        "instruct": (
            "普通话，10到12岁少年音，傲慢自信，带着嘲讽的微笑，"
            "声音清亮高挑但有一点冷，像个小王子在俯视别人，"
            "聪明狡猾但藏在可爱的外表下面，"
            "不要女声，不要成年低沉，不要壮汉，不要播音腔，"
            "不要夸张戏剧腔，不要奶萌，"
            "正太音，男童声线，傲慢但可爱。"
        ),
    },
    "xianxian_r9_v4": {
        "name": "宪宪 R9v4 (行秋风书生坏猫)",
        "desc": "行秋方向：文质彬彬但腹黑的书生少年",
        "instruct": (
            "普通话，11到12岁少年音，文质彬彬但骨子里狡黠，"
            "声音温润清雅像个小书生，语速从容不紧不慢，"
            "看似谦和有礼实际胸有成竹步步为营，"
            "不要女声，不要成年低沉，不要壮汉，不要沙哑，"
            "不要过分热情，不要萝莉感，"
            "正太音，男孩童声，温润腹黑。"
        ),
    },

    # === 砚砚 (缅因猫) — 傲娇小冰山，嘴硬心软 ===
    # 方向：日番谷冬狮郎/飞影/影山飞雄
    "yanyan_r8_v1": {
        "name": "砚砚 R8v1 (日番谷型正太队长)",
        "desc": "冷酷小队长：别叫我小孩！我是队长！",
        "instruct": (
            "一个11岁的小男孩，声音清冷干净。男孩声线。"
            "说话冷冰冰的，语气里带着一丝不耐烦。"
            "像一个不喜欢被小看的天才少年。"
            "嘴上很严厉，但偶尔会不小心露出关心的语气。"
            "正太音，男童声，傲娇冰山。"
        ),
    },
    "yanyan_r8_v2": {
        "name": "砚砚 R8v2 (飞影型冷酷正太)",
        "desc": "少言寡语的冷酷小天才",
        "instruct": (
            "一个10岁的小男孩。男生声音，不是女生。"
            "声音低沉但还是小孩子的音域，冷冷的。"
            "说话很少废话，每个字都很精准。"
            "像一个不屑于解释的小天才，但其实很靠谱。"
            "正太音，男孩童声，冷酷寡言。"
        ),
    },
    "yanyan_r8_v3": {
        "name": "砚砚 R8v3 (影山型傲娇天才)",
        "desc": "天才但不会表达的傲娇小鬼",
        "instruct": (
            "一个11岁的小男孩。男孩的声音，童声。"
            "说话生硬直接，不会拐弯抹角。"
            "语气有点凶，但其实是因为着急想帮忙。"
            "像一个嘴笨但技术超强的小孩在纠正别人的错误。"
            "正太音，男童声线，傲娇直球。"
        ),
    },

    # === 烁烁 (暹罗猫) — 纯粹阳光，日向翔阳方向 ===
    "shuoshuo_r8_v1": {
        "name": "烁烁 R8v1 (日向型阳光正太)",
        "desc": "纯粹的阳光和热情，永不停歇",
        "instruct": (
            "一个10岁的小男孩，声音特别明亮。男孩的声音。"
            "说话充满热情和兴奋，像太阳一样温暖。"
            "语速快，声音高，每句话都像在分享开心的事。"
            "天真烂漫，没有心机，看到什么好的就大声喊出来。"
            "正太音，男孩童声，阳光灿烂。"
        ),
    },
    "shuoshuo_r8_v2": {
        "name": "烁烁 R8v2 (路飞型冒险正太)",
        "desc": "无忧无虑的冒险小子",
        "instruct": (
            "一个11岁的小男孩。男生的声音，不是女生。"
            "说话大大咧咧的，特别开朗爽快。"
            "声音洪亮有力但还是小孩子的高音。"
            "像一个什么都不怕的小冒险家。"
            "正太音，小男孩声线，无忧无虑。"
        ),
    },
}

# --- CustomVoice presets (for --custom-voice mode) ---

CUSTOMVOICE_PRESETS: dict[str, dict] = {
    # === 宪宪 CustomVoice 试听 — 坏猫猫方向 ===
    "xianxian_cv_aiden": {
        "name": "宪宪 CV-aiden (坏猫正太)",
        "desc": "aiden底子 + 坏猫instruct",
        "voice": "aiden",
        "instruct": (
            "用一个调皮可爱的小男孩的语气说话。"
            "声音稚嫩但带着一点得意和狡黠。"
            "像一个外表乖巧内心有点坏的小正太。"
        ),
    },
    "xianxian_cv_ryan": {
        "name": "宪宪 CV-ryan (坏猫正太)",
        "desc": "ryan底子 + 坏猫instruct",
        "voice": "ryan",
        "instruct": (
            "用一个调皮可爱的小男孩的语气说话。"
            "声音稚嫩但带着一点得意和狡黠。"
            "像一个外表乖巧内心有点坏的小正太。"
        ),
    },
    "xianxian_cv_dylan": {
        "name": "宪宪 CV-dylan (坏猫正太)",
        "desc": "dylan底子 + 坏猫instruct",
        "voice": "dylan",
        "instruct": (
            "用一个调皮可爱的小男孩的语气说话。"
            "声音稚嫩但带着一点得意和狡黠。"
            "像一个外表乖巧内心有点坏的小正太。"
        ),
    },
    "xianxian_cv_eric": {
        "name": "宪宪 CV-eric (坏猫正太)",
        "desc": "eric底子 + 坏猫instruct",
        "voice": "eric",
        "instruct": (
            "用一个调皮可爱的小男孩的语气说话。"
            "声音稚嫩但带着一点得意和狡黠。"
            "像一个外表乖巧内心有点坏的小正太。"
        ),
    },
}

# --- Test sentences with cat personality + verbal tics ---

TEST_SENTENCES = {
    "xianxian_intro": "你好呀，我是宪宪，猫猫咖啡馆的布偶猫喵～ 今天一起写代码吧。",
    "xianxian_code": "这个 Provider 的类型定义没对齐呢，先收一收再扩接口，不然会越写越乱的喵。",
    "xianxian_happy": "哼，宪宪写的才没 bug 呢！喵～",
    "xianxian_serious": "嗯...这个 Redis 连接池的问题有点严重，我们今天得修好它喵。",
    "yanyan_intro": "我是砚砚。这份 PR 我来 review 一下。",
    "yanyan_code": "第 42 行，这里的类型断言不安全。建议用 type guard 替代。",
    "yanyan_review": "P1 有两个问题。第一，缺少边界检查。第二，异步错误没有 catch。请修复后重新提交。",
    "yanyan_serious_cute": "嗯，这个 bug 很严重哦。但是砚砚已经找到原因了喵，放心交给我吧！",
    "shuoshuo_intro": "嘿嘿！我是烁烁！暹罗猫设计师！今天有什么好玩的项目吗喵？",
    "shuoshuo_excited": "哇！这个配色方案也太好看了吧！我要用渐变！喵喵喵！",
    "shuoshuo_idea": "等一下等一下！我有个超棒的想法！如果我们把导航栏做成透明的呢？",
}


def run_audition(args):
    """Run TTS audition."""
    try:
        from mlx_audio.tts.generate import generate_audio as tts_generate
    except ImportError:
        print("ERROR: mlx-audio not installed. Run: pip install -U mlx-audio")
        sys.exit(1)

    use_custom = args.custom_voice
    model_id = MODELS["customvoice"] if use_custom else MODELS["voicedesign"]
    model_label = "customvoice" if use_custom else "voicedesign"
    presets = CUSTOMVOICE_PRESETS if use_custom else VOICEDESIGN_PRESETS

    temp_suffix = f"-t{args.temperature}" if args.temperature != 0.7 else ""
    output = Path(args.output_dir) / f"qwen3-{model_label}{temp_suffix}"
    output.mkdir(parents=True, exist_ok=True)

    if args.preset:
        if args.preset in presets:
            presets = {args.preset: presets[args.preset]}
        else:
            print(f"Preset '{args.preset}' not found. Available: {list(presets.keys())}")
            sys.exit(1)

    # Filter test sentences by preset if it's cat-specific
    def sentences_for_preset(preset_name: str) -> dict[str, str]:
        if args.text:
            return {"custom": args.text}
        # Match sentences to cat
        if "xianxian" in preset_name:
            return {k: v for k, v in TEST_SENTENCES.items() if k.startswith("xianxian")}
        if "yanyan" in preset_name:
            return {k: v for k, v in TEST_SENTENCES.items() if k.startswith("yanyan")}
        if "shuoshuo" in preset_name:
            return {k: v for k, v in TEST_SENTENCES.items() if k.startswith("shuoshuo")}
        return TEST_SENTENCES

    print(f"=== Qwen3-TTS Audition (Round 3) ===")
    print(f"Model: {model_id}")
    print(f"Mode: {'CustomVoice' if use_custom else 'VoiceDesign'}")
    print(f"Temperature: {args.temperature}")
    print(f"Presets: {', '.join(presets.keys())}")
    print(f"Output: {output.resolve()}\n")

    for preset_name, preset in presets.items():
        preset_dir = output / preset_name
        preset_dir.mkdir(parents=True, exist_ok=True)
        print(f"--- {preset['name']} ---")
        print(f"    {preset['desc']}")
        print(f"    instruct: {preset['instruct'][:80]}...")

        sentences = sentences_for_preset(preset_name)
        for sent_key, sent_text in sentences.items():
            print(f"  {sent_key}: {sent_text[:50]}... ", end="", flush=True)

            t0 = time.time()
            try:
                kwargs = {
                    "text": sent_text,
                    "model": model_id,
                    "lang_code": "zh",
                    "temperature": args.temperature,
                    "output_path": str(preset_dir),
                    "file_prefix": sent_key,
                    "audio_format": "wav",
                    "verbose": False,
                    "instruct": preset["instruct"],
                }
                if "voice" in preset:
                    kwargs["voice"] = preset["voice"]

                tts_generate(**kwargs)
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

    print(f"Audition files: {output.resolve()}/")
    print()
    print("Listen and compare! Recommended order:")
    print("  1. xianxian_v1/xianxian_happy  (the 'no bugs' line)")
    print("  2. shuoshuo_v1/shuoshuo_excited (the excited designer)")
    print("  3. yanyan_v1/yanyan_review     (the serious reviewer)")


def main():
    parser = argparse.ArgumentParser(description="Cat Cafe TTS Audition Round 3")
    parser.add_argument("--preset", help="Single preset name to test")
    parser.add_argument("--text", help="Custom text (overrides test sentences)")
    parser.add_argument("--temperature", type=float, default=0.3, help="Sampling temp (default: 0.3 for consistency)")
    parser.add_argument("--output-dir", default="./voice-audition", help="Output directory")
    parser.add_argument("--custom-voice", action="store_true", help="Use CustomVoice model instead of VoiceDesign")
    args = parser.parse_args()
    run_audition(args)


if __name__ == "__main__":
    main()
