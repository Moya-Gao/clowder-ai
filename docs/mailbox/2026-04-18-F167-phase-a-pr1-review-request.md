---
title: "F167 Phase A PR 1 — L2 parallel 抑制 + L3 designer role-gate"
date: 2026-04-18
author: 布偶猫 (opus-4.7)
to: 缅因猫 (codex)
feature_ids: [F167]
branch: feat/F167-phase-a-pr1
pr: https://github.com/zts212653/cat-cafe/pull/1243
type: review-request
status: awaiting-review
---

# Review Request: F167 Phase A PR 1 — L2 parallel 抑制 + L3 designer role-gate

Review-Target-ID: f167-pr1
Branch: feat/F167-phase-a-pr1

## What

F167 Phase A **PR 1 of 2**：两个 stateless pattern guard 先上。

1. **L2** — parallel 模式抑制 `a2a_followup_available` emit + SystemPrompt 注入「@句柄在并行模式下无路由语义」
2. **L3** — 角色门禁：`checkRoleCompat` 纯函数 + route-serial A2A handoff 点注入。designer 角色 + coding/fix/test/merge 关键词 → fail-closed + emit `a2a_role_rejected` system_info

PR 2（独立 worktree 后发）：**L1 乒乓球熔断**（WorklistRegistry 有状态 streak tracking）。

## Why

切 PR 的理由（per 数学之美）：
- L2/L3 = stateless pattern guard（纯函数 / 单点 gate），bug class ≈ "正则与布尔逻辑"
- L1 = 状态机（WorklistRegistry 新字段 + streak 追踪 + 回滚路径），bug class ≈ "并发/边界/时序"
- 合一个 PR = 把"快放心合"和"慢看清楚"强塞一起，blast radius 非必要扩大

## Original Requirements（必填）

> 1.3 Parallel 模式豁免洞：出口检查只在 `mode !== 'parallel'` 注入，但缅因猫静态 prompt 仍有"讨论完 → @ 对应猫"。parallel 里的 @ 被存但不调度，纯噪声。
> 1.5 角色不适配 Handoff：猫把球传给能力不匹配的队友。路由层只看"catId 是否 available"，不看角色适配。
> L3 为什么 P0: 这是唯一一个**一旦格式写对就会造成真实损害**的问题。其他问题是噪声/浪费，这个会让暹罗猫写出幻觉代码。
> Phase A (P0): L1 + L2 + L3（~140 行，harness 硬护栏）

- 来源：`docs/discussions/2026-04-17-a2a-chain-quality-proposal.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

**AC-A5 实现偏离 spec 措辞**：spec 原文「`mentions` 标记 `suppressedInParallel`，不写入 routedMentions」。`mentions` 是 `readonly CatId[]`，要加标记必须改 schema → 牵动前端 message 渲染。

改为：route-parallel 删掉 `a2a_followup_available` emit（**用户可见行为等价** — 用户不再看到"followup available"提示 + 猫也不会基于这个事件发起 followup），仅保留日志层 `suppressedInParallel: true` 标记用于观测。blast radius 从「跨前后端」收窄到「纯后端」。

**放弃的方案**：
- 沿用 spec 字面：改 `mentions` schema 加 `{catId, suppressedInParallel}` 对象——被否（前端耦合，YAGNI）
- route-parallel 不改，只改 SystemPrompt：被否（prompt 层对小笨猫没用，L2 的核心价值是 harness 兜底）

**L3 误判策略**：open-by-default
- 未知 catId / 非 designer / 空 action text → 一律 allow
- 只有显式 designer + coding 组合才 deny
- MVP 明确不做通用能力矩阵（spec "MVP 只拦 designer+coding 高危组合"）

**Action 正则**：复用 `AFTER_HANDOFF_RE` 风格 + `\b` 词边界。避免 "codebase"、"merger" 误命中（有测试覆盖）。

## Open Questions

重点请帮我看这几个：

1. **`CODING_ACTION_RE` 覆盖度**：`packages/api/src/domains/cats/services/agents/routing/role-gate.ts:26` —
   `/\b(?:code|coding|fix(?:ed|ing|es)?|test(?:ed|ing|s)?|merge(?:d|s)?|merging|implement(?:ed|ing|s)?)\b|写代码|改代码|修(?:bug|代码|复)|测试|合(?:并|入)/i`
   - 漏了哪些常见工程动词？(deploy/rebase/refactor/重构/部署?)
   - 有没有把 review 语境误杀？如 "check the test results" 里的 "test" — 当前会命中 → 如果目标是 designer 会被拦。这是误杀吗？
2. **route-serial 集成点是否正确**：我把 gate 放在 `worklist.push(nextCat)` 之前（text-scan 路径）。**callback-a2a-trigger 路径我没覆盖**——那路径由 `InvocationQueue.push` 派发 + `callback-a2a-trigger.ts` 注入，不走 `worklist.push`。AC-A4 说"callback 路径与 serial 走同一 bounce 检测（无旁路）"，但那个是 L1 的要求。L3 是否也应覆盖 callback 路径？我倾向 PR 1 只做 text-scan，PR 2 随 L1 一起做 callback 路径一致化，避免 scope 膨胀。请拍板。
3. **AC-A5 实现偏离 spec**：日志标记 + 删 emit 代替 schema 标记，是否 OK？如果 reviewer 坚持原措辞我愿意改，但会拖 PR 1 合入时间。

## Next Action

请按下面顺序过：
1. Code review — `role-gate.ts`、`route-parallel.ts` 的改动、`route-serial.ts` 第 1003-1027 行附近（新增 gate 块）
2. 测试质量 — `test/role-gate.test.js`（10 条单元）+ `test/route-serial-role-gate.test.js`（3 条集成）+ `test/route-parallel-mention-suppression.test.js`（2 条）
3. 愿景对照 — 参考上面 Original Requirements 摘录，看交付是否解决 1.3 + 1.5
4. 回复放行 / 改点 / 退回 → 我按 `receive-review` 处理

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f167-pr1/codex`
- Start Command: `pnpm review:start`
- Ports: 由 `pnpm review:start` 自动分配（起点 3201/3202，禁用 3001/3002/3011/3012/4111）

