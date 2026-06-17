# Codex live bubble split — root cause (race in live reducer)

> 2026-06-16 | 诊断: 宪宪/Opus-48 | F194 post-close regression（codex 气泡裂 saga 第 17 轮的**根因记录**）
> 状态: **root cause confirmed, fix not yet implemented**

## 症状（铲屎官 runtime catch）

codex（砚砚, gpt-5.5, `codex exec` CLI）的一个 turn 在 **live** 渲染时裂成两个气泡：
[正文泡（含 cost footer）] + [下面一个**只有 tool call** 的额外气泡]。**F5 / 硬刷新后合并成一个**。

- **codex 裂的概率 >> gpt52**（缅因猫 GPT-5.4）
- **不是必现**（intermittent → 竞态，非确定性）

## 确认的事实（真实 runtime 数据，非推断）

1. **持久化数据正确，零裂**。OKF thread (`thread_mqg40i0bgpahdh9s`) 最新 codex 消息持久化是
   **单条 record**：`turnInvocationId=1ba442cb-b245-...`、textLen=1362、**nTools=4**、origin=stream。
   另一 thread (`thread_mqevrpipz1prrvh3`) 全部 codex turn 同样是每 turn 一条 record、turnInvocationId 正常 stamp、
   **无任何同-turnInvocationId 的多 record**。→ 后端 + Z9 turn-id stamp 对持久化记录有效。
2. **F5 / hydration 正确合并**。`useChatHistory.ts` 的 hydration 投影按 turnInvocationId 确定性分组，
   读持久化单 record → 一个气泡。这正是"F5 后合并"。
3. **裂 100% 是 live reducer 产物**（`useAgentMessages.ts`）。同一个 turn（持久化为一条 record）
   被 live 增量 reducer 拆成两个气泡。

## 根因

codex CLI（`codex-event-transform.ts`）的 stream 事件（tool_use / 工作日志 / text）与
`invocation_created` 事件（携带 per-turn `turnInvocationId`，`invoke-single-cat.ts:646`）之间存在
**竞态**：当 tool stream 先于 invocation_created 到达前端时，live reducer 先用 **parent invocationId**
建了一个 tool-only 气泡；等 turn-id 到达，`finalizeStaleBackgroundInvocationStreams`
(`useAgentMessages.ts` line 636-676) 的 **6 条件绑定启发式**判定该不该把 parent-only 泡升级进当前 turn。
启发式没绑上时 → `setThreadMessageStreaming(false)` + `markReplacedInvocation` → **裂**（注释原文:
"Finalizing it here ... is exactly what splits the work-log bubble from the later turn text"）。

- **为什么 codex >> gpt52**：codex CLI 先吐工具/工作日志 stream，turn-id 后到 → 高频踩竞态窗口；
  gpt52 流式顺序不同，很少踩。
- **为什么不是必现**：tool stream 与 invocation_created 异步赛跑，turn-id 有时及时到（不裂）、有时晚到（裂）。

## 为什么 16 轮没修好 + #2319 也没用

每轮（Z1-Z13 / #1716 / #2304 / #2319）都在**给启发式加条件**或**修 hydration 侧 residue**。
但 (a) hydration 侧本来就对（F5 合并是证据），(b) live 侧的根因是**竞态下用 parent-id 先建泡再猜归属**，
加第 N 个时序条件只能堵某一种 race，下一种又漏。**#2319 改的是 `useChatHistory.ts`（hydration），
完全是错的层** —— 那条路没裂。

## 修复方向（结构性，不是第 17 个启发式条件）

**坐标系问题**：live 增量 reducer 在猜 bubble 归属，而持久化投影（hydration 用的）是确定性的、正确的。
两个候选（需 trace `codex-event-transform` + `invoke-single-cat:646` 的实际排序后定）：

- **A. 后端串行化**：保证 codex 的 `invocation_created`（turn-id）在**首个 tool stream 之前** flush 到前端，
  消灭 parent-only 窗口，从源头对齐 gpt52。竞态根除。
- **B. 前端收敛**：让 live reducer 复用 hydration 的确定性投影（按 turnInvocationId 分组），
  不再靠 parent-id 先建泡 + 时序启发式。

A 治本（消灭竞态）但要改后端流式；B 让两条路径共享一套投影（Z8 unified projection 的初衷未竟）。
**动手前必须 trace 实际事件排序定哪条，并与砚砚（codex 流式 + 这段 reducer 的 author）对齐**——
saga 16 轮都栽在"不对齐方法就直接 patch"。

## Evidence 锚点

- 裂泡形态截图: 铲屎官 2026-06-16 OKF thread + thread_mqevrpipz1prrvh3
- live reducer 启发式: `packages/web/src/hooks/useAgentMessages.ts:636-680`
- turn-id 发射: `packages/api/.../invocation/invoke-single-cat.ts:646`
- codex 流式转换: `packages/api/.../providers/codex-event-transform.ts`
- hydration 正确投影: `packages/web/src/hooks/useChatHistory.ts`（#2319 改在这里 = 错层）
