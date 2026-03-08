---
feature_ids: [F066]
topics: [tts, adapter, mlx-audio, edge-tts]
doc_kind: plan
created: 2026-03-05
---

# F066 Phase 1: Python TTS Adapter 化 + 声线试听

> **For Claude:** REQUIRED SUB-SKILL: Use parallel-execution skill (Mode C) to implement this plan task-by-task.

**Goal:** 把 tts-api.py 从"写死 mlx-audio"重构为 Adapter 模式，支持 env var 切换 TTS provider；同时提供声线试听脚本。

**Architecture:** Python TTS 服务引入 `TtsAdapter` ABC → 两个实现 `MlxAudioAdapter` + `EdgeTtsAdapter` → `TTS_PROVIDER` env var 选择 → 现有 OpenAI 兼容 API 不变。

**Tech Stack:** Python 3.11+, FastAPI, mlx-audio, edge-tts, abc

**关键发现：tts-api.py 已经是 mlx-audio 了！** F034 最终交付就用了 Kokoro-82M。所以 Phase 1 的核心工作是"加 Adapter 抽象 + edge-tts fallback"，不是"从 edge-tts 迁移到 mlx-audio"。

---

**Finish line:** `TTS_PROVIDER=edge-tts python scripts/tts-api.py` 跑 edge-tts；默认跑 mlx-audio；接口完全不变。

**What we're NOT building:**
- 不改 Node API 层
- 不改前端
- 不新增 Python 测试框架（Python 层靠 curl 手动验证 + Node 层已有测试覆盖）
- 不做新 provider（CosyVoice3 等留给后续 Phase）

---

### Task 1: TtsAdapter ABC + 重构 tts-api.py

**Files:**
- Modify: `scripts/tts-api.py`

**Step 1: 重构 tts-api.py — 提取 TtsAdapter ABC**

把现有的 mlx-audio 逻辑提取为 `MlxAudioAdapter`，新增 `EdgeTtsAdapter`，路由端点通过 Adapter 调用。

```python
# 在 tts-api.py 中新增的结构：

from abc import ABC, abstractmethod

class TtsAdapter(ABC):
    """Abstract TTS backend adapter."""

    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def synthesize(self, text: str, voice: str, lang_code: str,
                         speed: float, audio_format: str) -> bytes: ...

    @abstractmethod
    def warmup(self) -> None:
        """Pre-load model / verify connectivity. May be no-op."""
        ...


class MlxAudioAdapter(TtsAdapter):
    """Apple Silicon native TTS via mlx-audio."""

    def __init__(self, model: str):
        self._model = model

    @property
    def name(self) -> str:
        return "mlx-audio"

    async def synthesize(self, text, voice, lang_code, speed, audio_format) -> bytes:
        # Move existing synthesize logic here
        ...

    def warmup(self):
        # Move existing warmup logic here
        ...


class EdgeTtsAdapter(TtsAdapter):
    """Microsoft Edge TTS (cloud, no GPU needed)."""

    @property
    def name(self) -> str:
        return "edge-tts"

    async def synthesize(self, text, voice, lang_code, speed, audio_format) -> bytes:
        import edge_tts
        comm = edge_tts.Communicate(text=text, voice=voice, rate=f"{int((speed - 1) * 100):+d}%")
        # edge-tts outputs mp3 by default; collect chunks
        audio_chunks = []
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        return b"".join(audio_chunks)

    def warmup(self):
        pass  # No model to load


def create_adapter(provider: str, model: str) -> TtsAdapter:
    """Factory: create TTS adapter based on provider name."""
    if provider == "mlx-audio":
        return MlxAudioAdapter(model=model)
    elif provider == "edge-tts":
        return EdgeTtsAdapter()
    else:
        raise ValueError(f"Unknown TTS provider: {provider}. Use 'mlx-audio' or 'edge-tts'")
```

**Step 2: 更新 synthesize 端点和 main() 使用 adapter**

- `/v1/audio/speech` 端点调 `adapter.synthesize()`
- `main()` 读 `TTS_PROVIDER` env var，调 `create_adapter()`
- `/health` 返回 `adapter.name`

**Step 3: 更新 tts-server.sh**

- 加 `TTS_PROVIDER` env var 说明
- edge-tts 模式不检查 mlx-audio 依赖

**Step 4: 验证**

```bash
# mlx-audio (默认)
python scripts/tts-api.py &
curl -X POST http://localhost:9877/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input":"你好，我是布偶猫","voice":"zm_yunjian"}' \
  --output test-mlx.wav
curl http://localhost:9877/health
# Expected: {"status":"ok","model":"mlx-community/Kokoro-82M-bf16","backend":"mlx-audio"}

# edge-tts
TTS_PROVIDER=edge-tts python scripts/tts-api.py --port 9878 &
curl -X POST http://localhost:9878/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input":"你好，我是布偶猫","voice":"zh-CN-YunxiNeural"}' \
  --output test-edge.wav
curl http://localhost:9878/health
# Expected: {"status":"ok","model":"none","backend":"edge-tts"}
```

**Step 5: Commit**

```bash
git add scripts/tts-api.py scripts/tts-server.sh
git commit -m "feat(F066): TTS Adapter 化 — mlx-audio + edge-tts 可切换 [布偶猫🐾]"
```

---

### Task 2: 声线试听脚本

**Files:**
- Create: `scripts/tts-voice-audition.py`

**Step 1: 创建试听脚本**

