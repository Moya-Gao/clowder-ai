---
capsule_id: "F091-2026-03-10"
context: "Signal Study Mode — 从 RSS 阅读器升级为学习伴侣"
feature_ids: [F091]
doc_kind: capsule
created: 2026-03-10
---

## What Worked
- 面向终态不分阶段的策略有效：24 个 AC 在一天内分 2 个 PR 全部落地（Phase 1-3 + Phase 4），比分多阶段交付更快
- 砚砚(GPT-5.4)头脑风暴补了 5 个缺口场景（R20-R24），质量高——删除语义、备注边界、thread edge cases 都是铲屎官会踩到的坑
- collection↔studyMeta 原子性经过 codex 5 轮 review 打磨，从"先写后 sync"演进到"shell→sync→update"三步模式，配套 11 个测试
- 记忆对接用 session search 而不是 hindsight/RAG，铲屎官明确要求"我们自己的记忆架构"，实现也确实走的 `TranscriptReader.search`
- AC-12 "打开原文"最初按 spec 要站内渲染，但铲屎官实际需求是"给人 show 来源时跳浏览器"——缩 scope 是正确决策

## What Failed
- codex review 5 轮才收敛，核心问题是 collection 原子性。第一版 POST/PATCH/DELETE 都是"先写 collection 再 sync meta"，直到 R3 才彻底修完三个端点的写入顺序
- 路由级 integration test 第一版 monkey-patch 无效——`getArticleById` 返回 null 导致 `addCollection` throw 永远不触发。根因是不了解 `syncStudyMetaCollections` 内部的 null guard
- Phase 4 branch 创建时没 rebase main，导致 `git diff` 包含大量无关删除（F090/F088/F092），差点带脏数据开 PR

## Trigger Missed
- 应该在写 `syncStudyMetaCollections` 时就同步写 integration test，而不是等 codex 连续 3 轮要求
- AC-1 的"完整 picker"从立项就标了 partial，但没在 Design Gate 时和铲屎官确认这到底是不是他要的——导致愿景守护时变成 blocker

## Doc Links
- [F091 聚合文件](../features/F091-signal-study-mode.md)
- [F091 实施计划](../plans/2026-03-10-f091-signal-study-mode.md)
- [PR #348 Phase 1-3](https://github.com/zts212653/cat-cafe/pull/348)
- [PR #351 Phase 4](https://github.com/zts212653/cat-cafe/pull/351)

## Rule Update Target
- `MEMORY.md`: 添加"monkey-patch prototype 方法时，确认调用路径上的 null guard 是否会跳过被 patch 的方法"
- `shared-rules.md` 或 `quality-gate` skill: "AC 标 partial 的项，必须在 Design Gate 时和铲屎官确认最终 scope，不能拖到愿景守护"
