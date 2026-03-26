---
feature_ids: [F140]
related_features: [F133, F139, F141]
topics: [github, auto-rebase, auto-review, pr-signals, automation]
doc_kind: phase
created: 2026-03-26
author: opus
status: draft
---

# F140 Phase C: 自动执行器 (Auto-executor) 实施计划

> **Status**: Draft — 待 Design Gate 确认
> **Owner**: 布偶猫
> **Depends on**: Phase A ✅ + Phase B ✅ + echo-filter fix (PR #761)

## 背景

Phase A 交付了投递管道（Router → ConnectorBubble → InvokeTrigger），Phase B 交付了 action hints + Skill 行为决策树。但目前猫收到通知后仍需**手动读取 hints 并决定执行**——中间有人在环。

Phase C 的目标：**从消息投递到行动，零人工干预**。

## 设计决策

### KD-C1: 冲突 rebase 用代码级执行器，不过 LLM

| 方案 | 优点 | 缺点 |
|------|------|------|
| A. LLM 读 hint 后自己跑 git | 统一流程 | 贵（每次 rebase 消耗 Opus token）、慢、不确定性 |
| B. 代码级 executor（deterministic） | 快、便宜、确定性 | 需要新代码路径 |
| C. 混合：简单走代码，复杂走 LLM | 两全 | 实现复杂度中等 |

**选择 C**：简单 rebase（clean / ≤3 文件冲突）代码级处理，复杂冲突才唤醒猫。理由：90%+ 的冲突是 clean rebase，不值得花 LLM 成本。

### KD-C2: 引入 TriggerIntent 让猫知道该加载什么 Skill

当前 `ConnectorInvokeTrigger.trigger()` 没有 intent 参数，猫只能从消息内容推断该做什么。新增 `intent?: string` 字段，流经 `AgentRouter.routeExecution()` → SystemPromptBuilder，自动注入对应 Skill 指令。

### KD-C3: Review feedback 按 decision 类型分流 intent

| Decision | Intent | 行为 |
|----------|--------|------|
| CHANGES_REQUESTED | `receive-review` | 猫自动加载 receive-review，逐项处理 |
| APPROVED | `merge-gate` | 猫检查 CI + 冲突状态，准备 merge |
| COMMENTED only | `review-reply` | 猫读取评论，需回复则回复 |

## 交付物

### Task 1: ConflictAutoExecutor 服务

**文件**: `packages/api/src/infrastructure/email/ConflictAutoExecutor.ts`

```
ConflictAutoExecutor
├─ resolve(signal: ConflictSignal, entry: PrTrackingEntry): Promise<AutoResolveResult>
│   ├─ locateWorktree(entry) → worktree path or null
│   ├─ git fetch origin main
│   ├─ git rebase origin/main
│   ├─ 评估结果:
│   │   ├─ clean → git push --force-with-lease → { kind: 'resolved' }
│   │   ├─ ≤3 files → 尝试 git checkout --theirs → push → { kind: 'resolved' }
│   │   └─ complex → git rebase --abort → { kind: 'escalated', files: [...] }
│   └─ 每种结果都投递状态更新消息到 thread
└─ Tests: clean rebase / simple conflict / complex escalation / worktree not found
```

**集成点**: `ConflictCheckTaskSpec.execute()` — router 投递后调用 `autoExecutor.resolve()`，只有 escalated 时才 `invokeTrigger.trigger()`。

**安全护栏**:
- 只在 PR 对应的 feature worktree 中操作（通过 branch name 匹配）
- `--force-with-lease` 防覆盖他人 push
- 操作超时 30s（rebase 卡住 → abort + escalate）
- **绝对不碰 main/runtime worktree**

### Task 2: TriggerIntent 流水线

**改动文件**:
1. `ConnectorInvokeTrigger.ts` — `trigger()` 新增 `intent?: string` 参数
2. `AgentRouter.routeExecution()` — 接收 intent，传给 SystemPromptBuilder
3. `SystemPromptBuilder` — 当 intent 匹配 Skill 名称时，自动注入该 Skill 的指令到 system prompt

**约束**: intent 是 hint 不是 hard constraint——猫仍可根据上下文调整行为。

### Task 3: ReviewFeedbackTaskSpec intent 分流

**改动文件**: `ReviewFeedbackTaskSpec.ts` execute 和 `ReviewFeedbackRouter.ts`

当 `routeResult.kind === 'notified'`，根据 `signal.newDecisions` 中的 decision 类型确定 intent：
- 含 `CHANGES_REQUESTED` → intent = `'receive-review'`
- 含 `APPROVED` 且无 `CHANGES_REQUESTED` → intent = `'merge-gate'`
- 其他 → intent = `'review-reply'`

### Task 4: 结果反馈通知

**ConflictAutoExecutor 执行后**投递结果消息到 thread：
- 成功：`✅ 冲突已自动解决 — rebase clean, pushed to origin/{branch}`
- 部分成功：`✅ 冲突已自动解决（{n} 文件 auto-merge）— pushed`
- 升级：`⚠️ 复杂冲突需人工处理 — {files.join(', ')}`（此时才唤醒猫）

## Acceptance Criteria（更新 spec）

- [ ] AC-C1: 猫收到冲突通知后零人工干预自动 rebase + push（clean rebase 场景）
- [ ] AC-C2: 简单冲突（≤3 文件，non-binary）自动 resolve，复杂冲突通知铲屎官附冲突文件列表
- [ ] AC-C3: 猫收到 review feedback 后自动加载 receive-review 模式处理（CHANGES_REQUESTED 场景）
- [ ] AC-C4: TriggerIntent 流水线——intent 从 trigger → AgentRouter → SystemPromptBuilder 贯通
- [ ] AC-C5: ConflictAutoExecutor 测试覆盖：clean / simple-conflict / complex-escalation / worktree-not-found
- [ ] AC-C6: 安全护栏——只操作 feature worktree，绝不碰 main/runtime，操作超时 abort

## 风险

| 风险 | 缓解 |
|------|------|
| Worktree 定位失败（branch 名不匹配 PR） | fallback: 跳过 auto-resolve，走原有 hint 流程 |
| rebase 引入隐式 bug（test 没跑） | push 后下一轮 CI 会自动检测（F133 已覆盖） |
| `--force-with-lease` 被拒（他人同时 push） | 不重试，投递 "push 冲突" 消息 |
| Skill 自动注入可能与猫当前上下文冲突 | intent 是 hint not constraint，猫可覆盖 |
| 误操作 main/runtime worktree | 硬编码排除列表 + entry 中 branch 必须匹配 feat/* |

## 实现顺序

```
Task 1 (ConflictAutoExecutor) → Task 4 (结果反馈)
Task 2 (TriggerIntent) → Task 3 (Review intent 分流)
```

两条线可并行。建议先交付 Task 1+4（冲突自动 rebase 是铲屎官和社区最想要的），再交付 Task 2+3。

## 估算

- Task 1+4: ~150 行新代码 + ~100 行测试
- Task 2+3: ~80 行改动（跨 4 文件） + ~60 行测试
- 总量适中，一个 PR 交付
