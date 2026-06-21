---
feature_ids: [F195]
topics: [speaker-diarization, phase-h, review]
---

# Review Request: F195 Phase H — Speaker Diarization (Unsupervised Clustering)

Review-Target-ID: f195-phase-h
Branch: feat/f195-phase-h-speaker-diarization

## What

Phase H upgrades speaker attribution from Phase G's pre-enrollment-only approach to unsupervised online speaker diarization. Three commits:

1. **ClusterRegistry** (`speaker_cluster_registry.py`) — Online incremental centroid matching with 3 guardrails (min_segment_sec, max_clusters, assignment_margin). 26 tests covering lifecycle, 8 invariants, 10 adversarial scenarios.
2. **AudioSession integration** (`audio-service.py`) — Priority chain in `_attribute_speaker()`: enrolled cosine match (Phase G) > cluster centroid match (Phase H) > rule-based fallback (Phase C). Embedding gate now fires when `diarization_enabled OR has_enrolled_embeddings`. New `map_speaker_name()` for retroactive renaming + `/map-speaker` HTTP endpoint. 16 new tests.
3. **Eval metrics** (`eval_speaker_verification.py`) — `compute_der`, `compute_swap_rate`, `compute_fragmentation_rate`, `compute_unknown_rate` for AC-H4. 16 tests.

Total: 6 files, 1015 insertions, 9 deletions. 125 tests all green.

## Why

Phase G requires voice sample pre-enrollment, which is impractical for video/livestream/multi-party meetings. 铲屎官 tested Phase G and the gap was clear — unregistered speakers fall back to "有人说" which is unusable.

## Original Requirements（必填）

> 铲屎官原话（2026-06-20 实测后）：
> "谁特喵看视频和参加会议能提前注册啊！！"

- 来源：`docs/features/F195-meeting-copilot-live-advisory.md` lines 292-293
- **请对照上面的摘录判断：本 PR 是否让"无预注册场景"从不可用变为可用**

## Tradeoff

- **Online centroid matching** over pyannote streaming pipeline: pyannote 3.x is file-based (not streaming), and its hosted streaming mode would add external dependency. Simple centroid matching is adequate for MVP online clustering; pyannote batch eval is deferred to post-MVP.
- **Separate threshold** `SPEAKER_CLUSTER_THRESHOLD=0.65` vs Phase G's `SPEAKER_SIMILARITY_THRESHOLD=0.6`: clustering needs stricter threshold to avoid false merges with running-average centroids.
- **No cross-session speaker persistence**: each capture session starts fresh (spec explicitly excludes global speaker library).

## Architecture Ownership（必填）

Architecture cell: meeting-copilot
Map delta: none
Why: All changes within `scripts/meeting-copilot/` Python sidecar. No `packages/` boundary changes, no new stores/queues/routers.

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **Threshold separation**: `SPEAKER_CLUSTER_THRESHOLD=0.65` vs Phase G `SPEAKER_SIMILARITY_THRESHOLD=0.6` — is 0.05 delta sufficient to distinguish the two matching modes, or should cluster threshold be higher?
2. **Centroid running average**: `new = (old * count + emb) / (count + 1)` — this weighs all historical segments equally. Should we use exponential moving average to weight recent segments more heavily?
3. **Assignment margin**: `ASSIGNMENT_MARGIN=0.08` — if top1 and top2 cluster similarities differ by less than 0.08, the segment is marked ambiguous (no assignment). Is this margin too generous/strict?

### 价值 OQ（给 CVO，如有）
无 — 技术选择均可逆且不影响用户契约。

## Next Action

请审查代码正确性，特别关注：
- ClusterRegistry 状态管理（lifecycle owner = AudioSession, reset clears all）
- `_attribute_speaker()` priority chain correctness（enrolled > cluster > rule）
- Retroactive `map_speaker_name()` 只改 in-memory window lines（不改 artifact store MD files）
- Eval metric implementations correctness

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f195-phase-h/{reviewer-handle}`
- Start Command: Pure Python — `cd scripts/meeting-copilot && python -m pytest -v`
- Ports: N/A (no web/api server needed for review — pure Python unit tests)

## 自检证据

### Spec 合规
Quality gate report 通过（见上方 Quality Gate Report）:
- AC-H1 无监督聚类 ✅
- AC-H2 事后归名 ✅
- AC-H3 Phase G 兼容 ✅
- AC-H4 实测评估 ✅
- Hotfix pattern: false
- Follow-up tail scan: clean
- Artifact hygiene: clean
- Fallback layers: no code files in JS diff scope

### 测试结果
```
python -m pytest (4 files) → 125/125 passed in 0.21s ✅
No packages/ changes → pnpm test/lint/check/build not applicable
```

### 相关文档
- Plan: `docs/plans/2026-06-21-f195-phase-h-speaker-diarization.md`
- Feature: `docs/features/F195-meeting-copilot-live-advisory.md` (Phase H, lines 288-330)
