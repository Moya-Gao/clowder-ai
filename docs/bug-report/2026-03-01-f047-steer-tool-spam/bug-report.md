---
doc_kind: bug_report
date: 2026-03-01
title: "F047: Steer 后前端刷屏显示 tool 调用/JSON(system_info:web_search)"
status: open
owner: codex
---

# Bug Report — F047 Steer 后前端刷屏（tool 面板 + JSON 气泡）

## 1) 报告人

- **报告人**：铲屎官
- **发现方式**：在 Hub 里对一条队列消息点 **Steer**（非 processing 场景），随后聊天区出现大量「X 个工具调用」面板，并且多条蓝色系统气泡展示原始 JSON：
  - `{"type":"web_search","catId":"codex","count":1}`

## 2) 复现步骤（期望 vs 实际）

### 复现步骤（稳定）

1. 在某 thread 中让猫开始执行（或让队列里有待处理消息）
2. 对队列中的一条消息点击 **Steer**（将其提升/立即执行）
3. 观察聊天区域消息渲染

### 期望

- Tool 调用信息应该**折叠在 assistant 气泡内**（ToolEventsPanel），或以可读提示展示
- 不应把内部 `system_info` 的 JSON 原样当作系统消息刷屏显示

### 实际

- 出现多条系统消息气泡，内容为原始 JSON（`type=web_search`）
- 视觉上看起来像“疯狂刷屏/爆炸”

## 3) 根因分析（证据链）

### 现象对应的前端渲染入口

- `packages/web/src/components/ChatMessage.tsx`
  - ToolEventsPanel 标题：`{events.length} 个工具调用`
  - 系统消息默认渲染会直接输出 `message.content`（蓝色气泡）

### JSON 气泡的直接原因：前端未消费 `system_info(type=web_search)`

- 后端把 Codex provider 的 `web_search` 事件转换为：
  - `system_info`，且 `content = JSON.stringify({ type: 'web_search', catId, count: 1 })`
  - 位置：`packages/api/src/domains/cats/services/agents/providers/codex-event-transform.ts`
- 前端 `useAgentMessages` 对 `system_info` 做 JSON parse，但**未处理** `parsed.type === 'web_search'`：
  - 不命中任何已知分支 → `consumed=false` → `addMessage(type='system', content=rawJson)` → 蓝色气泡刷屏
  - 位置：`packages/web/src/hooks/useAgentMessages.ts`
- 同样的缺口也存在于 background thread 的 `consumeBackgroundSystemInfo`：
  - 位置：`packages/web/src/hooks/useSocket-background-system-info.ts`

### 为什么 Steer 后更明显

- Steer 会立即触发新的 invocation 执行；该执行过程中更可能使用 `web_search`
- 每次 `web_search` 都会产生一次 `system_info(web_search)`，当前实现会每次都落成一条系统消息

## 4) 修复方案（选型 + 取舍）

### 方案 A（本次选用）：把 `web_search` 作为 ToolEvent 追加到 assistant 气泡里（并消费掉 system_info）

- 在 `useAgentMessages.ts` 的 `system_info` JSON 分支中：
  - `parsed.type === 'web_search'` → `consumed=true`
  - 复用 tool_use 的“确保存在 assistant bubble”逻辑
  - `appendToolEvent(messageId, { label: \`\${catId} → web_search\` })`
- 在 `useSocket-background-system-info.ts` 中：
  - 同样消费 `web_search`
  - 追加为 background thread 的 tool event（或至少不再落成系统消息）

**理由**：
- 最符合 UI 结构：工具调用信息集中在 ToolEventsPanel，不刷屏
- 保留“发生过 web_search”的可见性（但不泄漏 query，符合后端隐私设计）

### 方案 B（备选）：直接忽略 `web_search`（consumed=true，不展示）

- 更安静，但丢失“猫确实在做 web_search”这条线索

## 5) 验证方式

- **回归测试（Red→Green）**：
  1. 前台：`system_info(web_search)` 不再 `addMessage(type='system')` 输出 raw JSON；而是 `appendToolEvent`
  2. 后台：`system_info(web_search)` 不再落成系统消息（且不会把 raw JSON 写进 thread messages）
- **手工验证**：
  - Steer 后不会出现多条 JSON 蓝色气泡；工具信息收敛到 ToolEventsPanel 中

