---
feature_ids: [F045]
topics: [ndjson, observability, transform, thinking, plan, telemetry, ux]
doc_kind: spec
created: 2026-02-27
---

# F045: NDJSON 可观测性 — CLI 事件流全量解析 + 多猫透明化

> **Status**: spec
> **Owner**: 布偶猫
> **Created**: 2026-02-27
> **Priority**: P1

---

## Why

我们 spawn 三猫 CLI 时收到的 NDJSON 事件流中，**大量有价值的事件被 `return null` 丢弃**。GPT Pro Deep Research 报告（`docs/research/cli-NDJSON-gpt-pro.md`）系统地量化了这些缺口：

| 猫 | 当前处理 | 丢弃的宝藏 |
|----|----------|-----------|
| **Claude** | `text_delta`, `assistant`(text/tool_use), `system/init`, `result` | thinking_delta, input_json_delta, message_delta.usage, compact_boundary, rate_limit_event, result error subtypes, structured_output, hook_*, task_* |
| **Codex** | `agent_message`, `command_execution`, `file_change`, `thread.started` | reasoning, todo_list, mcp_tool_call, web_search, item-level error |
| **Gemini** | `message/assistant`, `tool_use`, `init`, `result/error` | （暂不在本 Feature 范围，Gemini CLI 事件较少） |

**铲屎官痛点**：
1. 猫猫在想什么？前端看不到 thinking
2. 猫猫的计划进度？只能从自然语言硬抽，很脆弱
3. 出错了为什么？只显示笼统的 "error"，不知道是超 turn、超预算还是运行时异常
4. 多猫并行时，不知道每只猫做到哪了
5. token 消耗只在调用结束后才能看到，没有实时感知

## What

端到端的 CLI 事件流可观测性升级：**parser 补全 → 数据分层存储 → 前端可视化 → 多猫互操作**。

## 核心架构设计

### 数据三层模型

```
┌─────────────────────────────────────────────┐
│  用户可见层（Message）                        │
│  text / tool_use / tool_result / error       │
│  → 渲染为聊天气泡，存 MessageStore            │
│  → 不改！保持现有 AgentMessageType            │
├─────────────────────────────────────────────┤
│  可观测层（Observation）                      │
│  thinking / plan / tool_detail / web_search  │
│  → 可折叠/展开的附属面板                      │
│  → 存 InvocationRecord.observations          │
├─────────────────────────────────────────────┤
│  遥测层（Telemetry）                         │
│  token_usage / cost / rate_limit / compact   │
│  → 不渲染为消息，走独立 HUD/dashboard 通道    │
│  → 存 InvocationRecord.usage（已有）+ 扩展    │
└─────────────────────────────────────────────┘
```

**核心原则**：不碰现有 MessageStore schema，可观测层是纯增量。

### 铲屎官 UX 决策（2026-02-27 采访）

| 问题 | 决策 | 理由 |
|------|------|------|
| Thinking 展示 | 方案 A：消息气泡内嵌折叠，默认折叠 | 直观，不干扰阅读 |
| Thinking 跨猫 | **暂不转发/查阅**（遗留到未来） | CLI 输出已经很多，再加 thinking 上下文爆炸 |
| Plan 位置 | 右侧看板（`RightStatusPanel`，已有） | 全局性，方便未来扩展 |
| Plan 持久化 | **必须修复**：当前重启后进度丢失 | 铲屎官痛点：重启后右上角只显示"等待调用..." |
| Token/Cost | 保持原状（已有），不在 F045 范围 | F24 已实现 |
| 优先级排序 | **Plan > Thinking > Error subtype** | 铲屎官日常最想知道"猫做到哪了" |

### 现有 Plan 系统（F26 遗产）

当前已有一套 Plan 展示链路（仅 Claude）：
```
Claude TodoWrite tool_use → extractTaskProgress() → system_info WS → RightStatusPanel
```

**现有问题**：
1. **重启丢失**：`chatStore` 纯内存，无 persist — 刷新/重启后 taskProgress 清零
2. **仅 Claude**：只检测 `TodoWrite` / `write_todos` 工具名；Codex 的 `todo_list` 事件完全没接
3. **无历史**：调用结束后 taskProgress 清空，无法回看

