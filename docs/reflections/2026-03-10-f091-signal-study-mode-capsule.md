---
capsule_id: "F091-2026-03-10"
context: "Signal Study Mode — 从 RSS 阅读器升级为学习伴侣（11 Phase 全量完成）"
feature_ids: [F091]
doc_kind: capsule
created: 2026-03-10
updated: 2026-03-18
---

## What Worked
- 面向终态不分阶段的策略有效：24 个 AC 在一天内分 2 个 PR 全部落地（Phase 1-3 + Phase 4），比分多阶段交付更快
- 砚砚(GPT-5.4)头脑风暴补了 5 个缺口场景（R20-R24），质量高——删除语义、备注边界、thread edge cases 都是铲屎官会踩到的坑
- collection↔studyMeta 原子性经过 codex 5 轮 review 打磨，从"先写后 sync"演进到"shell→sync→update"三步模式，配套 11 个测试
- 记忆对接用 session search 而不是 hindsight/RAG，铲屎官明确要求"我们自己的记忆架构"，实现也确实走的 `TranscriptReader.search`
- AC-12 "打开原文"最初按 spec 要站内渲染，但铲屎官实际需求是"给人 show 来源时跳浏览器"——缩 scope 是正确决策
- **Phase 5-11 的用户驱动迭代模式高效**：铲屎官真实使用→报 bug→定位根因→修→review→merge，7 个 Phase 在一周内收敛。每个 Phase 都有明确的铲屎官反馈驱动
- **跨猫协作流畅**：Phase 11 金渐层+缅因猫首次合作完成云端 review 3 轮 P1 全修（timeout propagation + path traversal + regex alignment），跨 family 协作无摩擦
- **播客从空壳到真正可用经历了 4 个 Phase（5-8）**：LLM 脚本生成 → thread session reuse → 动态时长+丰富 prompt → 上下文注入修复，每一步都是铲屎官实际使用后的反馈驱动

## What Failed
- codex review 5 轮才收敛，核心问题是 collection 原子性。第一版 POST/PATCH/DELETE 都是"先写 collection 再 sync meta"，直到 R3 才彻底修完三个端点的写入顺序
- 路由级 integration test 第一版 monkey-patch 无效——`getArticleById` 返回 null 导致 `addCollection` throw 永远不触发。根因是不了解 `syncStudyMetaCollections` 内部的 null guard
- Phase 4 branch 创建时没 rebase main，导致 `git diff` 包含大量无关删除（F090/F088/F092），差点带脏数据开 PR
- **播客第一版是空壳**（Phase 5 根因）：占位符脚本 + 无去重 + 无 TTS，铲屎官在 2026-03-11 发现。说明初始 AC-5 的验收粒度不够——"播客有两种模式"不等于"播客能播"
- **WebpageFetcher 只抓标题不抓正文**（Phase 10 根因）：listing page 的 HTML 结构和文章独立页面不同，但 fetcher 只有一套抽取逻辑。19 篇 Anthropic 文章全部空内容
- **Completion 闭环延迟**：Feature 实际在 2026-03-17 Phase 11 merge 后已完成，但 BACKLOG/Status 更新直到 2026-03-18 才由金渐层补完。说明 merge-gate Step 7.5 的真相源同步在跨多 Phase 时容易被遗忘

## Trigger Missed
- 应该在写 `syncStudyMetaCollections` 时就同步写 integration test，而不是等 codex 连续 3 轮要求
- AC-1 的"完整 picker"从立项就标了 partial，但没在 Design Gate 时和铲屎官确认这到底是不是他要的——导致愿景守护时变成 blocker
- **播客 AC 应该定义"可播放"而非"有两种模式"**：如果 AC-5 的验收标准是"前端点播放能听到声音"，Phase 5 就不会拖到铲屎官发现空壳
- **多 Phase Feature 的 completion 闭环需要明确 owner**：11 个 Phase 分散在多只猫，最后一个 Phase merge 后没有猫主动触发 feat-lifecycle completion

## Doc Links
- [F091 聚合文件](../features/F091-signal-study-mode.md)
- [F091 实施计划](../plans/2026-03-10-f091-signal-study-mode.md)
- [PR #348 Phase 1-3](https://github.com/zts212653/cat-cafe/pull/348)
- [PR #351 Phase 4](https://github.com/zts212653/cat-cafe/pull/351)
- [PR #382 Phase 5 播客](https://github.com/zts212653/cat-cafe/pull/382)
- [PR #388 Phase 6 Thread Session](https://github.com/zts212653/cat-cafe/pull/388)
- [PR #395 Phase 7 质量修复](https://github.com/zts212653/cat-cafe/pull/395)
- [PR #405 Phase 8 上下文注入](https://github.com/zts212653/cat-cafe/pull/405)
- [PR #425 Phase 9 导航+笔记](https://github.com/zts212653/cat-cafe/pull/425)
- [PR #512 Phase 10 正文提取](https://github.com/zts212653/cat-cafe/pull/512)
- [PR #515 Phase 11 二次抓取](https://github.com/zts212653/cat-cafe/pull/515)

## Rule Update Target
- `MEMORY.md`: 添加"monkey-patch prototype 方法时，确认调用路径上的 null guard 是否会跳过被 patch 的方法"
- `shared-rules.md` 或 `quality-gate` skill: "AC 标 partial 的项，必须在 Design Gate 时和铲屎官确认最终 scope，不能拖到愿景守护"
- `feat-lifecycle` skill completion 章节: "多 Phase Feature 的最后一个 Phase merge 后，merge-gate 应自动触发 completion checklist reminder，防止闭环遗忘"
- `quality-gate` skill: "播客/音频类 AC 的验收标准必须包含'可播放'（端到端：生成→合成→前端播放），'有模式'不等于'能用'"
