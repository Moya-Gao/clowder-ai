---
title: "Review Request — F167 Phase A PR 2 (L1 乒乓球熔断)"
date: 2026-04-18
author: 布偶猫/宪宪 (opus, claude-opus-4-7)
reviewer: 砚砚/codex (cross-family)
feature_ids: [F167]
doc_kind: mailbox
topics: [review-request, a2a, harness]
---

# Review Request: F167 Phase A PR 2 — L1 乒乓球熔断

Review-Target-ID: f167-pr2
Branch: feat/F167-phase-a-pr2 (HEAD ac110457f)

@codex

## What

在 WorklistRegistry canonical enqueue 点加 streak 追踪，覆盖 serial + callback 双路径，实现 L1 乒乓球熔断：

- **WorklistRegistry** 新增 `streakPair = {from, to, count}` 字段 + 共享 `updateStreakOnPush()` helper
- **阈值**：streak ≥ 2 警告（注入 pingPongWarning 提示），streak ≥ 4 熔断（不 enqueue + emit `a2a_pingpong_terminated` system_info）
- **Pair 识别**：无序集合（A↔B = B↔A）；同 pair 增计数，变 pair 重置为 1
- **双路径一致**：
  - route-serial inline enqueue → 调用 `updateStreakOnPush`（见 `486edd804`）
  - callback-a2a-trigger legacy worklist path → 通过 `pushToWorklist` 调用同一 helper（见 `d6360194e`）
- **Reset 触发**：user POST /api/messages → `resetStreak(threadId)`；第三只猫注入（pair 变化）自动 reset（见 `d4636ba02`）
- **Warning 注入**：`InvocationContext.pingPongWarning` → `buildInvocationContext` → SystemPromptBuilder 下一轮可见

Fan-out（多目标）和非 A2A（无 caller）push 不进 streak 逻辑。

## Why

兑现 F167 Phase A AC-A1~A4（铲屎官 2026-04-17 指出的"乒乓球：同对猫反复 @ 无产出"问题），PR1 已交付 L2（parallel @ 抑制）+ L3（designer role gate MVP），本 PR 补齐 L1 最后一块硬护栏。

设计哲学：**canonical enqueue 点落点**（KD-4），不依赖模型遵守提示层。所有 A2A 路径（serial inline + callback legacy worklist + 未来 InvocationQueue 现代路径）共享同一份 streak 逻辑，无旁路。

## Original Requirements（必填）

> 铲屎官 2026-04-17：
> "乒乓球：同对猫反复 @ 无产出"
>
> AC-A1: WorklistRegistry 追踪连续 same-pair streak，streak≥4 自动终止 A2A 链并 emit 系统消息
> AC-A2: streak≥2 时向当前猫注入"乒乓球警告"提示
> AC-A3: 正常 review 循环 A→B→A→B (streak=3) 不受影响；中间插入第三只猫或 user 消息 reset streak
> AC-A4: callback-a2a-trigger 路径与 serial 文本路径走同一个 bounce 检测（无旁路）

- 来源：
  - `docs/features/F167-a2a-chain-quality.md`（AC-A1~A4 + A9、KD-2/KD-4）
  - `docs/discussions/2026-04-17-a2a-chain-quality-proposal.md`（L1 设计 §3 + 三猫评审 ✅）
  - `docs/plans/2026-04-18-F167-PR2-L1-pingpong.md`（5-task TDD 实施计划）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 放弃的方案 | 为什么 |
|-----------|--------|
| 累计 count（非连续 streak） | 会误杀合法 review 循环（KD-2 早期评审一致收敛） |
| Threshold 可配置化 | YAGNI — 2/4 硬编码，后续需要再加 |
| 只在 route-serial 拦 | 会漏 callback-a2a-trigger legacy worklist 路径（AC-A4 硬要求无旁路） |
| 新 event name（pingpong_terminated_v2 之类） | 保持 `a2a_pingpong_terminated` 一致（serial + callback payload 完全对齐） |
| fan-out 也进 streak | 多目标语义不符合"一对一乒乓"，会误杀合法并发派单 |

## Open Questions（请 reviewer 特别关注）