### 多猫互操作设计（精简版）

| 数据类型 | 本 Feature 范围 | 跨猫行为 |
|----------|----------------|---------|
| **thinking** | ✅ 解析 + 前端折叠 | ❌ 暂不跨猫（遗留） |
| **plan** | ✅ 解析 + 持久化 + 右侧看板 | ✅ 全局可见（TaskStore） |
| **error subtype** | ✅ 解析 + 错误条 | ✅ 全局可见 |
| **token/cost** | ❌ 已有，不做 | — |
| **tool_detail** | ❌ Phase 2（遗留） | — |

## Phase 拆分

### Phase 1: Parser 补全 + Plan 持久化（MVP）

**优先级最高：Plan 完整链路**
- [ ] **Codex `todo_list` 解析**：`codex-event-transform.ts` 新增 `todo_list` started/updated/completed → `system_info` task_progress 事件（复用现有 Claude TodoWrite 链路）
- [ ] **Plan 持久化修复**：taskProgress 快照写入后端（InvocationRecord 或 Redis），前端刷新后可恢复
- [ ] **Codex `reasoning` 解析**：`item.completed(reasoning)` → thinking observation

**Claude parser 补全**：
- [ ] `thinking_delta` → 累积 thinking 文本，content_block_stop 时产出 thinking 消息
- [ ] `result` error subtypes → 区分 `error_max_turns` / `error_max_budget_usd` / `error_during_execution` / `error_max_structured_output_retries`
- [ ] `system/compact_boundary` → 压缩边界事件 + pre_tokens
- [ ] `rate_limit_event` → 限流状态 + resetsAt/utilization

**Codex parser 补全**：
- [ ] `mcp_tool_call` (started/completed) → tool_use / tool_result
- [ ] `web_search` → system_info（query 计数，不落盘原文）
- [ ] `item.completed(error)` → system_info warning（非致命，如 output truncated）

**数据模型**：
- [ ] `InvocationRecord.errorSubtype?` 字段
- [ ] `InvocationRecord.thinkingContent?` 字段（或 observations 数组，视实现复杂度定）

### Phase 2: 前端可视化

- [ ] **ThinkingBlock**：消息气泡内嵌折叠区域，默认折叠（方案 A，铲屎官确认）
- [ ] **ErrorBanner**：带具体错误类型的错误条（"超出 turn 限制" vs "预算用尽" vs "运行时错误"）
- [ ] **Plan 持久化 UI**：刷新/重启后右侧看板恢复上次 taskProgress

### 遗留（Future，不在本 Feature 范围）

- ~~**跨猫 thinking 查阅**~~：铲屎官决策——"当真的需要的时候再设计，不然过度设计"
- ~~**ToolPanel**~~（MCP 工具详情折叠区）：等 Codex mcp_tool_call 实测验证后再考虑
- ~~**TokenHUD**~~：已有（F24 实现），不重做
- ~~**CatTaskOverview 跨猫总览**~~：Plan 持久化做好后自然可扩展

## Acceptance Criteria

- [ ] Codex `todo_list` 事件 → 右侧看板 Plan Checklist（与 Claude TodoWrite 同 UI）
- [ ] Plan 持久化：刷新/重启后右侧看板恢复上次进度（不再显示空白"等待调用..."）
- [ ] Claude parser 处理 `thinking_delta`（消息气泡内嵌折叠，默认折叠）
- [ ] Codex parser 处理 `reasoning`（等同 thinking，同折叠 UI）
- [ ] Claude parser 区分 4 种 error subtype（前端错误条显示具体原因）
- [ ] Claude `compact_boundary` / `rate_limit_event` 解析（system_info）
- [ ] Codex `mcp_tool_call` / `web_search` / `item.error` 解析
- [ ] 所有新增解析均有对应单元测试（fixture-based）
- [ ] 现有 tests 不 regress

## Key Decisions

