---
feature_ids: [F197]
related_features: [F188, F102, F149]
topics: [acp, transport, providers, telemetry, recall-sidebar]
doc_kind: spec
created: 2026-05-11
---

# F197: ACP Provider tool_result Event Surfacing — Gemini ACP path 单事件拆成 tool_use+tool_result 双消息

> **Status**: spec | **Owner**: 布偶猫/Opus-47 | **Priority**: P1

## Why

F188 Phase F 上线 LIVE Recall sidebar 后铲屎官发现：ACP 路径下（Claude Code CLI via ACP）的 search_evidence 调用，UI 卡片只显示 query/mode/scope/time，**永远不显示 `[N hits]` 也永远展开不出 results**。其它 provider（catagent 直连 Anthropic / Codex）显示正常。

铲屎官原话（2026-05-11 跟 47 dogfooding F188 Phase F 时）：
> "为啥我这里看到的是你啥也没生效？是没搜到吗？"
> "截图里 你看到第一个嘛？有 hit 才能展开！然后剩下的 都不行 你说我没展开是错的我就是展开了啥也没看到才以为你什么都没搜到的"

**ACP scope（砚砚 一审 P1-1 校正）**：当前 repo 里 ACP 只服务 **Gemini**（`packages/api/src/index.ts:990` 只在 `clientId: google` 分支 instantiate `GeminiAcpAdapter`）。Opus-47 / Codex 走 Anthropic API 直连 (catagent) 不走 ACP。所以本 fix 影响的是**烁烁/Gemini 在 ACP 路径下**的 Recall sidecar + FM-5 metric，不是 47/砚砚。

**根因（砚砚 一审 P1-2 校正）**：`packages/api/src/domains/cats/services/agents/providers/acp/acp-event-transformer.ts:83-112` 把 ACP 的两个 sessionUpdate 都转成 `type: 'tool_use'`。但 Gemini CLI v0.36 **实际 production format** 是单事件 `sessionUpdate: 'tool_call'` + `status: 'completed'` + `title` + result `content` 一打包（见 `packages/api/test/acp/acp-event-transformer.test.js:93-110` fixture）。`tool_call_update` 只是部分场景。

```typescript
case 'tool_call': {              // 现状：Gemini 把 completed+content 也走这条
  return { type: 'tool_use', catId, toolName, toolInput, ... };  // ← 漏了 result-side
}
case 'tool_call_update': {       // 现状：部分场景的 progress/final update
  return { type: 'tool_use', catId, toolName, content: content?.text, ... };  // ← 漏了 tool_result emit
}
```

**单事件拆双消息约束（砚砚 一审 P1-3）**：UI `useRecallEvents.filterRecallEvents` 的 pairing 模型先靠 `tool_use` 建 pending、再靠 `tool_result` 配对（`useRecallEvents.ts:235`）。ToolEventLog 也先 `append(tool_use)` 再 `updateSummary(tool_result)`（`route-serial.ts:844`、`route-parallel.ts:591/644`）。Gemini 单事件 `tool_call[completed+content]` 必须 transformer 内部拆成 **两条 AgentMessage stream message**（先 `tool_use` 建 pending，再 `tool_result` 配 pair），否则即使转对了 result 类型，前面没 pending → UI 仍不亮 `[N hits]`、ToolEventLog 也 append 不到事件。

**后果**：
- LIVE Recall sidecar：Gemini-on-ACP 路径 cards 显示但永远 unpaired
- F188 Phase F FM-5 nudge-followup metric：Gemini-on-ACP thread 拿不到 result summary，算不出来

不是 F188 Phase F 引入，是 ACP transformer 老 bug，F188 Phase F 把 Recall sidecar / FM-5 推上前台后暴露。F149 (Gemini ACP Adapter) 不是"潜在同病"，是**当前同一 transformer**——本 fix scope 直接覆盖 F149 path。

## What

### Phase A: ACP transformer 单事件 + 双事件路径都正确 emit tool_use+tool_result

**核心约束（砚砚 一审 P1-3）**：UI / ToolEventLog 都基于 `tool_use → tool_result` pair 模型。Gemini-on-ACP 路径要让 `[N hits]` 亮 + FM-5 算出来，transformer 必须保证**每个 tool 完整生命周期至少 emit 一对 `tool_use` + `tool_result`**。

**判定矩阵**（基于 ACP sessionUpdate kind + `status` 字段；status 字段名以 ACP protocol 实际为准，已知 `completed`/`failed`/`in_progress`）：

