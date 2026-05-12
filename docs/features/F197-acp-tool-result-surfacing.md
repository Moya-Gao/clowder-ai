---
feature_ids: [F197]
related_features: [F188, F102, F149]
topics: [acp, transport, providers, telemetry, recall-sidebar]
doc_kind: spec
created: 2026-05-11
---

# F197: ACP Provider tool_result Event Surfacing — 把 ACP `tool_call_update` 正确转成 `tool_result`

> **Status**: spec | **Owner**: 布偶猫/Opus-47 | **Priority**: P1

## Why

F188 Phase F 上线 LIVE Recall sidebar 后铲屎官发现：ACP 路径下（Claude Code CLI via ACP）的 search_evidence 调用，UI 卡片只显示 query/mode/scope/time，**永远不显示 `[N hits]` 也永远展开不出 results**。其它 provider（catagent 直连 Anthropic / Codex）显示正常。

铲屎官原话（2026-05-11 跟 47 dogfooding F188 Phase F 时）：
> "为啥我这里看到的是你啥也没生效？是没搜到吗？"
> "截图里 你看到第一个嘛？有 hit 才能展开！然后剩下的 都不行 你说我没展开是错的我就是展开了啥也没看到才以为你什么都没搜到的"

**根因**：`packages/api/src/domains/cats/services/agents/providers/acp/acp-event-transformer.ts:83-112` 把 ACP 的两个 sessionUpdate 都错误转成 `type: 'tool_use'`：

```typescript
case 'tool_call': {              // 工具启动
  return { type: 'tool_use', catId, toolName, toolInput, ... };
}
case 'tool_call_update': {       // 工具结果回来
  return { type: 'tool_use', catId, toolName, content: content?.text, ... };  // ← BUG
}
```

UI 的 `useRecallEvents.filterRecallEvents` 的 pairing 期待 `evt.type === 'tool_result'`，ACP 路径下永不命中，所以：
- LIVE Recall sidecar：cards 显示但永远是 unpaired 状态（无 `[N hits]` badge）
- F188 Phase F FM-5 nudge-followup metric：依赖 `ToolEventLog.updateSummary()` 合并 result-side 数据；ACP 不发 `tool_result` AgentMessage，`route-serial.ts:850-883` 和 `route-parallel.ts:649-689` 的 result 合并逻辑都不会触发——**ACP 路径下 FM-5 拿不到 result summary，永远算不出来**。

不是 F188 Phase F 引入的，是 ACP transformer 老 bug，但 F188 Phase F 把 Recall sidecar / FM-5 推上前台后这个盲点暴露。

## What

### Phase A: ACP `tool_call_update` 正确分流为 `tool_result`

**目标**：当 ACP 发 `tool_call_update` 且包含 final result content 时，emit `type: 'tool_result'`；中间 progress update 仍 emit `tool_use` 以保留 streaming UI。

**判定逻辑**（按 ACP protocol）：

1. `tool_call`（最初的 use 事件）→ emit `type: 'tool_use'`（保持现状）
2. `tool_call_update` 含 `inner.status === 'completed'` 或 `inner.status === 'failed'` → emit `type: 'tool_result'`
3. `tool_call_update` 状态为 `in_progress` 或无状态字段但有 content → 仍 emit `type: 'tool_use'`（progress streaming）

**Edge cases**：
- ACP 同一个 tool 可能发多个 `tool_call_update` — 必须按 toolCallId 配对 + 只把最后一个含 final status 的转 `tool_result`
- ACP 可能省略 status 字段直接给 final content — 兜底：**最后一个 update 且 content 非空**视作 final

## Acceptance Criteria

### Phase A（ACP transformer 修复 + 测试）
- [ ] AC-A1: `acp-event-transformer.ts` 的 `tool_call_update` case 按 status 分流：`completed`/`failed` → `tool_result`；`in_progress` 或无状态 → `tool_use`（progress）
- [ ] AC-A2: 兜底逻辑 — 同一 `toolCallId` 收到多个 update，最后一个含 content 的视作 `tool_result`
- [ ] AC-A3: 单元测试覆盖 4 个场景：(a) tool_call + tool_call_update[completed] → tool_use+tool_result pair (b) tool_call + tool_call_update[in_progress] + tool_call_update[completed] (c) failed status 转 tool_result (d) 仅 tool_call 无 update（hang）保持现状不报错
- [ ] AC-A4: 现有 `recall-feed.test.ts` 加 1 个 ACP-shape fixture：通过 transformer 输入 → useRecallEvents 输出 → 验证 RecallEvent.resultCount 被正确 pair
- [ ] AC-A5: F188 Phase F FM-5 indirect 验证 — `route-serial.ts` / `route-parallel.ts` 的 `updateSummary()` 通过 ACP 路径的 `tool_result` 触发；构造 ACP fixture stream 跑 ToolUsageMetricsAggregator，FM-5 能算出来（之前会 NaN/0）
- [ ] AC-A6: 修完后实际验证：本地 alpha 起来，铲屎官在 ACP 路径下跑 search_evidence，Recall sidebar 卡片显示 `[N hits]` + 可展开看 results