| 决策 | 选择 | 放弃的方案 | 理由 |
|------|------|-----------|------|
| 数据分层 | 三层（Message/Observation/Telemetry） | 扩展 AgentMessageType | 不碰现有 schema，纯增量，前端向后兼容 |
| thinking 展示 | 消息气泡内嵌折叠（方案 A） | 侧边栏 / 调试开关 | 铲屎官选择：直观 |
| thinking 跨猫 | **暂不做**（遗留） | 存+按需查阅 | 铲屎官："不然过度设计" |
| plan 位置 | 右侧看板（复用 RightStatusPanel） | 消息流内嵌 | 已有基础设施，全局性 |
| plan 互操作 | 全局可见 + TaskStore 同步 | 仅本猫可见 | 多猫协调基础 |
| web_search query | 默认只计数，不落盘 | 完整记录 | 隐私安全（砚砚建议） |
| token/cost | **不做**，保持原状 | 重做 HUD | 已有（F24），不重复 |
| AgentMessageType | 不新增 type | 新增 thinking/plan_update/telemetry | 保持接口稳定 |

## Risk / Blast Radius

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| CLI 升级改变事件格式 | 中 | fixture-based 测试 + 版本锁定提示 |
| thinking 持久化的隐私边界 | 低 | thinking 不含用户输入，主要是模型推理 |
| 第三方来源（takopi.dev）事件类型未验证 | 中 | Phase 1 开始前实测抓包确认 |
| InvocationRecord 膨胀 | 低 | observations 可设 TTL / 只保留最近 N 条 |
| 前端渲染性能（thinking 很长） | 低 | 虚拟化滚动 + 默认折叠 |

## Dependencies

| Feature | 关系 | 说明 |
|---------|------|------|
| **F039 消息排队投递** | 🟢 无阻塞 | 并行，互不影响 |
| **F041 能力看板** | 🟢 无阻塞 | F041 管 MCP 配置，F045 管事件解析 |
| **F044 Channel System** | 🟢 F044 受益于 F045 | 更好的可观测性帮助调试 F044 |
| **前置研究** | ✅ 已完成 | GPT Pro 报告 + 原宝藏地图 |

**建议开发顺序**：F039A 合入 → F041 合入 → **F045** → F044

## Open Questions

### OQ-1: Claude thinking 默认是否开启
我们 spawn claude 时 `--output-format stream-json` 是否默认输出 thinking_delta？需要实测。可能需要配合 `alwaysThinkingEnabled` 或 `MAX_THINKING_TOKENS`。

### OQ-2: Codex 事件类型实测验证
takopi.dev 是非官方来源。`mcp_tool_call`、`web_search`、`todo_list` 需要实测 `codex exec --json` 确认这些事件确实存在。

### ~~OQ-3: 前端优先级~~ → 已决
铲屎官确认：**Plan > Thinking > Error subtype**。Token/Cost 已有不做。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Research** | [GPT Pro NDJSON 调研](../research/cli-NDJSON-gpt-pro.md) | 事件流缺口分析 + 落点建议 |
| **Research** | [NDJSON 宝藏地图](../archive/2026-02/research/cli-ndjson-treasure-map.md) | 前置调研（被 GPT Pro 报告补全） |
| **Code** | `packages/api/src/domains/cats/services/agents/providers/claude-ndjson-parser.ts` | Claude parser（改造目标） |
| **Code** | `packages/api/src/domains/cats/services/agents/providers/codex-event-transform.ts` | Codex parser（改造目标） |
| **Code** | `packages/api/src/domains/cats/services/types.ts` | AgentMessage / TokenUsage 类型 |

## Review Gate

| 轮次 | Reviewer | 结果 | 日期 |
|------|----------|------|------|
| — | — | — | — |

## Test Evidence

（待开发）

## Timeline

- 2026-02-27: GPT Pro 调研报告入库 + 四猫评审
- 2026-02-27: Spec written (feat-kickoff)
- 2026-02-27: 铲屎官 UX 采访完成，决策记录，spec 更新
- 2026-02-27: Phase 1 开发启动