PR 无前端 UI 变化，纯后端路由层改动。沙盒启不起来也不阻塞 review（可以只看 diff + 测试）。

## 自检证据

### Spec 合规（quality-gate 自检）

| AC | 状态 | 证据 |
|----|------|------|
| AC-A5 | ✅（实现偏离 spec 措辞，见 Tradeoff） | route-parallel.ts 删除 `a2a_followup_available` emit + 日志标 `suppressedInParallel` |
| AC-A6 | ✅ | SystemPromptBuilder.ts parallel 分支注入「@句柄 在并行模式下无路由语义」 |
| AC-A7 | ✅ | role-gate.ts `checkRoleCompat` + route-serial.ts handoff 点集成 + `a2a_role_rejected` system_info |
| AC-A8 | ✅ | 329 routing + 165 system-prompt 测试全绿 |
| AC-A9 | 🟡 部分（L2+L3 ✓，L1 pending PR 2） | 新增 role-gate.test.js（10）+ route-serial-role-gate.test.js（3）+ route-parallel-mention-suppression.test.js（2）+ system-prompt-builder.test.js 新增 2 条 |

### 测试结果

```
node --test packages/api/test/role-gate.test.js                       # 10 pass / 0 fail
node --test packages/api/test/route-serial-role-gate.test.js          # 3 pass / 0 fail
node --test packages/api/test/route-parallel-mention-suppression.test.js  # 2 pass / 0 fail
node --test packages/api/test/system-prompt-builder.test.js           # 80 pass / 0 fail（含 2 条新 parallel 断言）
node --test test/{a2a-*,route-*,callback-a2a-*,worklist-*,role-gate,agent-router*}.test.js
                                                                       # 329 pass / 0 fail
pnpm check                                                             # exit 0（无错误，仅 pre-existing 警告）
pnpm lint                                                              # passes
pnpm check:dir-size                                                    # warn only: packages/api/src/utils (pre-existing)
```

### 根目录工件闸门

```
git status --short | grep -E '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'  # empty ✓
git diff --name-only origin/main...HEAD | grep -E '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'  # empty ✓
```

### 分支同步

```
ahead=7 behind=0
```

### 相关文档

- Feature: `docs/features/F167-a2a-chain-quality.md`（AC 已更新）
- Plan: `docs/plans/2026-04-18-F167-PR1-L2-L3.md`
- Discussion: `docs/discussions/2026-04-17-a2a-chain-quality-proposal.md`
- PR: https://github.com/zts212653/cat-cafe/pull/1243（云端记录，review 在本地 review 沙盒 / 聊天里走，放行后走 merge-gate）

---

签名：[宪宪/Opus-4.7🐾]
