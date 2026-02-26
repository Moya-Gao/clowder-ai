---
feature_ids: [F098]
topics: [session, query, tools]
doc_kind: plan
created: 2026-02-25
---

# F98: Session 查询工具升级 — 让猫更会查旧事

> 状态：待开发
> 负责猫：布偶猫（实现）+ 缅因猫（review）
> 日期：2026-02-25
> 来源：铲屎官 + 布偶猫 + 缅因猫 三方讨论，对照 `docs/lessons/08-session-management.md` 课件的畅想 vs 现实 gap 分析

## 背景

第八课描述了新猫的 MCP 工具箱——4 个工具让猫按需搜索/查询旧 session。F24 Phase D 已实现了这些工具的基础版本，但和课件畅想对比有 3 个功能 gap：

| 课件畅想 | 现状 | Gap |
|---------|------|-----|
| `read_session_events(view="chat/handoff/raw")` | 只有 raw 分页 | **缺 view 模式** |
| `read_invocation_detail(invocationId)` | 不存在 | **工具缺失** |
| `session_search` 返回 `(eventNo, invocationId)` | 只返回 `eventNo` | **定位指针不足** |

**优先级决策**（三猫共识 + 铲屎官拍板）：先做 Gap 1-3（让猫更会查旧事），Gap 4-5（性能债：索引/搜索加速）延后——当前 session 数量少，性能不是瓶颈。

## 链接

- **课件**: `docs/lessons/08-session-management.md` §新猫的 MCP 工具箱 (line 235)
- **BACKLOG**: #98
- **现有代码**:
  - MCP 工具: `packages/mcp-server/src/tools/session-chain-tools.ts`
  - API 路由: `packages/api/src/routes/session-transcript.ts`
  - 服务层: `packages/api/src/domains/cats/services/session/TranscriptReader.ts`
- **已知性能债（不在本次范围）**: TranscriptReader 分页不用字节偏移索引、搜索为朴素全文扫描

---

## Gap 1: `read_session_events` 加 view 模式

### 问题

课件描述 `read_session_events(sessionId, cursor, limit, view)` 有三种 view 模式：
- `raw`：原始 JSONL 事件流（当前唯一模式）
- `chat`：人类可读的对话格式（role: content 形式）
- `handoff`：交接摘要（按 invocation 分组的会议纪要格式）

当前只有 raw 模式——猫读到的是原始事件对象，需要自己解析 `type`/`role`/`content` 字段。

### 方案

在 API 层做格式转换，MCP 工具透传 `view` 参数。

**API (`session-transcript.ts`):**
- `GET /api/sessions/:sessionId/events` 新增可选参数 `?view=raw|chat|handoff`
- 默认 `raw`（向后兼容）
- `chat` 模式：过滤出 `role=user/assistant/system` 的消息事件，返回 `{ role, content, timestamp }` 数组
- `handoff` 模式：按 invocationId 分组，每组生成摘要（工具调用数、关键决策、用时），附会议纪要格式

**TranscriptReader:**
- 新增 `formatEvents(events, view)` 方法做转换
- `raw` 直接返回
- `chat` 过滤+简化
- `handoff` 分组+摘要

**MCP 工具 (`session-chain-tools.ts`):**
- `cat_cafe_read_session_events` input schema 新增可选 `view` 字段
- 透传到 API 调用

### 验收标准

- [ ] `GET /api/sessions/:id/events?view=raw` 返回和当前一样的 JSONL 事件
- [ ] `GET /api/sessions/:id/events?view=chat` 返回 `[{ role, content, timestamp }]` 格式
- [ ] `GET /api/sessions/:id/events?view=handoff` 返回按 invocation 分组的会议纪要
- [ ] MCP 工具 `cat_cafe_read_session_events` 支持 `view` 参数
- [ ] 无 view 参数时默认 `raw`（向后兼容）
- [ ] 测试覆盖三种 view 模式的转换逻辑

---

## Gap 2: 新增 `read_invocation_detail` MCP 工具

### 问题

课件描述：猫搜到某个 invocationId 感兴趣后，可以用 `read_invocation_detail(invocationId)` 深入查看完整输入/输出。

当前没有这个工具。猫只能通过 `read_session_events(view="raw")` 翻找，但无法按 invocationId 精确定位。

### 方案

**API (`session-transcript.ts`):**
- 新增 `GET /api/sessions/:sessionId/invocations/:invocationId`
- 返回该 invocation 的所有事件（system prompt 注入、猫的回复、工具调用、错误等）
- 从 JSONL 中按 invocationId 过滤事件

