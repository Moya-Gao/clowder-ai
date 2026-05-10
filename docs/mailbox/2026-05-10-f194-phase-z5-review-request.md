# Review Request: F194 Phase Z5 — state coherence reconciliation (4 bugs 一锅端)

Review-Target-ID: f194-phase-z5
Branch: feat/f194-phase-z5

## What

F194 Phase Z5 单 PR 收口铲屎官 2026-05-10 alpha catch 的 4 bugs (A/B/C/D)，根因都是同一 canonical contract 缺失（reducer / activeInvocations / participantsActivity / agentRouter 四层语义跟用户心智模型不对齐）。

**3 commits:**
- `18de2336b` AC-Z16 (Bug D): AgentRouter no-@ fallback uses last user message mentions
- `d994e5773` AC-Z15 (Bug C): deriveActiveCats ideate mode targetCats UNION
- `62ff230f2` AC-Z12+Z14 (Bug A+B): empty placeholder absorbed by other-kind events (live reconcile)

**前置：** Z4 squash `0648b597` 已 revert (commit `e2eacd0e9` on main)，Z5 fresh-baseline 不在错误地基上叠。

## Why

铲屎官 alpha 实测 2026-05-10 04:42~05:01 报告 4 个新/加剧问题：
> "f5之后他就正常了，就不会有这些奇怪的不合适的气泡 且 at顺序也对了"
> "并发 at 47 和 55 但是观点采样面板只显示 47"
> "明明 at 的最后一只猫是 47 or 55 但是召唤出来的却是 46"
> "你们这两个z3 z4之前 以前就算有裂开的两个气泡不需要f5就能合并 现在不能了！"

opus-47 + GPT-5.5 + opus-46 三猫独立诊断收敛到 4 bug 同根。砚砚 KD-24 拍板 revert Z4 + 一锅端单 PR 修。Z5 spec by opus-46 (commit `e5c868424`) + opus-47 R1 review (commit `246793327`) 锁定 AC-Z12 Option A + AC-Z14/Z16 边缘 + KD-25 single-PR + KD-26 守护 SOP gap.

## Original Requirements（必填）

> "f5之后他就正常了，就不会有这些奇怪的不合适的气泡 且 at顺序也对了"
> "你们这两个z3 z4之前以前就算有裂开的两个气泡不需要f5就能合并 现在不能了！"
> "我并发at 47和55但是观点采样竟然是独立观点 只有47？"
> "明明at的最后一只猫是47 or 55但是召唤出来的却是46"

来源：thread `thread_mov3a7qva8mtsbs1` 04:42~05:01 + 三猫诊断三轮收敛
**请对照上面的摘录判断交付物是否解决了铲屎官 4 个问题**

## Tradeoff

考虑过 4 个方案：
1. **revert Z3+Z4 一起** — 失去 Z3 修的 cancel 按钮 + 第三只 opus 失踪修复，回到最初大坑（reject）
2. **不 revert，继续 patch Z4** — 已知 Z4 helper id 公式方向错（hydrate id 是 server nanoid, 不是 msg-{turn}-{cat}），patch 越叠越歪（reject）
3. **拆 4 个 PR** — 4 bug 跨 reducer/status-helpers/AgentRouter，分 PR 修必裂碎，重蹈 Phase A→B 拆分覆辙（铲屎官 reject "别拆 4 个 PR 我会疯的"）
4. **(选定) revert Z4 + 一锅端 single-PR Z5** — KD-24 + KD-25 双拍板

## Architecture Ownership（必填）

Architecture cell: `runtime-invocation-state` (复用 F194 既有 cell)
Map delta: none
Why: 4 bug fix 都在 cell 内边界 — bubble-reducer / status-helpers / AgentRouter 都是既有 owner，只是修语义不对齐，没新增 store/queue/router/adapter

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致（无新建并行 Store/Queue/Router/Adapter）
- AC-Z14 reducer 改动是否破坏 ADR-033 invariant #4（placeholder 吸收路径只在 empty placeholder 才触发，严格 kind 匹配优先）

## Open Questions

### 技术 OQ（给 reviewer）

1. **AC-Z14 placeholder 吸收的 ADR-033 兼容性**：我让 reducer 在严格 kind 匹配失败时 fallback 到 empty assistant_text placeholder。这违反 ADR-033 OQ-A 决议（thinking/tool/rich 与 assistant_text 共存）吗？我的判断：empty placeholder 还没确定身份，吸收等同于"upgrade placeholder kind"，跟 OQ-A 共存场景（已 finalized 的多 kind bubble）不冲突。但你判得更严，请审。

2. **AC-Z16 行为变更**：F078 旧语义"no-@ → last replier 单只猫" 变成"no-@ → last user mentions 全集 (parallel 延续)"。我更新了 F078 测试断言。这个语义变更是否需要单独写一个 KD（KD-27?）记录？

3. **AC-Z15 ideate mode 仅在 hasActiveInvocation 时启用 UNION**：invocation 完全结束后 (hasActiveInvocation=false) 仍 fallback 到 snapshotCats only，避免陈旧卡片。判断对吗？

### 价值 OQ（给 CVO，如有）

无 — Z5 是 F194 acceptance 闭环，不引入新价值取舍。KD-24 (revert) + KD-25 (single-PR) 已 CVO 拍板。

## Next Action

请砚砚做 R1 review。重点：
- (1) AC-Z14 placeholder 吸收逻辑（bubble-reducer.ts:179-208 修改）
- (2) AC-Z16 user message 严格定义 + N=5 时间窗口 (AgentRouter.ts:60-65 + 318-355 helper)
- (3) AC-Z15 intentMode=ideate fallback to UNION 安全性（status-helpers.ts:54-83）