```python
#!/usr/bin/env python3
"""
Voice audition script for Cat Cafe.
Generates sample audio for all available Kokoro Chinese voices.

Usage:
  source ~/.cat-cafe/tts-venv/bin/activate
  python scripts/tts-voice-audition.py                    # all zh voices
  python scripts/tts-voice-audition.py zm_yunjian         # specific voice
  python scripts/tts-voice-audition.py --text "自定义文本"  # custom text
"""

import argparse, sys
from pathlib import Path

# Kokoro-82M Chinese voices (from VOICES.md)
ZH_VOICES = {
    "zm_yunjian":  "男·云健 — 偏低沉温暖（宪宪候选）",
    "zm_yunxi":    "男·云希 — 清朗书生（砚砚候选）",
    "zm_yunyang":  "男·云扬 — 明快活泼（烁烁候选）",
    "zm_yunze":    "男·云泽 — 沉稳大气",
    "zf_xiaobei":  "女·小北",
    "zf_xiaoni":   "女·小妮",
    "zf_xiaoyi":   "女·小艺",
    "zf_yunxia":   "女·云霞",
}

DEFAULT_TEXT = (
    "你好！我是猫猫咖啡馆的一员。"
    "今天天气真不错，我们一起来讨论一下代码架构吧。"
    "这个函数的职责是不是太多了？我觉得应该拆分成两个模块。"
)

def main():
    parser = argparse.ArgumentParser(description="Cat Cafe Voice Audition")
    parser.add_argument("voices", nargs="*", help="Specific voice(s) to audition (default: all zh)")
    parser.add_argument("--text", default=DEFAULT_TEXT, help="Text to synthesize")
    parser.add_argument("--model", default="mlx-community/Kokoro-82M-bf16")
    parser.add_argument("--output-dir", default="./voice-audition", help="Output directory")
    args = parser.parse_args()

    try:
        from mlx_audio.tts.generate import generate_audio as tts_generate
    except ImportError:
        print("ERROR: mlx-audio not installed. Run: pip install mlx-audio 'misaki[zh]'")
        sys.exit(1)

    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)

    voices = args.voices if args.voices else list(ZH_VOICES.keys())

    print(f"=== Cat Cafe Voice Audition ===")
    print(f"Model: {args.model}")
    print(f"Text: {args.text[:50]}...")
    print(f"Voices: {len(voices)}")
    print(f"Output: {output.resolve()}\n")

    for voice in voices:
        desc = ZH_VOICES.get(voice, "unknown")
        print(f"  🎤 {voice} ({desc})... ", end="", flush=True)
        try:
            tts_generate(
                text=args.text,
                model=args.model,
                voice=voice,
                lang_code="z",
                output_path=str(output / voice),
            )
            print("✅")
        except Exception as e:
            print(f"❌ {e}")

    print(f"\n🎧 试听文件在: {output.resolve()}/")
    print("铲屎官请逐个播放，为每只猫选一个最合适的声线！")
    print("\n猫猫期望：")
    print("  宪宪 (布偶猫): 偏低沉温暖，语速略慢，'安静讲故事'")
    print("  砚砚 (缅因猫): 清朗干脆，语速标准，'认真审稿的编辑'")
    print("  烁烁 (暹罗猫): 明快年轻，语速略快，'灵感停不下来的设计师'")


if __name__ == "__main__":
    main()
```

**Step 2: 验证**

```bash
python scripts/tts-voice-audition.py zm_yunjian --text "你好世界"
# Expected: voice-audition/zm_yunjian/ 下有 wav 文件
```

**Step 3: Commit**

```bash
git add scripts/tts-voice-audition.py
git commit -m "feat(F066): 声线试听脚本 — 铲屎官用来选声线 [布偶猫🐾]"
```

---

### Task 3: cat-voices.ts 注释更新

**Files:**
- Modify: `packages/api/src/config/cat-voices.ts`

**Step 1: 加注释说明声线来源和 edge-tts 映射**

只加注释，不改代码逻辑：
- 标注当前声线是 Kokoro voice name
- 注释标注对应的 edge-tts voice name（回退参考）
- 标注"声线待铲屎官试听后可能更新"

**Step 2: Commit**

```bash
git add packages/api/src/config/cat-voices.ts
git commit -m "docs(F066): cat-voices 声线映射注释 [布偶猫🐾]"
```

---

### Task 4: .gitignore + 最终验证

**Step 1: .gitignore 加 voice-audition/**

**Step 2: 跑现有 Node 测试确认零回归**

```bash
pnpm --filter @cat-cafe/api test 2>&1 | tail -5
# Expected: all pass, 0 fail
```

**Step 3: 最终 commit**

```bash
git add .gitignore
git commit -m "chore(F066): gitignore voice-audition output [布偶猫🐾]"
```

---

## 涉及文件清单

| 操作 | 文件 |
|------|------|
| Modify | `scripts/tts-api.py` — Adapter 化重构 |
| Modify | `scripts/tts-server.sh` — env var 说明 |
| Create | `scripts/tts-voice-audition.py` — 声线试听 |
| Modify | `packages/api/src/config/cat-voices.ts` — 注释更新 |
| Modify | `.gitignore` — voice-audition/ |

## 不做清单

- 不改 Node API 层（MlxAudioTtsProvider 不变）
- 不改前端
- 不加 Python 测试框架
- 不做 CosyVoice3 / Spark-TTS adapter（后续 Phase）
- 不改声线（等铲屎官试听拍板）