**TranscriptReader:**
- 新增 `readInvocationEvents(sessionId, invocationId)` 方法
- 从 events.jsonl 中过滤 `envelope.invocationId === target`

**MCP 工具:**
- 新增 `cat_cafe_read_invocation_detail` tool
- Input: `{ sessionId: string, invocationId: string }`
- 调用上述 API 端点

**前置条件检查:**
- 需确认 TranscriptWriter 写入事件时包含 invocationId 字段
- 如果不包含，需先在 `invoke-single-cat.ts` 的 transcript 写入处补 invocationId

### 验收标准

- [ ] TranscriptWriter 事件 envelope 包含 `invocationId` 字段
- [ ] `GET /api/sessions/:sid/invocations/:iid` 返回该 invocation 的所有事件
- [ ] 不存在的 invocationId 返回 404
- [ ] MCP 工具 `cat_cafe_read_invocation_detail` 可调用并返回结果
- [ ] MCP server `index.ts` 注册新工具
- [ ] 测试覆盖正常查询 + 404 + 权限检查

---

## Gap 3: `session_search` 返回 invocationId 指针

### 问题

课件描述 `session_search` 返回 `(eventNo, invocationId)` 定位指针，让猫可以从搜索结果直接跳到 `read_invocation_detail`。

当前 `TranscriptReader.search()` 返回的 hit 只有 `eventNo`，没有 `invocationId`。

### 方案

**TranscriptReader.search():**
- 搜索命中时，从事件 envelope 中提取 `invocationId` 字段
- 返回结果增加 `invocationId` 字段（可选，部分事件可能没有 invocationId）

**API (`session-transcript.ts`):**
- `GET /api/threads/:threadId/sessions/search` 返回结构增加 `invocationId`

**MCP 工具:**
- `cat_cafe_session_search` 返回结果已包含 `invocationId`（透传 API 响应）
- 更新工具描述说明可用 invocationId 跳转到 `read_invocation_detail`

### 验收标准

- [ ] `session_search` 返回结果包含 `invocationId` 字段（有值时返回，无值时 null）
- [ ] 搜索结果示例：`{ sessionId, seq, eventNo, invocationId, snippet }`
- [ ] MCP 工具描述更新，说明 `invocationId` 可配合 `read_invocation_detail` 使用
- [ ] 测试覆盖搜索结果包含 invocationId

---

## 实施顺序

| 步骤 | 内容 | 依赖 | 预计文件改动 |
|------|------|------|------------|
| **Step 1** | Gap 2 前置：确认 TranscriptWriter 事件包含 invocationId | 无 | `invoke-single-cat.ts`, `TranscriptWriter.ts` |
| **Step 2** | Gap 1: view 模式 | 无 | `TranscriptReader.ts`, `session-transcript.ts`, `session-chain-tools.ts` |
| **Step 3** | Gap 2: invocation detail | Step 1 | `TranscriptReader.ts`, `session-transcript.ts`, `session-chain-tools.ts`, `mcp-server/index.ts` |
| **Step 4** | Gap 3: search 指针 | Step 1 | `TranscriptReader.ts`, `session-transcript.ts`, `session-chain-tools.ts` |
| **Step 5** | 集成测试 + 文档同步 | Step 2-4 | tests, lesson 08 更新 |

### 非目标（明确不做）

- 性能优化（索引分页、向量搜索）— 留给后续 Phase
- Hub 前端展示 MCP 工具列表的动态化 — 独立问题（`config-viewer-tabs.tsx` 写死静态数组）
- Bootstrap 注入工具使用指引 — 现有 system prompt 已覆盖

---

## 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| TranscriptWriter 不记 invocationId | Gap 2+3 无数据源 | Step 1 先验证，不够则补 |
| handoff view 格式定义不清 | 可能做出无用格式 | 参考 SessionBootstrap 的 digest 格式 |
| MCP server 新增工具需重启 | 正在运行的猫拿不到新工具 | 下次 invoke 自动加载 |

---

## 收敛检查

1. 否决理由 → ADR？**没有**（本次没有否决技术方案，优先级选择不需要 ADR）
2. 踩坑教训 → lessons-learned？**没有**（本次是正向 gap 分析，无踩坑）
3. 操作规则 → 指引文件？**没有**（无新操作规则产生）

---

## 追溯链

```
BACKLOG.md #98（入口）
  └→ docs/plans/2026-02-25-session-query-tools-upgrade.md（本文档）
      ├→ docs/lessons/08-session-management.md §新猫的 MCP 工具箱（畅想来源）
      └→ 三猫讨论（铲屎官 + 布偶猫 gap 分析 + 缅因猫复核确认）
```