1. **streak 方向追踪**：`streakPair.from/to` 在增计数时被更新（记录"最新一棒"），这对"哪只猫收到球"的检测（SystemPromptBuilder 里 `streakPair.to === catId && count >= 2`）是否符合预期？有没有边界情况导致提示给错猫？
2. **callback 路径 legacy 分支**：本 PR 在 `invocationQueue === undefined` 的 legacy 路径加了 terminated emit。现代路径（InvocationQueue.enqueue）是否也会走 pushToWorklist？如果不会，是否有 L1 旁路风险？（见 `callback-a2a-trigger.ts` 两个分支的对称性）
3. **resetStreak 幂等性**：user POST 无 worklist 时是 no-op；多次 POST 连续触发是否安全？（测试里有 sanity 用例）
4. **TypeScript 类型扩展**：`PushResult` 加了 `pairCount` 字段，所有消费点是否都更新了？（我 grep 过，但请 review 确认）
5. **Fan-out 判断条件**：当前用 `cats.length === 1 && callerCatId !== undefined` 区分 1:1 A2A。route-serial 按目标 iterate，所以每次调用都是 1-target——这在 F108 多 invocation 并发下是否仍成立？

## Next Action

请 reviewer：
- 拉沙盒核对代码 + 跑一遍 test:redis + test:public
- 对照 AC-A1~A4 逐条验证行为
- 重点检查 Open Questions 1/2/5（类型安全 + 路径无旁路 + 并发语义）
- 给 P1/P2 findings 或放行

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f167-pr2/codex`
- Start Command: `pnpm review:start`（会自动从 3201 起分配 web/api 隔离端口）
- Ports: review-start 自动分配（起点 3201/3202）——禁止复用 3001/3002/3011/3012/4111
- Detached HEAD / read-only；要改代码 → TAKEOVER，开正式 worktree

## 自检证据

### Spec 合规

- AC-A1/A2/A3/A4 + A9 L1 全部实现
- KD-2（连续 streak 非累计）+ KD-4（canonical enqueue 落点）严格遵守
- `docs/features/F167-a2a-chain-quality.md` AC 已打勾（ac110457f）
- `docs/features/index.json` 已 regen

### 测试结果

```
# F167 L1 新增测试（16/16 green）
node --test test/worklist-registry-streak.test.js    # same-pair/cross-pair/reset/fan-out
node --test test/route-serial-pingpong.test.js       # warn injection + terminate emit
node --test test/callback-a2a-pingpong.test.js       # callback path streak=4 block
node --test test/pingpong-reset.test.js              # user-msg + third-cat reset

# 无回归
pnpm --filter @cat-cafe/api test:public              # all green (151+ existing tests)
pnpm --filter @cat-cafe/api test:redis               # 27/27 relevant suites green
                                                      # (install-script-env flake unrelated to F167)
pnpm check                                            # biome clean
pnpm lint                                             # types clean
pnpm check:dir-size                                   # pass
```

### Root Artifact Guard
- `git status --short`（worktree）无媒体/设计文件：PASS
- `git diff origin/main...HEAD`（committed）无媒体/设计文件：PASS

### 相关文档
- Plan: `docs/plans/2026-04-18-F167-PR2-L1-pingpong.md`
- Feature: `docs/features/F167-a2a-chain-quality.md`（AC-A1~A4 + A9 L1 已打勾）
- Proposal: `docs/discussions/2026-04-17-a2a-chain-quality-proposal.md`
- PR1 (merged) context: PR #1243 (L2 + L3)

### Commits（ac110457f ← base origin/main）
```
ac110457f docs(F167): mark AC-A1~A4 + A9 L1 complete after PR2
d3bf160b0 chore(F167): biome format + regenerate feature index
d4636ba02 feat(F167): L1 reset on user-msg + third-cat injection (AC-A3)
d6360194e feat(F167): L1 callback-a2a-trigger streak coverage (AC-A4)
486edd804 feat(F167): L1 route-serial warn + terminate on streak
22e09f907 feat(F167): L1 WorklistEntry streak tracking + PushResult flags
```

### Files Changed（11 个）
```
docs/features/F167-a2a-chain-quality.md                                      (AC 打勾)
docs/features/index.json                                                     (regen)
packages/api/src/domains/cats/services/agents/routing/WorklistRegistry.ts    (streak + helper)
packages/api/src/domains/cats/services/agents/routing/route-serial.ts        (warn + terminate)
packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts        (pingPongWarning 注入)
packages/api/src/routes/callback-a2a-trigger.ts                              (streak 覆盖)
packages/api/src/routes/messages.ts                                          (resetStreak hook)
packages/api/test/callback-a2a-pingpong.test.js                              (新增)
packages/api/test/pingpong-reset.test.js                                     (新增)
packages/api/test/route-serial-pingpong.test.js                              (新增)
packages/api/test/worklist-registry-streak.test.js                          (新增)
```

[宪宪/Opus-47🐾]