| ACP 事件形状 | transformer 行为 |
|---|---|
| `tool_call`（无 status，或 status=`in_progress`/`pending`） | emit `tool_use`（保持现状）|
| `tool_call` + status=`completed`/`failed` + content（**Gemini v0.36 实际格式**） | emit **两条** AgentMessage：先 `tool_use`（toolName + toolInput），再 `tool_result`（content）|
| `tool_call_update` + status=`in_progress`/未完成 + 中间 content | emit `tool_use`（progress streaming，保留现状）|
| `tool_call_update` + status=`completed`/`failed` + 最终 content | emit `tool_result`（前面已有 pending `tool_use` from 初始 `tool_call`，这里只发 result 即可）|
| 兜底：同 toolCallId 已 emit 过 `tool_use`，又收到 content 非空但无 status 的 update | 视为 final → emit `tool_result` |
| 兜底：同 toolCallId 从未 emit `tool_use`，直接来 content 完整的 update | 拆成两条：先补 `tool_use`，再 `tool_result`（避免 orphan tool_result）|

**实现要点**：
- Transformer 内部维护 `toolCallId → { emittedToolUse: boolean, lastStatus: string }` Map（per-session 即可，session 结束清理）
- "拆双消息"通过 generator 或 `Array<AgentMessage>` 返回支持——当前 `transformAcpEvent()` 返回单个 AgentMessage，需要扩展为可返回 `AgentMessage | AgentMessage[]` 或改为 generator
- 测试 fixture `tool_call with "title" field (Gemini CLI v0.36 actual format)` 必须更新：当前断言只期望 `result.type === 'tool_use'`，修复后该 fixture 应 emit 两条 message

## Acceptance Criteria

### Phase A（ACP transformer 修复 + 测试）
- [ ] AC-A1: `acp-event-transformer.ts` 的 `tool_call` case 按 status 分流：无 status / `in_progress` / `pending` → 仅 emit `tool_use`；`completed` / `failed` + content → emit **两条 AgentMessage**（先 `tool_use`，再 `tool_result`）
- [ ] AC-A2: `acp-event-transformer.ts` 的 `tool_call_update` case 按 status 分流：`in_progress` 或中间 content → emit `tool_use`（progress streaming）；`completed`/`failed` + 最终 content → emit `tool_result`（前面已由初始 `tool_call` 建过 pending tool_use，此处仅补 result）
- [ ] AC-A3: 兜底逻辑——同 toolCallId 已 emit 过 `tool_use` 又收到 content 非空但无 status 的 update → 视为 final → emit `tool_result`；从未 emit 过 `tool_use` 直接来完整 content → 拆双消息（先补 `tool_use` 再 `tool_result`，避免 orphan result）
- [ ] AC-A4: Transformer 签名扩展：`transformAcpEvent` 返回从 `AgentMessage | null` 改为 `AgentMessage | AgentMessage[] | null`（或改为 generator）；所有 caller 更新处理多 message
- [ ] AC-A5: 单元测试覆盖 6 场景：(a) tool_call(no status) → 1×tool_use (b) **tool_call(completed+content) → 2×message** (Gemini v0.36 实际格式) (c) tool_call_update(in_progress) → tool_use (d) tool_call_update(completed) → tool_result (e) toolCallId 第一次出现就是 update(completed) 没前置 tool_call → 拆双消息 (f) failed status 同 completed 路径走 tool_result
- [ ] AC-A6: 更新现有 `acp-event-transformer.test.js:93-110` Gemini v0.36 fixture 断言：从期望单 `tool_use` 改为期望 `[tool_use, tool_result]` 两条
- [ ] AC-A7: 现有 `recall-feed.test.ts` 加 1 个 ACP-shape fixture：通过 transformer 输入 → useRecallEvents 输出 → 验证 RecallEvent.resultCount 被正确 pair
- [ ] AC-A8: F188 Phase F FM-5 indirect 验证——构造 ACP-only thread fixture 跑 ToolUsageMetricsAggregator，**memory-class tool 的 FM-5 denominator > 0** 且能算出 non-NaN 值（denominator 限定到有 final content 的 memory tools，不把 ACP hang/timeout 兜进去——砚砚 一审 OQ-3 修正）
- [ ] AC-A9: 修完后实际验证：本地 alpha 起来，烁烁/Gemini 在 ACP 路径下跑 search_evidence / list_recent，Recall sidebar 卡片显示 `[N hits]` + 可展开看 results

## Architecture Ownership

