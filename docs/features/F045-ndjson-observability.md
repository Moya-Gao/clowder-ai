---
feature_ids: [F045]
topics: [ndjson, observability, transform, thinking, plan, telemetry, ux]
doc_kind: spec
created: 2026-02-27
---

# F045: NDJSON 可观测性 — CLI 事件流全量解析 + 多猫透明化

> **Status**: done (Phase 1+2 合并交付, PR #88)
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
| Plan 持久化 | **必须修复**：当前刷新/页面重载后进度丢失 | 铲屎官痛点：刷新后右上角只显示"等待调用..."（V1 覆盖浏览器刷新；服务重启恢复为 follow-up） |
| Token/Cost | 保持原状（已有），不在 F045 范围 | F24 已实现 |
| 优先级排序 | **Plan > Thinking > Error subtype** | 铲屎官日常最想知道"猫做到哪了" |

### 现有 Plan 系统（F26 遗产）

当前已有一套 Plan 展示链路（仅 Claude）：
```
Claude TodoWrite tool_use → extractTaskProgress() → system_info WS → RightStatusPanel
```

**现有问题**：
1. **刷新丢失**：`chatStore` 纯内存，无 persist — 浏览器刷新后 taskProgress 清零（服务重启同理，但 V1 仅解决浏览器刷新场景）
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
- [x] **Codex `todo_list` 解析**：`codex-event-transform.ts` 新增 `todo_list` started/updated/completed → `system_info` task_progress 事件（复用现有 Claude TodoWrite 链路）
- [x] **Plan 持久化修复**：`TaskProgressCache`（module-level Map）+ `GET /api/threads/:id/task-progress` + 前端 mount 时自动恢复。**V1 范围：浏览器刷新，非服务重启**
- [x] **Codex `reasoning` 解析**：`item.completed(reasoning)` → thinking system_info

**Claude parser 补全**：
- [x] `thinking_delta` → 累积 thinking 文本，content_block_stop 时产出 thinking 消息
- [x] `result` error subtypes → 区分 5 种（含 `error_max_structured_output_retries`）
- [x] `system/compact_boundary` → 压缩边界事件 + pre_tokens
- [x] `rate_limit_event` → 限流状态 + resetsAt/utilization

**Codex parser 补全**：
- [x] `mcp_tool_call` (started/completed) → tool_use / tool_result
- [x] `web_search` → system_info（query 计数，不落盘原文）
- [x] `item.completed(error)` → system_info warning（非致命，如 output truncated）

**数据模型（实际偏离 spec）**：
- ~~`InvocationRecord.errorSubtype?`~~ → 改用 error message 的 `content` 字段 JSON `{ errorSubtype }` 传递
- ~~`InvocationRecord.thinkingContent?`~~ → 改用 `system_info` message `{ type: 'thinking', text }` 实时传递，不落盘

### Phase 2: 前端可视化（与 Phase 1 合并交付）

- [x] **ThinkingBlock**：独立 `<details>` 折叠块（💭 思考过程），默认折叠 — ⚠️ **见 Gap #1**
- [x] **ErrorBanner**：5 种 error subtype 中文标签
- [x] **Plan 持久化 UI**：浏览器刷新/页面重载后右侧看板恢复上次 taskProgress

### 遗留（Future，不在本 Feature 范围）

- ~~**跨猫 thinking 查阅**~~：铲屎官决策——"当真的需要的时候再设计，不然过度设计"
- ~~**ToolPanel**~~（MCP 工具详情折叠区）：等 Codex mcp_tool_call 实测验证后再考虑
- ~~**TokenHUD**~~：已有（F24 实现），不重做
- ~~**CatTaskOverview 跨猫总览**~~：Plan 持久化做好后自然可扩展

## Acceptance Criteria

- [x] Codex `todo_list` 事件 → 右侧看板 Plan Checklist（与 Claude TodoWrite 同 UI）
- [x] Plan 持久化：浏览器刷新/页面重载后右侧看板恢复上次进度（V1 范围，服务重启恢复为 follow-up）
- [x] Claude parser 处理 `thinking_delta`（默认折叠）— ⚠️ 独立 system message，非嵌入气泡（见 Gap #1）
- [x] Codex parser 处理 `reasoning`（等同 thinking，同折叠 UI）
- [x] Claude parser 区分 5 种 error subtype（含 `error_max_structured_output_retries`）
- [x] Claude `compact_boundary` / `rate_limit_event` 解析（system_info）
- [x] Codex `mcp_tool_call` / `web_search` / `item.error` 解析
- [x] 所有新增解析均有对应单元测试（33+ fixture-based）
- [x] 现有 tests 不 regress（538 web + API 全过）

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

### ~~OQ-1: Claude thinking 默认是否开启~~ → 已验证
`--output-format stream-json` 输出 `thinking_delta`（当 extended thinking 开启时）。Parser 已实现 buffer 累积 + `content_block_stop` 产出。实际是否输出取决于 Claude CLI 设置。

### ~~OQ-2: Codex 事件类型实测验证~~ → 部分验证
`todo_list`、`reasoning` 已在实际运行中确认存在。`mcp_tool_call`、`web_search` 已实现 parser 但未在实际 Codex 调用中观测到（需要 Codex 使用 MCP 工具或搜索时触发）。

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
| 本地 R1 | 砚砚/Codex | P0(auth)+P1(persistence)+P2(ghost) → 修复 | 2026-02-27 |
| 本地 R2 | 砚砚/Codex | 通过，建议"重启项目"→"浏览器刷新/页面重载" | 2026-02-27 |
| 云端 R1 | Codex (GitHub) | 1P1 (targetCats 未恢复) → 修复 | 2026-02-28 |
| 云端 R2 | Codex (GitHub) | 1P2 (HTTP race 覆盖 WS 状态) → 修复 | 2026-02-28 |
| 云端 R3 | Codex (GitHub) | 2P2 (cache 泄漏 + 空 progress 恢复) → 修复 | 2026-02-28 |
| 云端 R4 | Codex (GitHub) | 2P2 (background thinking + error label) → 修复 | 2026-02-28 |
| 云端 R5 | Codex (GitHub) | 0 P1/P2，通过 | 2026-02-28 |

## 愿景守护 — Gap 分析（2026-02-28 三猫联合评审）

### Gap #1: Thinking 气泡归属 ⚠️ 需铲屎官拍板

**spec 写的**："消息气泡内嵌折叠区域（方案 A）" — 暗示 thinking 嵌在 assistant 的消息气泡内部。

**实际做的**：独立 `{ type: 'system', variant: 'thinking' }` 消息，在聊天流里作为独立的 `<details>` 元素渲染（💭 思考过程 + 字符数），NOT 嵌在 assistant 气泡里。

**体验差异**：thinking 出现在 assistant 消息的上方（或之间），而不是"点开 assistant 气泡就能看到 thinking"。

**三猫共识**：功能上可用（折叠、默认关闭），但与 spec 措辞有偏离。需铲屎官确认当前实现是否 OK，或需要改为嵌入气泡。

### Gap #2: thinkingMode 默认值可能导致跨猫泄露 ⚠️

**发现者**：砚砚/GPT-52

**问题**：`RedisThreadStore` 的 `thinkingMode` 默认是 `debug`。`route-helpers.ts:240` 在 `play` 模式才屏蔽跨猫 thinking 进上下文。铲屎官明确说"暂不跨猫转发 thinking"，但默认 `debug` 模式下 thinking 可能被传递给其他猫作为上下文。

**处置**：确认是否需要改默认为 `play`（或排查 thinkingMode 的实际使用范围）。

### Gap #3: 截图证据缺失 🔴

**Anti-Drift Protocol 要求**：前端 UI/UX 功能必须产出 ≤3 张截图 + "需求→截图"映射表。

**现状**：F045 有前端 UI 变更（ThinkingBlock、ErrorBanner、Plan 恢复），但未产出截图证据即合入。

**处置**：在 runtime 上补截图验证。

### Gap #4: 持久化范围边界（已知，非 gap）

**砚砚/Codex 提醒**：V1 只覆盖浏览器刷新（module-level cache），不覆盖服务重启。调用结束时 `clearTaskProgress` 清空缓存（避免内存膨胀+stale 数据）。这是 spec 中明确标注的 V1 范围，非偏离。

## Test Evidence

- API tests: 2613 pass (含 33+ F045 fixture-based tests)
- Web tests: 538 pass
- Build: clean
- 截图证据：**待补**（见 Gap #3）

## Timeline

- 2026-02-27: GPT Pro 调研报告入库 + 四猫评审
- 2026-02-27: Spec written (feat-kickoff)
- 2026-02-27: 铲屎官 UX 采访完成，决策记录，spec 更新
- 2026-02-27: Phase 1+2 合并开发启动
- 2026-02-28: PR #88 合入 main (砚砚 R2 + 云端 R5)
- 2026-02-28: 愿景守护 — 三猫联合评审，发现 4 gaps
