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

### 多猫互操作设计

| 数据类型 | 产生者 | 本猫可见 | 其他猫可见 | 铲屎官可见 | 持久化 |
|----------|--------|---------|-----------|-----------|--------|
| **thinking** | 自动（CLI 事件） | 是 | **按需查阅**（不自动转发） | 是 | InvocationRecord |
| **plan** | 自动（todo_list / plan output） | 是 | **全局可见** | 是 | TaskStore 同步 |
| **tool_detail** | 自动（mcp_tool_call 等） | 是 | 按需查阅 | 是 | InvocationRecord |
| **token/cost** | 自动（usage 事件） | 是 | 全局可见 | 是 | InvocationRecord.usage |
| **error subtype** | 自动（result error_*） | 是 | 全局可见 | 是 | InvocationRecord |

**thinking 不自动转发的理由**：
- thinking 通常很长很碎（Claude extended thinking 动辄几千 token），自动塞进其他猫上下文 = 烧预算
- 但 review 场景极有价值——砚砚 review 布偶猫代码时，能查阅布偶猫当时的思考链
- 方案：存下来，前端有"查看思考过程"按钮，A2A 场景猫猫可主动拉取

**plan 全局可见的理由**：
- 并行工作时知道对方在做什么是协调基础
- Codex todo_list + Claude plan output → 统一进 TaskStore → 前端跨猫任务总览

## Phase 拆分

### Phase 1: Parser 补全 + 数据模型（核心）

**Claude parser 补全**（`claude-ndjson-parser.ts`）：
- [ ] `thinking_delta` → 累积 thinking 文本，content_block_stop 时产出 observation
- [ ] `input_json_delta` → 工具参数流式拼接，block_stop 时解析
- [ ] `message_delta.usage` → 实时 token 计数（cumulative）
- [ ] `result` error subtypes → 区分 `error_max_turns` / `error_max_budget_usd` / `error_during_execution` / `error_max_structured_output_retries`
- [ ] `system/compact_boundary` → 压缩边界事件 + pre_tokens
- [ ] `rate_limit_event` → 限流状态 + resetsAt/utilization
- [ ] `system/status` → compacting 等状态
- [ ] `tool_progress` → 工具执行进度
- [ ] `structured_output` → 透传到 metadata

**Codex parser 补全**（`codex-event-transform.ts`）：
- [ ] `reasoning` → observation（thinking 等价）
- [ ] `todo_list` (started/updated/completed) → plan observation + TaskStore 同步
- [ ] `mcp_tool_call` (started/completed) → tool_detail observation（含 structured_content）
- [ ] `web_search` → observation（query 默认只计数，不落盘原文）
- [ ] `item.completed(error)` → warning observation（非致命，如 output truncated）
- [ ] `file_change.changes[].kind` 补 `delete` 支持

**数据模型扩展**：
- [ ] `InvocationRecord` 新增 `observations: Observation[]` 字段
- [ ] `Observation` 类型定义：`{ kind: 'thinking' | 'plan' | 'tool_detail' | 'web_search' | 'warning' | 'system_status', catId, content, metadata, timestamp }`
- [ ] `TokenUsage` 扩展：`rateLimitInfo?`, `compactBoundary?`
- [ ] `InvocationRecord.errorSubtype?` 字段

### Phase 2: 前端可视化组件

- [ ] **ThinkingBlock**：消息气泡内折叠/展开区域，默认折叠
- [ ] **PlanChecklist**：实时 ✅/⬜ 列表（Codex todo_list 直接渲染；Claude plan output 解析后渲染）
- [ ] **ToolPanel**：MCP 工具调用详情折叠区（参数 + structured_content + 执行状态）
- [ ] **TokenHUD**：顶部/侧边栏实时 token 计数器（cumulative 刷新）
- [ ] **ErrorBanner**：带具体错误类型的错误条（"超出 turn 限制" vs "预算用尽" vs "运行时错误"）
- [ ] **WebSearchTag**：web search 计数小标签

### Phase 3: 多猫透明化

- [ ] **CatTaskOverview**：跨猫任务总览面板（数据源：TaskStore，由 plan 事件 + MCP update_task 双通道喂入）
- [ ] **InvocationDetail**：查看任意猫的 InvocationRecord 详情（含 thinking、tool_detail、usage）
- [ ] **跨猫 thinking 查阅 API**：`GET /api/invocations/:id/observations?kind=thinking`
- [ ] 前端"查看思考过程"按钮（在其他猫的消息气泡上）

## Acceptance Criteria

- [ ] Claude parser 处理 thinking_delta（可折叠展示）
- [ ] Claude parser 区分 4 种 error subtype
- [ ] Codex parser 处理 todo_list（前端 checklist 组件）
- [ ] Codex parser 处理 reasoning（等同 thinking）
- [ ] 实时 token HUD 在猫猫对话过程中刷新
- [ ] 铲屎官可以在前端查看任意猫的 thinking 记录
- [ ] plan 事件自动同步到 TaskStore，跨猫可见
- [ ] 所有新增解析均有对应单元测试（fixture-based）
- [ ] 现有 1327+ tests 不 regress

## Key Decisions

| 决策 | 选择 | 放弃的方案 | 理由 |
|------|------|-----------|------|
| 数据分层 | 三层（Message/Observation/Telemetry） | 扩展 AgentMessageType | 不碰现有 schema，纯增量，前端向后兼容 |
| thinking 互操作 | 存但不自动转发 | 自动注入其他猫上下文 | 烧预算；review 时按需拉取更实际 |
| plan 互操作 | 全局可见 + TaskStore 同步 | 仅本猫可见 | 多猫协调的基础设施 |
| web_search query | 默认只计数，不落盘 | 完整记录 | 隐私安全（砚砚建议） |
| AgentMessageType | 不新增 type | 新增 thinking/plan_update/telemetry | 保持接口稳定，用 metadata + observation 层承载 |

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

### OQ-1: thinking 持久化周期
thinking 数据量可能很大。保留多久？跟随 InvocationRecord TTL？还是独立策略？

### OQ-2: Claude thinking 默认是否开启
我们 spawn claude 时 `--output-format stream-json` 是否默认输出 thinking_delta？需要实测。可能需要配合 `alwaysThinkingEnabled` 或 `MAX_THINKING_TOKENS`。

### OQ-3: Codex 事件类型实测验证
takopi.dev 是非官方来源。`mcp_tool_call`、`web_search`、`todo_list` 需要实测 `codex exec --json` 确认这些事件确实存在。

### OQ-4: 前端优先级
ThinkingBlock vs PlanChecklist vs TokenHUD，铲屎官日常体验哪个提升最大？

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