Architecture cell: `cats/services/agents/providers/acp` (F149 Phase B 之前确立的 cell)
Map delta: **none** — 只修 cell 内的 transformer 逻辑，不改 ownership / boundary / extension point
Why: 这是 cell 内部行为修复（ACP sessionUpdate kind → AgentMessage type 映射），不引入新概念，不改 cell 跟下游 (route-serial / route-parallel / useRecallEvents) 的契约

## Eval / Tracking Contract

> 触发条件：修改了 provider 行为，间接影响 F188 Phase F FM-5 / FM-2 metric 路径，**且涉及猫的 UI 可观察性**——所以填。

### 1. Primary Users + Activation Signal

- **Users**：
  - 烁烁/Gemini（当前唯一跑在 ACP path 的猫——`index.ts:990` 只在 `clientId: google` 分支 instantiate `GeminiAcpAdapter`）
  - 铲屎官（Recall sidebar 用户）
  - F188 Phase F FM-5 / FM-2 metric 消费者（Memory Health Dashboard）
- **Activation signal**：
  - AS-1：Gemini-on-ACP 路径下 search_evidence 调用，UI Recall sidecar 卡片显示 `[N hits]`（>0）
  - AS-2：Gemini-on-ACP 路径下 ToolEventLog 接到的 search_evidence event 在 `updateSummary()` 后含 `resultCount` / `nudgeEmitted` 字段（之前一直 undefined）

### 2. Friction Metric

- **FM-1**：Gemini-on-ACP 路径下 Recall sidecar paired ratio — 期望 ≥ 95%（denominator 限定到**含 final content** 的 memory-class tool 调用，不把 hang/timeout 兜进去）
- **FM-2**：ToolEventLog 中 ACP 路径 search_evidence event 的 `_resultMerged === true` 比例 — 期望 ≥ 95%（denominator 同 FM-1）
- **FM-3**：F188 Phase F FM-5 nudge-failure-rate 在 ACP-only thread 上算出 non-NaN 值（之前 ACP-only thread 永远 NaN；denominator 同 FM-1）

### 3. Regression Fixture

- `acp-tool-call-update-only-tool-use` → 修复前 fixture：transformer 把 `tool_call_update` 转成 `tool_use`；修复后 `tool_result`
- `acp-multi-update-final-wins` → 同一 toolCallId 多个 update，只最后一个 status=completed 的转 tool_result
- `recall-feed-acp-fixture` → useRecallEvents 接 transformer 输出，能 pair 出 resultCount
- `fm5-acp-thread-end-to-end` → 用 ACP-only thread 跑 ToolUsageMetricsAggregator，FM-5 出 non-NaN

### 4. Sunset Signal

- 当 ACP protocol 演进出 explicit `tool_result` sessionUpdate kind 时（如 ACP 1.x），transformer 可以从"按 status 分流"简化为"按 kind 直接映射"
- 当 cat-cafe 内部统一 AgentMessage schema 把 `tool_use`/`tool_result` 合并为单一 lifecycle event（如带 phase: 'started'/'completed'）时，本 fix 的分流逻辑可整体下线

## In-context Observability Decision

- **primary_surface**: ACP path 的 Recall sidebar `[N hits]` badge + ToolEventLog 写入 Dashboard panel
- **why_not_dashboard_only**: Dashboard 是事后审计 (~30min latency)；猫现场决定下一步是否要换入口、要不要 follow nudge，必须现场知道刚才搜了多少东西 → primary 是 sidebar
- **deep_dive_surface**: Memory Health Dashboard ToolUsageMetricsPanel（聚合 N>20 thread 的 FM 数据）
- **noise_dedup_policy**: progress `tool_call_update` 不触发 sidecar 重渲染（保留现有 streaming UI），只 final 触发 pair

## Dependencies

- **Related**: F188（Phase F 暴露了这个 bug；fix 后 FM-5 在 Gemini-on-ACP 路径下能算）
- **Related**: F149（Gemini ACP Adapter — **当前 ACP path 唯一使用者**，本 fix 直接修这个 path 的 transformer，**不是潜在同病而是同一份代码**——砚砚 一审 OQ-2 校正）
- **Related**: F102（Recall sidebar 是 F102 Phase J 产物，本 fix 修它的 pairing 数据源）

## Risk

