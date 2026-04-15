---
feature_ids: [F160]
topics: [task-board, skills, automation, review-request]
doc_kind: mailbox
created: 2026-04-15
---

# Review Request: F160 Phase C — Skill Automation

Review-Target-ID: f160-phase-c
Branch: feat/f160-phase-c

## What

三处改动让猫主动用毛线球：

1. **feat-lifecycle kickoff**（SKILL.md）：立项后自动创建"完成 F{NNN}"跟踪任务
2. **receive-review Red→Green**（SKILL.md）：每个 P1/P2 动手修之前先创建修复任务，修完后更新状态
3. **formatTaskSnapshot blocked 提醒**（TypeScript + tests）：有 blocked 任务时在 system prompt snapshot 头部插入醒目提醒

## Why

毛线球上线后三猫从未主动使用（Phase A 补了协议，Phase B 升级了 UI），Phase C 在 Skill 行为指引层编排自动化，让猫在正确节点自然地创建和管理任务。

## Original Requirements（必填）
> "为什么毛线球长期任务从来没有被任何猫用过？是因为这个能力猫猫不知道？"
> "为什么一个东西有两个展示的地方？"
> 三猫共识 R5：Skill 自动编排形成闭环
- 来源：`docs/features/F160-task-board-upgrade.md`（铲屎官原话 + 三猫头脑风暴）
- **请对照上面的摘录判断：Phase C 的 Skill 编排是否真正解决了"猫不主动用"的问题**

## Tradeoff

- 只做 AC 覆盖的三个 Skill（feat-lifecycle + receive-review + formatTaskSnapshot），不做 debugging/cross-cat-handoff 的自动任务（spec 列了但 AC 没覆盖，YAGNI）
- Skill markdown 给知识不给死步骤（Anthropic best practices: avoid railroading），包含 Gotcha 段落提醒边界情况
- blocked 提醒在 formatTaskSnapshot 而非 SystemPromptBuilder 新增段落，复用已有注入通道

## Open Questions

1. AC-C1/C2 是 Skill markdown 改动（行为指引），无自动化测试——reviewer 请判断指引是否清晰、Gotcha 是否充分
2. OQ-2（spec 里）：Phase C 自动创建的任务是否需要猫确认？当前实现是静默创建——reviewer 觉得合理吗？

## Next Action

请 review 三个 commit，重点关注 Skill 文本的清晰度和 blocked 提醒的实现。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f160-phase-c/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 纯后端 + skill markdown，无需启动前端

## 自检证据

### Spec 合规
- AC-C1 ✅：feat-lifecycle SKILL.md Step 6 已加任务创建指引 + Gotcha
- AC-C2 ✅：receive-review SKILL.md Step 0 已加 P1/P2 任务创建 + 修复后状态更新
- AC-C3 ✅：formatTaskSnapshot blocked 提醒 header + 3 new tests (15/15 pass)

### 测试结果
```
pnpm test → 8209/8209 pass (12 Redis-isolated pre-existing skip)
pnpm lint → 0 errors
pnpm check → 0 errors (biome 2186 files)
pnpm -r --if-present run build → all 5 packages Done
```

### Artifact Hygiene
根目录媒体/设计工件: 无 ✅

### 相关文档
- Feature: `docs/features/F160-task-board-upgrade.md`
- Plan: `docs/plans/2026-04-15-f160-phase-c-skill-automation.md`
- Research: `docs/research/2026-03-22-anthropic-skills-best-practices.md`

### Commits
```
cbe1b584f feat(F160): AC-C3 blocked task reminder in system prompt
a28e3ada7 feat(F160): AC-C2 receive-review auto-create fix task per P1/P2
eecdd839c feat(F160): AC-C1 feat-lifecycle kickoff auto-create task
```
