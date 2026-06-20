---
feature_ids: [F195]
topics: [speaker-verification, voice-embedding, review-request]
doc_kind: mailbox
created: 2026-06-20
---

# Review Request: F195 Phase G — Speaker Verification (voice embedding)

Review-Target-ID: f195
Branch: feat/f195-phase-g-speaker-verification

## What

将 `audio-service.py` 的纯规则 speaker 归因（mic→host / 2人→other / else→"有人说"）升级为基于 voice embedding 的声纹识别。新增 `SpeakerEmbedder` 模块封装 3D-Speaker CAM++ 模型，扩展 `enroll()` 接受语音样本提取 embedding，`_attribute_speaker()` 用 cosine similarity 匹配最近邻，similarity < threshold 时降级到原有规则归因。

**变更范围**：仅 `scripts/meeting-copilot/` (Python sidecar)，零 packages/ 改动。

| 文件 | 变更 |
|------|------|
| `speaker_embedder.py` (新) | SpeakerEmbedder：lazy-load modelscope pipeline, extract(), similarity() |
| `test_speaker_embedder.py` (新) | 10 tests: cosine similarity (5), extract (4), performance (1) |
| `audio-service.py` (改) | enroll() 支持 voice_sample, _attribute_speaker(chunk_embedding), _process_chunk 集成, status() 安全序列化 |
| `test_audio_service.py` (改) | +18 tests: enrollment with voice (6), embedding attribution (7), integration (5) |
| `eval_speaker_verification.py` (新) | CLI 离线评估脚本 (segment ablation, per-speaker accuracy, cross-device) |
| `requirements.txt` (改) | +modelscope>=1.10 |

## Why

铲屎官和朋友聊后决定"声纹识别现在很成熟了，排进 F195 下一个 Phase"。Phase C 的规则归因在 3人+ 会议完全无法区分谁在说话（只能显示"有人说"）。声纹识别是让会议纪要真正可用的关键能力。

## Original Requirements（必填）
> 铲屎官原话（2026-05-27）：
> "声纹识别要不直接排进 F195 下一个 Phase 我觉得可以排一下"
> 朋友说："现在声纹识别技术很成熟了"
- 来源：`docs/features/F195-meeting-copilot-live-advisory.md` Phase G section (L238-285)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **选 enrollment + cosine 匹配**（已知说话人），放弃全自动 diarization（pyannote 完整 pipeline 复杂度高，DER 在真实会议高达 46-53%）
- **选 modelscope/3D-Speaker CAM++**，放弃 WeSpeaker ECAPA-TDNN（CAM++ 同精度但更小更快）
- **选 Python 嵌入 audio-service.py**，放弃 Swift MLX 迁移（先验证 Python 路径够不够用）
- `_attribute_speaker()` 内嵌 embedding path + fallback，而非拆两个函数——保持单一入口的清晰性

## Architecture Ownership（必填）
Architecture cell: meeting-copilot (无独立 cell — Python sidecar)
Map delta: none
Why: 所有改动局限于 `scripts/meeting-copilot/` Python sidecar 内部，不改变任何 packages/ 架构边界或 API 契约

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. `_attribute_speaker()` 的 embedding path 先找 best match 再判 threshold——这意味着 2 个 enrolled speaker 都 < 0.6 时会 fallback 到规则，但如果 best = 0.55 而 second = 0.30，用户可能期望归到 best speaker。当前设计是保守策略（宁可不猜也不猜错），reviewer 觉得合理吗？
2. `_process_chunk` 里 `has_enrolled_embeddings` 每次检查所有 participants——O(n) 但 n 通常 ≤10，实际开销可忽略。reviewer 认为需要缓存吗？

### 价值 OQ（给 CVO，如有）
无——技术选型在 plan 阶段已定，回滚成本低（一个 Python 模块 + enroll 扩展）。

## Next Action

请 review 代码正确性（embedding 提取 → cosine 匹配 → fallback 链路）和测试覆盖完整性。特别关注：
- `enroll()` voice_sample 处理的边界条件
- `_attribute_speaker()` embedding/rule-based 双路径的正确互不干扰
- `status()` / `h_enroll` 的 ndarray 序列化安全性

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f195/{reviewer-handle}`
- Start Command: `cd scripts/meeting-copilot && python -m pytest test_speaker_embedder.py test_audio_service.py -v`
- Ports: N/A（Python sidecar 无 web/api 端口）

## 自检证据

### Spec 合规
Quality Gate PASS — 5 ACs 全覆盖：G1 enrollment ✅, G2 real-time attribution ✅, G3 fallback ✅, G4 offline eval script ✅, G5 performance budget ✅

### 测试结果
```
python -m pytest test_speaker_embedder.py test_audio_service.py -v → 66 passed in 0.24s ✅
pnpm check → 0 errors ✅
pnpm lint → 0 errors (warnings only, pre-existing) ✅
```

### 相关文档
- Plan: `docs/plans/2026-06-19-f195-phase-g-speaker-verification.md`
- Feature: `docs/features/F195-meeting-copilot-live-advisory.md` (Phase G, L238-285)
- Research: `docs/research/2026-05-27-multimodal-perception-research/`
