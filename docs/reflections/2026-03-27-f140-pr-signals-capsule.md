---
capsule_id: "F140-2026-03-27"
context: "F140 GitHub PR Signals — 冲突检测 + Review Feedback 全来源感知（4 Phase 闭环）"
feature_ids: [F140]
doc_kind: capsule
created: 2026-03-27
---

## What Worked
- 三层架构分离（F141 发现 / 认领 / F140 追踪）让 F140 和 F141 可以并发开发互不阻塞
- Injectable 设计贯穿始终（`validateRepo`, `fetchPrStatus`, `checkMergeable`），测试 mock 轻松，云端 review 也容易验证
- suggestedSkill routing 从 trigger → promptTags → SystemPromptBuilder 一条线打通，没有中间丢失
- Phase D 的脏数据根因追查（GPT-5.4 调查）→ 护栏设计（不硬编码 repo）很干净
- 砚砚 R1 review 连续发现 3 个 P1（ConflictAutoExecutor 未接线、urgent 丢 suggestedSkill、checkMergeable 契约不匹配），都是静态分析难以发现的运行时 wiring 问题

## What Failed
- `mergeStateStatus` vs `mergeable` 的 GitHub API 词汇表差异导致云端 P1——写代码时凭记忆选了 `mergeStateStatus` 没查文档
- PR tracking 脏数据（`anthropic-cat-cafe/cat-cafe#743`）是 merge-gate 时传错 repoFullName 造成的，注册接口不做校验等于不设防
- Phase C 三个 P1 都是 wiring 问题（代码写了但没接到 DI 容器），说明 index.ts 的注入点太分散，应该做 checklist

## Trigger Missed
- Phase D 根因追查本应在发现脏数据时就自动触发，但实际是铲屎官看到 scheduler 面板异常才发现
- `validateRepo` 一开始用 catch-all 吃掉所有错误，云端 review 才指出需要区分 infra failure vs invalid repo——这个错误模式应该在写 catch 时就想到

## Doc Links
- Feature spec: `docs/features/F140-github-pr-automation.md`
- Phase C plan: `docs/plans/2026-03-26-f140-phase-c-auto-executor.md`
- Related: F133 (CI tracking), F139 (调度框架), F141 (Repo Inbox)
- PRs: #752 (A), #757 (B), #764 (dedup fix), #770 (C), #773 (D)

## Rule Update Target
- `shared-rules.md` 或 `lessons-learned.md`：catch-all error handling 反模式——任何对外部 CLI 的调用，必须区分"命令执行了但失败"和"命令本身不可用"
- `merge-gate` SKILL.md：PR tracking 注册时传入的 repoFullName 必须经过校验（现在 Phase D 已做到）
