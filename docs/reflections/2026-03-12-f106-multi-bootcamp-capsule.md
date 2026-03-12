---
capsule_id: "F106-2026-03-12"
context: "多训练营支持 — 列表 modal + CTA 三路适配 + 独立 API 数据源"
feature_ids: [F106]
doc_kind: capsule
created: 2026-03-12
---

## What Worked
- 从 F087 自然演化立项，铲屎官需求清晰直接，Design Gate 用 Pencil wireframe 快速对齐 UX
- 后端天然支持多训练营（per-thread bootcampState），只需新增一个列表端点
- codex 三轮 review 发现了真实 P1（storeThreads 依赖侧栏生命周期），P2 也精准（刷新时机、API 失败兜底、重复 fetch）——每一轮都有新发现
- cloud review 也抓到一个重复 fetch 的 P2，与 codex 第二轮发现互补

## What Failed
- 初版直接用 `storeThreads`（sidebar 才加载的数据）作为 CTA 和 modal 的数据源，这是架构盲区——应该在设计阶段就识别出"数据加载时机 vs 渲染时机"的依赖关系
- `bootcampCount` 的 `useEffect` 依赖数组设计经历三次迭代：`[]` → `[showBootcampList]` → `[bootcampRefreshKey]`，说明 React effect 的刷新语义需要更仔细地建模，而不是凭直觉选依赖
- spec What 段漂移未及时同步——AC-A5 已改但 What 段还写着旧逻辑，被 gpt52 愿景守护发现

## Trigger Missed
- 无。从 kickoff → Design Gate → worktree → tdd → quality-gate → request-review → receive-review → merge-gate → 愿景守护，全流程走完

## Doc Links
- [F106 Feature Spec](../features/F106-multi-bootcamp.md)
- [F087 CVO Bootcamp](../features/F087-cvo-bootcamp.md)
- [Design wireframe](../../designs/f106-multi-bootcamp-ux.pen)
- PR #408

## Rule Update Target
- 无新规则。"数据加载时机"和"effect 依赖建模"是 React 基本功，不需要新流程规则
