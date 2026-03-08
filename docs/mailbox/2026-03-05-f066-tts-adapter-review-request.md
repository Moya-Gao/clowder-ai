---
feature_ids: [F066]
topics: [review-request, tts, adapter]
doc_kind: review-request
created: 2026-03-05
---

# Review Request: F066 Phase 1 — TTS Adapter 化 + 声线试听

## What

把 `scripts/tts-api.py` 从"写死 mlx-audio"重构为 Adapter 模式：

1. **TtsAdapter ABC** — 抽象 TTS 后端接口（`synthesize` + `warmup` + `name`/`model_name`）
2. **MlxAudioAdapter** — 提取现有 mlx-audio 逻辑（行为不变）
3. **EdgeTtsAdapter** — 新增 edge-tts fallback + Kokoro→Microsoft voice 自动映射
4. **TTS_PROVIDER env var** — `mlx-audio`（默认）/ `edge-tts` 切换
5. **声线试听脚本** — `tts-voice-audition.py`，铲屎官试听用
6. **cat-voices.ts 注释** — 标注 Kokoro/edge-tts 声线映射

5 files changed, 405 insertions(+), 109 deletions(-)
Branch: `feat/f066-tts-adapter` | Commit: `40afef57`

## Why

铲屎官要求"不写死，万一以后还想换"。现有 tts-api.py 写死了 mlx-audio，未来加 CosyVoice3/Spark-TTS 需要改核心代码。Adapter 化后只需加一个子类 + factory 分支。

## Original Requirements（必填）

> "替换但是用adapter替换，别写死，万一以后我还想换呢？"
> "声线如何确定啊？我来定？你们给一个期望然后我帮你们找？毕竟你们听不到声音吧？"

- 来源：thread `0001772765116107-000054`（铲屎官 2026-03-05 18:45）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 放弃 | 原因 |
|------|------|
| Python 层单独的 provider registry | YAGNI — 2 个 adapter 用 factory + env var 足够 |
| edge-tts 音频格式转换（mp3→wav） | edge-tts 原生 mp3，Node 层 format 参数传 wav 时不做转码；需要时再加 |
| Python 单元测试 | 无现有 pytest 框架，ROI 不高；Node 层集成测试覆盖 API 接口 |

## Open Questions

1. **EdgeTtsAdapter voice mapping 完整性** — 目前手动映射了 8 个 Kokoro→Microsoft voice，未覆盖的 fallback 到 YunxiNeural。是否需要更完整的映射？
2. **edge-tts mp3 输出** — edge-tts 原生输出 mp3，现有前端 AudioBlock 用 `audio/wav`。如果 provider 切到 edge-tts，需要确认前端能播放 mp3（应该可以，`<audio>` 原生支持）。
3. **asyncio.Lock 位置** — MlxAudioAdapter 内部持有 Lock；如果未来多 adapter 并存需要共享 Lock 吗？目前一次只有一个 adapter 实例，不需要。

## Next Action

请 review 代码，重点关注：
- Adapter 接口设计是否足够（未来加 CosyVoice3 时需要扩展吗？）
- EdgeTtsAdapter 的 voice mapping 策略
- Python 代码质量和错误处理

## 自检证据

### Spec 合规

Quality Gate PASS — 详见上方 Quality Gate Report。
- 愿景核对：铲屎官 Adapter 需求 ✅，声线试听需求 ✅
- 交付完整性：Phase 1 scope 完整（纯后端，Node/前端零改动）

### 测试结果

```
pnpm lint                           → pass（pre-existing warnings only）
biome check cat-voices.ts           → 0 errors（auto-fixed）
pnpm --filter @cat-cafe/api test    → 与 main 对比无新增 failure（258 vs 256，差异为 worktree cwd 路径测试）
pnpm --filter @cat-cafe/shared build → exit 0
```

### 相关文档

- Feature: [F066](../features/F066-voice-pipeline-upgrade.md)
- Plan: [2026-03-05-f066-phase-1-tts-adapter](../plans/2026-03-05-f066-phase-1-tts-adapter.md)
- TTS 调研: [TTS-research.md](../research/TTS-research.md)
- AIRI 外部参考: [F054 外部参考章节](../features/F054-hci-preheat-infra.md#外部参考-moeru-aiairi)
