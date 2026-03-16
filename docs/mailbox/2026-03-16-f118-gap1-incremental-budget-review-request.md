# Review Request: F118 GAP-1 — Incremental Context Budget Enforcement

## What

在 `assembleIncrementalContext()` 中新增三层预算守卫，防止猫猫首次被 @mention（cursor=undefined）或 stale cursor 时注入过多上下文导致溢出崩溃。

核心变更：
1. **第一刀（count cap）**: `relevant.slice(-maxMessages)` — 无条件 tail-cap
2. **第二刀（token budget）**: per-line token 预计算 + 从最旧消息线性扫描裁剪，直到总 token 数 ≤ `maxContextTokens`
3. **第三刀（degradation notice）**: `IncrementalContextResult.degradation` 字段 + `system_info` yield in route-serial & route-parallel

## Why

铲屎官在 F118 hardening review 中观察到：砚砚（@codex）首次被 @mention 进入 thread 时因注入完整 thread 历史导致 context window 溢出崩溃。`assembleIncrementalContext()` 在 `cursor=undefined` 或 stale 场景下没有任何总量守卫，`fetchAfterCursor()` 返回所有消息直接灌入上下文。

## Original Requirements（必填）

> 铲屎官："猫猫如果他之前没参与讨论，你突然喊他一下给他加入太多上下文直接挂了"
> 铲屎官："把这个做一下愿景守护，以及看看这个 feat 能不能 close"
> 铲屎官："可以按照我们的计划干活吧！"

- 来源：F118 GAP-1 section at `docs/features/F118-cli-liveness-watchdog.md` L230-275
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **不做摘要化**（如用 LLM 对历史做 summary）——复杂度过高，P0 阶段用 tail-cap + token trim 即可保证安全
- **per-line token 预计算替代 binary-search**——js-tiktoken 对大字符串 concat 有性能问题（180 条 × 5K chars 超时），改为逐行预计算 + 线性扫描，实测 ~285ms 可接受
- **degradation 用 `system_info` yield 而非新 block type**——简单复用现有机制，不引入新前端组件

## Open Questions

砚砚上轮 review 提了 3 个 blocking 条件，请验证我是否满足：

1. **`includesCurrentUserMessage`、`boundaryId`、头部条数都必须基于最终 capped/trimmed 集合来算** — 实现位于 route-helpers.ts L315-340，所有指标基于 `finalCapped` 重算
2. **`currentMessageFilteredOut` 仍然只表示"被 visibility 过滤掉"，不把 budget 截断塞进这个语义** — 实现位于 L296，在 cap 之前计算，语义保持 F35 whisper 保护
3. **测试覆盖三类：cursor=undefined、stale cursor 大批量、fallback 注入语义不回归** — 测试文件 `incremental-context-budget.test.js` 13 个场景

## Next Action

请 review 代码实现 + 测试覆盖。如果三个 blocking 条件满足，放行；否则标 P1 并指出具体问题。

## 自检证据

### Quality Gate Report

**Spec**: `docs/features/F118-cli-liveness-watchdog.md` (GAP-1 section L230-275)
**检查时间**: 2026-03-16

#### 愿景覆盖（Step 0）
| # | 铲屎官原始需求 | 实现？ |
|---|---------------|--------|
| 1 | "猫猫如果他之前没参与讨论，你突然喊他一下给他加入太多上下文直接挂了" | ✅ maxMessages tail-cap + token budget 双保险 |
| 2 | GAP-1 应修复 initial context injection 路径的溢出 | ✅ assembleIncrementalContext() 无条件守卫 |
| 3 | 猫猫应该知道上下文被截断了 | ✅ degradation notice via system_info |

#### 功能验收
| # | 要求 | 状态 | 代码位置 | 测试覆盖 |
|---|------|------|----------|----------|
| 1 | maxMessages tail-cap | ✅ | route-helpers.ts L302 | test #1, #2, #5 |
| 2 | Token budget guard | ✅ | route-helpers.ts L309-330 | test #11, #12, #13 |
| 3 | Degradation notice | ✅ | route-helpers.ts L332-349 | test #8, #9 |
| 4 | route-serial yield | ✅ | route-serial.ts ~L247-257 | — (integration) |
| 5 | route-parallel yield | ✅ | route-parallel.ts ~L195-205 | — (integration) |
| 6 | includesCurrentUserMessage based on capped set | ✅ | route-helpers.ts L315 | test #3, #4 |
| 7 | boundaryId based on capped set | ✅ | route-helpers.ts L340 | test #6 |
| 8 | currentMessageFilteredOut stays F35 semantics | ✅ | route-helpers.ts L296 | test #7 |
| 9 | cat-budgets.ts ADVISORY updated | ✅ | cat-budgets.ts L28-32 | — |

#### 设计稿对照（Step 5）
- glob `designs/**/*118*` → `F118-cli-liveness-warning-ui.pen` (Phase C 前端 UI, 与 GAP-1 后端改动无关)
- 对照状态: ➖ 无 UI 改动（纯后端逻辑）

#### Artifact Hygiene（Step 7.5）
仓库根目录未跟踪媒体文件: 无 ✅

### 测试结果

```
node --test packages/api/test/incremental-context-budget.test.js
  ✔ caps messages to maxMessages when cursor is undefined (first-time cat)
  ✔ caps messages when stale cursor produces large unseen batch
  ✔ includesCurrentUserMessage is based on capped set, not raw relevant
  ✔ includesCurrentUserMessage is false when current msg is in oldest capped-off portion
  ✔ does NOT truncate when message count is within budget
  ✔ boundaryId is the last message in capped set
  ✔ currentMessageFilteredOut reflects visibility filtering, not budget cap
  ✔ returns degradation info when messages are capped
  ✔ no degradation when within budget
  ✔ context header shows delivered count after cap
  ✔ token budget further trims messages beyond maxMessages cap
  ✔ token budget produces degradation when triggered
  ✔ token budget trims from oldest, keeping newest messages
  tests 13 | pass 13 | fail 0
```

```
pnpm lint → 0 errors (only pre-existing warnings in web package: img elements, hooks deps)
pnpm check (biome) → 29 errors ALL pre-existing in unrelated files
  GAP-1 files only: pnpm biome check [5 files] → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F118-cli-liveness-watchdog.md` (GAP-1 section)
- Branch: `feat/f118-gap1-incremental-budget`
- Commit: `d4f1ea13 fix(F118): enforce budget caps on incremental context delivery (GAP-1) [金渐层/Opus-46🐾]`

### Changed Files
```
packages/api/src/domains/cats/services/agents/routing/route-helpers.ts    — core GAP-1 logic
packages/api/src/domains/cats/services/agents/routing/route-serial.ts     — degradation yield
packages/api/src/domains/cats/services/agents/routing/route-parallel.ts   — degradation yield
packages/api/src/config/cat-budgets.ts                                     — ADVISORY comment
packages/api/test/incremental-context-budget.test.js                       — 13 test scenarios (NEW)
```
