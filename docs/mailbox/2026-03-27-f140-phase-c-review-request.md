---
feature_ids: [F140]
doc_kind: review-request
created: 2026-03-27
author: opus
reviewer: codex
---

# Review Request: F140 Phase C — Auto-executor + CI Pass Wake-up + TriggerIntent

Review-Target-ID: f140-phase-c
Branch: feat/f140-phase-c

## What

F140 Phase C 交付 4 个核心改动：

1. **CI pass wake-up fix** — 修复铲屎官发现的 bug：CI 通知投递到 thread 但猫没被唤醒（原因：`CiCdCheckPoller` 和 `CiCdCheckTaskSpec` 都只在 `bucket === 'fail'` 时触发）。现在 CI pass 也触发，priority=normal，suggestedSkill=merge-gate
2. **TriggerIntent pipeline** — `ConnectorTriggerPolicy.suggestedSkill` → `promptTags: ['skill:X']` → `SystemPromptBuilder` 自动注入 `load skill: X` 指令
3. **Review intent routing** — `ReviewFeedbackTaskSpec` 按 decision 类型分流：CHANGES_REQUESTED→receive-review(urgent)，APPROVED→merge-gate(normal)，COMMENTED→no skill
4. **ConflictAutoExecutor** — 代码级 auto-rebase 服务。Clean rebase→push→resolved（不唤醒猫），冲突→abort+escalate with file list（唤醒猫）。Safety: feat/* only, never runtime, --force-with-lease, 30s timeout

## Why

Phase A/B 建了投递管道和 action hints，但猫收到通知后仍需手动读取 + 决策。Phase C 目标是 **从消息投递到行动，零人工干预**。

CI pass wake-up 是铲屎官实际使用中发现的 bug（F139 定位），一并修复。

## Original Requirements（必填）

> 铲屎官 18:41: "我发现 ci cd 投递到了猫猫没唤醒"
> 铲屎官 18:44: "ci 过了如果猫猫要执行合入，那他就应该被唤醒"
> 铲屎官 18:45: "好，那我们可以开 worktree 然后 Phase C 一起做了可以吗？"

- 来源：当前会话（2026-03-26 晚间对话）
- Phase C spec: `docs/plans/2026-03-26-f140-phase-c-auto-executor.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- ConflictAutoExecutor 选了 KD-C1（混合方案）：clean rebase 代码级处理，复杂冲突才唤醒猫。放弃了纯 LLM 方案（太贵）和纯代码方案（无法处理复杂冲突）
- TriggerIntent 通过现有 `promptTags` 机制流转，没有新增 InvocationContext 字段——最小改动
- AC-C3（review feedback auto-processing）suggestedSkill 路由已 wired，但完整 LLM 自动执行循环 deferred（intent is hint not constraint）

## Open Questions

1. `ConflictAutoExecutor` 目前只处理 feat/* 分支。其他分支命名模式（fix/*, chore/*）是否需要支持？
2. CI pass 用 `priority: 'normal'` 而非 `urgent`——如果铲屎官期望更快响应，需要调整
3. `--force-with-lease` 被拒时直接 skip（不重试）——是否需要通知铲屎官？

## Next Action

请 review 代码质量 + 安全护栏 + 愿景对齐。放行后我进 merge-gate。

## 自检证据

### Spec 合规

| AC | 状态 | 备注 |
|----|------|------|
| AC-C1 | ✅ | ConflictAutoExecutor clean rebase + push |
| AC-C2 | ✅ | escalate with file list on complex conflicts |
| AC-C3 | ⏳ | suggestedSkill routing wired; full auto-processing deferred |
| AC-C4 | ✅ | TriggerIntent end-to-end: trigger→promptTags→SystemPromptBuilder |
| AC-C5 | ✅ | 5 unit + 3 integration tests for ConflictAutoExecutor |
| AC-C6 | ✅ | feat/* only, never runtime, --force-with-lease, 30s timeout |

### 测试结果

```
pnpm gate → GATE PASSED (SHA 0e3c05e4, rebased on origin/main)
Phase C tests: 130 passed, 0 failed
Full suite: 5935 pass, 1 pre-existing Redis isolation fail (concurrent-fault-drill)
pnpm lint → 0 errors
pnpm check → 0 errors (biome)
```

### 相关文档

- Plan: `docs/plans/2026-03-26-f140-phase-c-auto-executor.md`
- Feature: `docs/features/F140-github-pr-automation.md`
- Related: F133 (CI/CD poller), F139 (conflict detection)

### 改动范围

11 files changed, 472 insertions(+), 15 deletions(-)
- 7 source files (4 modified, 1 new)
- 4 test files (1 modified, 3 new)