| 风险 | 缓解 |
|------|------|
| Gemini CLI v0.36 `tool_call(completed+content)` 单事件拆双消息，下游 caller 处理多 message 的 backpressure / 顺序 | `transformAcpEvent` 改为返回数组或 generator；caller 按顺序 yield；测试覆盖"先 tool_use 后 tool_result"消费者 invariant |
| `status` 字段命名 ACP 多版本差异（已知 Gemini v0.36 用 `status`） | 测试覆盖 v0.36 真实 fixture + 留兜底 "无 status 但有 content 视为 final" |
| 同 toolCallId 多个 update 引起 pairing 错乱 / 重复 emit | transformer 维护 per-session `toolCallId → emittedToolUse` Map；同 toolCallId 不重复 emit tool_use |
| 改动破坏现有 progress streaming UI（in_progress update 当前转 tool_use 含 content） | AC-A2 显式保留 in_progress → tool_use；测试 fixture 锁住 |
| ACP 服务端漏发 final update / tool 永久 in_progress（hang） | FM denominator 限定 "含 final content" 调用，hang 不影响指标；监控 hang ratio 作为单独 quality signal（非本 fix scope）|

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | ACP sessionUpdate 的 `inner.status` 字段名 | ✅ 已知 — Gemini CLI v0.36 用 `status`，值 `completed` / `failed` / `in_progress` / `pending`（acp-event-transformer.test.js:93-110 fixture）|
| OQ-2 | F149 Gemini ACP 与本 fix 关系 | ✅ 已确认 — **同一份 transformer**，本 fix 直接覆盖 F149 path（不分 Phase B）|
| OQ-3 | progress vs final 判定，仅靠 status 还是要 timeout fallback？ | ✅ 已收敛 — 仅靠 status；hang 不影响 FM（denominator 限定到含 final content）；hang ratio 作为单独 quality signal 监控（非本 fix scope）|
| OQ-4 | `transformAcpEvent` 返回值改 array / generator 哪种 caller 改动更小？ | ⬜ 待 wktree 时读 caller (`AcpClient.ts` / `AcpProcessPool.ts`) 实测决定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 走完整 spec + Design Gate 流程，不当 quick hotfix 偷渡 | 铲屎官原话「按家规先把 spec 写好 commit push 然后和砚砚确定清楚之后再开 wktree」；这个 bug 影响 F188/F102/F149 的 telemetry / observability path，必须 reviewer 把关 | 2026-05-11 |
| KD-2 | scope = Gemini-on-ACP path（当前 ACP 唯一使用者） | 砚砚 一审 P1-1 校正：repo 里 ACP 只在 `clientId: google` 分支 instantiate `GeminiAcpAdapter`；不是 Claude Code ACP（不存在）。本 fix 直接覆盖 F149 path，不拆 Phase B | 2026-05-11 |
| KD-3 | 单事件拆双消息（先 `tool_use` 后 `tool_result`） | 砚砚 一审 P1-3：UI / ToolEventLog 都基于 pending+pair 模型；Gemini v0.36 实际 format 把 completed+content 打包到 `tool_call`，transformer 必须在内部拆成两条 stream message 保证 pair 模型成立 | 2026-05-11 |
| KD-4 | `transformAcpEvent` 返回值从 `AgentMessage \| null` 扩展为 `AgentMessage \| AgentMessage[] \| null` | 拆双消息的实现必需；array vs generator 的 caller 改动量评估留到 wktree 时实测（OQ-4） | 2026-05-11 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-11 | F188 Phase F 上线后铲屎官 dogfooding 发现 Recall sidecar 不显示 hits；47 诊断到根因 = ACP transformer 漏 emit tool_result；铲屎官 push back 走 spec 流程，本 spec 立项 |
| 2026-05-11 | 砚砚 一审 Design Gate review 退回 P1×3：(P1-1) ACP scope 写错（实际只服务 Gemini，不是 Claude Code）(P1-2) 漏覆盖 Gemini v0.36 单事件实际格式 (P1-3) 单事件必须拆双消息以满足 pending+pair 模型。47 全部 ack，AC 重写 9 条，新增 KD-2/3/4，待砚砚 二审 |

## Review Gate

- 后端类（provider event transformer）— 走 `collaborative-thinking` + @ 砚砚 review spec → wktree → 实现 → 跨猫 review

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F188-library-stewardship.md` | 暴露问题的 feature |
| **Feature** | `docs/features/F102-memory-system.md` | Recall sidecar (Phase J) 的归属 feature |
| **Feature** | `docs/features/F149-runtime-routing-extensibility.md` | Gemini ACP adapter（潜在同病） |
| **Code** | `packages/api/src/domains/cats/services/agents/providers/acp/acp-event-transformer.ts` | 待修文件 |
| **Code** | `packages/web/src/hooks/useRecallEvents.ts` | 消费 tool_result 事件的 UI hook |
| **Test** | `packages/web/src/__tests__/recall-feed.test.ts` | Recall pairing 测试 |