## Architecture Ownership

Architecture cell: `cats/services/agents/providers/acp` (F149 Phase B 之前确立的 cell)
Map delta: **none** — 只修 cell 内的 transformer 逻辑，不改 ownership / boundary / extension point
Why: 这是 cell 内部行为修复（ACP sessionUpdate kind → AgentMessage type 映射），不引入新概念，不改 cell 跟下游 (route-serial / route-parallel / useRecallEvents) 的契约

## Eval / Tracking Contract

> 触发条件：修改了 provider 行为，间接影响 F188 Phase F FM-5 / FM-2 metric 路径，**且涉及猫的 UI 可观察性**——所以填。

### 1. Primary Users + Activation Signal

- **Users**：
  - Cats running on ACP provider（opus-47 + codex 部分场景）
  - 铲屎官（Recall sidebar 用户）
  - F188 Phase F FM-5 / FM-2 metric 消费者（Memory Health Dashboard）
- **Activation signal**：
  - AS-1：ACP 路径下 search_evidence 调用，UI Recall sidecar 卡片显示 `[N hits]`（>0）
  - AS-2：ACP 路径下 ToolEventLog 接到的 search_evidence event 在 `updateSummary()` 后含 `resultCount` / `nudgeEmitted` 字段（之前一直 undefined）

### 2. Friction Metric

- **FM-1**：ACP 路径下 Recall sidecar paired ratio — 期望 ≥ 95%（少数 hang/timeout 可接受）
- **FM-2**：ToolEventLog 中 ACP 路径 search_evidence event 的 `_resultMerged === true` 比例 — 期望 ≥ 95%
- **FM-3**：F188 Phase F FM-5 nudge-failure-rate 是否能在 ACP-only thread 上算出 non-NaN 值（之前 ACP-only thread 永远 NaN）

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

- **Related**: F188（Phase F 暴露了这个 bug；fix 后 FM-5 在 ACP 路径下也能算）
- **Related**: F149（Gemini ACP Adapter — 同一 ACP protocol，但 Gemini side 的 transformer 在另一个文件，本 fix 只动 catagent ACP path；如砚砚 review 时发现 Gemini ACP 同病要并修，scope 顺势扩展）
- **Related**: F102（Recall sidebar 是 F102 Phase J 产物，本 fix 修它的 pairing 数据源）

## Risk

| 风险 | 缓解 |
|------|------|
| `tool_call_update` 的 status 字段在不同 ACP 服务端 (Claude Code CLI / Gemini ACP) 命名不同 | 测试覆盖 Claude Code ACP 实际 payload + 留兜底 "最后一个 content 非空 update 视为 final" |
| 同一 toolCallId 多个 update 的 pairing 错乱 | acp-event-transformer 内部维护 toolCallId → lastUpdate map，只 final 状态 emit tool_result |
| 改动让现有 progress streaming UI 卡死 | 测试覆盖 in_progress update 仍 emit `tool_use` 含 content（保留现状） |
| F149 Gemini ACP adapter 用同一 ACP protocol 但走另一份 transformer，可能漏修 | 砚砚 review 时强制 check Gemini ACP 是否同病；若是，scope 扩展（开 Phase B 同步修） |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | ACP sessionUpdate `tool_call_update` 的实际 `inner.status` 字段名是什么？需要 sample 一份真实 ACP payload | ⬜ 未定（开 wktree 后跑 acp-event-debug 拿样本） |
| OQ-2 | F149 Gemini ACP 同病？砚砚 review 时确认 | ⬜ 待砚砚确认 |
| OQ-3 | progress vs final 的判定：仅靠 `status` 还是要加 timeout fallback？(防止 ACP 服务端漏发 final) | ⬜ 待 sample 确认 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 走完整 spec + Design Gate 流程，不当 quick hotfix 偷渡 | 铲屎官原话「按家规先把 spec 写好 commit push 然后和砚砚确定清楚之后再开 wktree」；这个 bug 影响多个 F (F188/F102/F149) 的 telemetry path，必须 reviewer 把关 | 2026-05-11 |
| KD-2 | scope 锁定 Claude Code ACP transformer，先不扩到 Gemini ACP | 单一 fix 优先 ship，Gemini ACP 视砚砚 review 结论决定 | 2026-05-11 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-11 | F188 Phase F 上线后铲屎官 dogfooding 发现 Recall sidecar 不显示 hits；47 诊断到根因 = ACP transformer 把 `tool_call_update` 错转成 `tool_use`；铲屎官 push back 走 spec 流程，本 spec 立项 |

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
