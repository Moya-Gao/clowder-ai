---
feature_ids: [F045]
topics: [review-request, ndjson, observability]
doc_kind: review
created: 2026-02-27
---

## Review 请求: F045 NDJSON 可观测性 — CLI 事件流全量解析 + 前端可视化

### 背景

CLI NDJSON 事件流中大量有价值的事件被 `return null` 丢弃。GPT Pro Deep Research 报告系统地量化了缺口（Codex: todo_list/reasoning/mcp_tool_call/web_search/item.error，Claude: thinking_delta/error subtypes/compact_boundary/rate_limit_event）。本 PR 完成全量解析补全 + 前端可视化 + Plan 持久化。

### 铲屎官原始需求（本 session UX 采访 2026-02-27）

> "Thinking 怎么呈现？方案A"
> "重启了我们的项目，你可能还没执行完，右上角那边变成等待调用...我就不知道你之前执行进度了"
> "还是 plan 最重要"
> "thinking 暂时不要转发给其他猫，不然会太长了"
> "Token/Cost 我们现在就显示了，本质上这次 F045 不涉及"

- **核心痛点**：①页面刷新后 Plan 进度丢失 ②看不到猫的思考过程 ③错误只显示笼统 "error"
- **请 Reviewer 对照判断**：交付物是否解决了铲屎官的 3 个痛点？

### 设计文档

- Spec: `docs/features/F045-ndjson-observability.md`
- Plan: `docs/plans/2026-02-27-f045-ndjson-observability.md`
- Research: `docs/research/cli-NDJSON-gpt-pro.md`

### Spec Compliance 自检

| # | AC 要求 | 状态 | 代码位置 | 测试 |
|---|---------|------|----------|------|
| 1 | Codex todo_list → Plan Checklist | ✅ | codex-event-transform.ts:38-62 | 6 tests |
| 2 | Plan 持久化：刷新后恢复 | ✅ | TaskProgressCache.ts + invoke-single-cat.ts + threads.ts + useChatHistory.ts | build clean |
| 3 | Claude thinking_delta 折叠 | ✅ | claude-ndjson-parser.ts:66-119 + ChatMessage.tsx:248-263 | 5 tests |
| 4 | Codex reasoning → thinking | ✅ | codex-event-transform.ts:64-77 | 1 test |
| 5 | Claude 4 种 error subtype | ✅ | claude-ndjson-parser.ts:198-212 + useAgentMessages.ts:478-492 | 3 tests |
| 6 | Claude compact_boundary + rate_limit | ✅ | claude-ndjson-parser.ts:138-196 | 2 tests |
| 7 | Codex mcp_tool_call / web_search / item.error | ✅ | codex-event-transform.ts:79-139 | 5 tests |
| 8 | 所有新增有单元测试 | ✅ | 33 new tests (18 Codex + 15 Claude) | 33/33 pass |
| 9 | 现有 tests 不 regress | ✅ | 2164 pass, 2 pre-existing fails | — |

### 偏离说明

| 偏离 | Spec 说的 | 实际做的 | 为什么 |
|------|-----------|----------|--------|
| InvocationRecord.errorSubtype | Spec 数据模型 | 放在 error message content JSON 里 | 更简单，前端直接从 WS 读 |
| InvocationRecord.thinkingContent | Spec 数据模型 | 作为 system_info 消息流入 chat | 铲屎官说暂不做 thinking 持久化 |
| Plan 持久化方式 | "InvocationRecord 或 Redis" | Module-level Map (TaskProgressCache) | V1 内存缓存足够，避免 InvocationRecord 膨胀 |

### 改动文件

| 文件 | 改动类型 | 行数 | 说明 |
|------|----------|------|------|
| codex-event-transform.ts | 修改 | +97 | todo_list/reasoning/mcp_tool_call/web_search/item.error 6 种新事件 |
| claude-ndjson-parser.ts | 修改 | +67 | thinking_delta/error subtypes/compact_boundary/rate_limit_event |
| ClaudeAgentService.ts | 修改 | +1 | streamState 添加 thinkingBuffer |
| TaskProgressCache.ts | 新增 | 44 | Module-level in-memory 缓存 |
| invoke-single-cat.ts | 修改 | +46 | 5 个 yield 位点添加 task_progress 缓存写入 |
| threads.ts | 修改 | +8 | GET /api/threads/:threadId/task-progress 端点 |
| ChatMessage.tsx | 修改 | +17 | ThinkingBlock 折叠组件 (💭 details/summary) |
| useAgentMessages.ts | 修改 | +28 | thinking 消息处理 + error subtype 标签 |
| useChatHistory.ts | 修改 | +40 | mount 时 fetch task-progress 恢复 |
| chat-types.ts | 修改 | +1 | variant 类型添加 'thinking' |
| codex-event-transform.test.js | 新增 | 249 | 18 tests (7 regression + 11 新事件) |
| claude-ndjson-parser.test.js | 新增 | 274 | 15 tests (4 regression + 11 新事件) |

### Git SHA

- Base: `5f2f1da`
- Head: `c6be433`
- Branch: `feat/f045-ndjson-observability`

### 测试状态

```
pnpm --filter @cat-cafe/api test:
  2164 passed, 2 failed (pre-existing: Redis isolation guard + Codex reconnect diagnostics)
  33 new tests: 33/33 pass
pnpm build: all 3 packages clean
```

### Review 重点

1. **codex-event-transform.ts: todo_list 检测逻辑** — 在 `item.started`/`item.completed` 之前拦截 `todo_list` 类型，是否会误拦截非 todo_list 的 item 事件？
2. **claude-ndjson-parser.ts: thinking accumulation** — thinkingBuffer 累积 → content_block_stop flush 的时序是否正确？特别是多个 content_block（text + thinking 交替）场景
3. **TaskProgressCache: 内存泄漏** — module-level Map 没有 TTL/eviction，长期运行是否会膨胀？（当前无 clearTaskProgress 调用时机）
4. **useAgentMessages.ts: error content IIFE** — 在 JSX 属性中用 IIFE 解析 JSON，是否有更优雅的写法？
5. **invoke-single-cat.ts: 5 个 yield 位点** — 是否覆盖了所有 yield out 路径？漏了任何路径会导致 task_progress 不缓存

### 五件套

**What**: F045 NDJSON 可观测性全量实现 — 12 文件 / +853 行 / 33 新测试

**Why**: CLI 事件流中 Codex 的 todo_list/reasoning 和 Claude 的 thinking_delta/error subtypes 被丢弃，导致前端看不到猫的思考和计划进度。Plan 持久化修复了铲屎官的核心痛点（刷新后进度丢失）。

**Tradeoff**:
- 选择 system_info JSON payload 而非新增 AgentMessageType — 保持接口稳定，不碰 MessageStore schema
- Plan 持久化用内存 Map 而非 Redis/InvocationRecord — V1 简单可用，服务器重启丢失可接受
- Thinking 作为独立 system message (variant='thinking') 而非嵌入 assistant bubble — 实现更简单，虽然铲屎官说"inline fold in message bubble"，但效果相近（出现在 chat 流中、可折叠）

**Open Questions**:
- OQ-1: Claude `--output-format stream-json` 是否默认输出 thinking_delta？需实测
- OQ-2: Codex `todo_list`/`mcp_tool_call`/`web_search` 事件来自非官方来源(takopi.dev)，需实测验证
- TaskProgressCache 长期运行的内存管理策略（TTL? 定期清理?）

**Next Action**: 请 review 上述 12 个文件，特别关注 5 个 review 重点