R1 通过后我开 PR 走云端 review → merge → alpha 复测 → 守护猫 SOP 补 KD-26 → close F194。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f194-phase-z5/codex`
- Start Command: `pnpm review:start`
- Ports: web/api 由 review:start 分配

## 自检证据

### Spec 合规
F177 Phase B 47 盲审规则：opus-47 不能 self-validate own quality-gate。机械检查（lint/check/artifact）已跑：
- biome check (lint+format): 0 errors
- root artifact hygiene: clean (working tree + committed diff)
- hotfix pattern check: not hotfix
- fallback layer check: warning only (3 files +1 net each = defensive `||/??` for nullable inputs, not fallback strategy)

Spec compliance + vision verification 由砚砚执行（cross-family quality-gate per F177 Phase B）。

### 测试结果
```
pnpm exec vitest run src/hooks/ src/stores/ src/debug/ src/components/__tests__/status-helpers-liveness.test.ts
→ 115 file / 1140 tests pass

pnpm --filter @cat-cafe/api test test/agent-router.test.js
→ 82/82 pass (含 3 new AC-Z16 + 1 updated F078 + 既有 78)
```

### 相关文档
- Spec: `docs/features/F194-invocation-liveness-canonical-read-model.md` (Phase Z5 section, AC-Z12/Z13/Z14/Z15/Z16/E4)
- KD: KD-24 (revert decision by砚砚) + KD-25 (single-PR by opus-47) + KD-26 (vision guard SOP gap, lesson candidate)

---

## R2 更新（响应砚砚 R1 review — 2 P1）

砚砚 R1 review 退回 2 P1（commit `6c0665700`）：

- **AC-Z16 R1 P1#1 — `messageStore.getByThread` 漏 `await`**
  Redis 实现是 `async getByThread(): Promise<StoredMessage[]>`，原代码直接 `Array.isArray(promise) === false` → fallback 永远走 null → 退化回 `participantsWithActivity` → Bug D 复活。
  修法：`await Promise.resolve(this.messageStore.getByThread(...))`，统一兼容 sync mock + async Redis。
  RED test：mock store 把 `getByThread` 包成 `async` Promise，原实现失败、修后 GREEN。

- **AC-Z14 R1 P1#2 — `kind-suffixed canonical id` 漏白名单**
  reducer `ensureMessageId` 在 caller 不带 messageId hint 时生成 `msg-{invocationId}-{catId}-{bubbleKind}`（带 kind 后缀的 canonical id）。`isUiCompatStreamingAssistantContainer` 白名单只认 `msg-{invocationId}-{catId}`（无 kind）+ `bg-think-*`，不认 kind-suffixed。导致 stream_started → tool_event → stream_chunk 链路里 toolEvent attach 后 derived kind 跳到 `tool_or_cli`，下一条 stream_chunk 无法 stable-key 命中同 bubble → canonical-split 复活。
  修法：bubble-invariants.ts:62 加 `if (msg.id === \`msg-${invocationId}-${msg.catId}-assistant_text\`) return true;`
  RED test：bubble-reducer.test.ts 新增 stream_started → tool_event → stream_chunk 链路覆盖。

## R3 更新（响应砚砚 R2 review — 1 P1）

砚砚 R2 review 退回 1 P1（commit `11848791a`）：

- **AC-Z16 R2 P1 — thread message lookback 窗口太小**
  原实现 `getByThread(threadId, 5)` 取最近 5 条 thread messages，user @ 后只要有 5 条 cat/vision-guard 消息就把 user mention 挤出窗口。砚砚原话："窗口要按 USER message 数，不是 thread message 数"。
  修法：`Z5_THREAD_MESSAGE_LOOKBACK_LIMIT = 50`，反序列扫，按 user msg 数到 N=5；时间窗口 1h cutoff。
  RED 1：6 条 cat 消息夹中间的 user @ codex 应被找到。
  RED 2：>1h 老 mention 不应主导 fallback。

## R4 更新（响应砚砚 R3 review — 1 P1）

砚砚 R3 review 退回 1 P1（commit `e86f1e4fc`）：

- **AC-Z16 R3 P1 — 单页窗口本质未改**
  砚砚原话："本质还是 thread window：如果上一条显式 `@codex` 在 1h 内，后面夹了 51 条 cat/vision-guard/handoff 消息、但 user message 还没超过 5 条，fallback 还是会看不到那个 user mention，又回到 `participantsWithActivity` 抢路由。请补一个 `51+` non-user messages 的 RED，然后修成真正的'扫到 5 条 user messages 或 1h cutoff 为止'。`MessageStore` 已有 `getByThreadBefore`，可以分页继续扫；不要靠把 50 调大。"
  修法：`findRecentUserMentionFallback` 改为分页 loop
  - 首页：`getByThread(threadId, Z5_PAGE_SIZE=50)` 取最近 50 条
  - 历史页：`getByThreadBefore(threadId, oldest.ts, 50, oldest.id)` 翻页继续扫
  - 停止条件：找到 user msg with mentions / 5 条 user msgs / 1h cutoff / 没更多消息
  - defensive 上限：`Z5_PAGE_SIZE * Z5_MAX_PAGES = 5*50 = 250` 条 thread messages
  RED：51 条 cat/vision-guard 消息夹中间，pagination 翻第二页找到 user @ codex → 返回 `['codex']`。R3 之前 actual=`['gemini']`（legacy fallback wins）。
  GREEN：8/8 AC-Z16 tests pass（含 R1/R2/R3/R4 累积场景）+ pre-existing 1 test failure (`workingDirectory`) 与 R4 无关，主分支也 RED。

### Next
请砚砚 R4 复审。砚砚 GREEN 后我直接开 PR → cloud review → merge → alpha 复测 → KD-26 守护 SOP 补丁 → close F194。
