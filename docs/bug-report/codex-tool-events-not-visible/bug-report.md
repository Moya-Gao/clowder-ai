# Bug Report: Codex 工具调用事件未在 UI 显示

> **报告人**: 铲屎官  
> **定位猫猫**: 缅因猫 🐾  
> **报告日期**: 2026-02-09  
> **严重程度**: P1（可观测性缺失，影响调试与信任）  
> **状态**: ✅ 已修复

---

## 1. 报告来源

- 来源：铲屎官在会话中直接反馈“Claude 能显示工具调用，Codex 不显示”。
- 发现方式：前端聊天界面对比观察（同类行为在 Claude 可见，在 Codex 不可见）。

---

## 2. 复现步骤（期望 vs 实际）

1. 在 Cat Cafe 中触发 Codex 执行包含工具操作的请求（如命令执行/读文件）。
2. 观察同一轮消息区域中的工具调用展示区。

**期望行为**  
- 与 Claude/Gemini 一样，看到 `tool_use` / `tool_result` 轨迹（至少“调用了什么工具”）。

**实际行为**  
- Codex 消息仅显示最终文本，不显示工具调用轨迹。

---

## 3. 根因分析（定位过程）

### 证据 1：Codex CLI 原始输出确实包含“工具事件”

本地复现实验命令：

```bash
codex exec --json --sandbox workspace-write --full-auto "请执行一个最小工具调用（例如读取当前目录）后，再只回复：done"
```

抓到的关键事件（节选）：

- `item.started` + `item.type=command_execution`
- `item.completed` + `item.type=command_execution`
- `item.completed` + `item.type=agent_message`

结论：Codex CLI 并非“没有工具调用事件”。

### 证据 2：后端映射层把 Codex 工具事件丢弃了

`packages/api/src/domains/cats/services/CodexAgentService.ts` 当前逻辑仅映射：

- `thread.started` → `session_init`
- `item.completed(agent_message)` → `text`
- 其余（含 `item.started/item.completed(command_execution)`、`file_change`）全部跳过

而前端 `packages/web/src/hooks/useAgentMessages.ts` 只会在收到 `tool_use/tool_result` 时显示工具轨迹。

**根因结论**  
- 问题不在前端渲染能力，也不在 Codex CLI 输出。  
- 问题在 **Codex 适配层未将 CLI 工具事件转换为统一的 `tool_use/tool_result` 协议消息**。

---

## 4. 修复方案与取舍

### 选定方案（本次）

在 `CodexAgentService` 中补齐事件映射：

- `item.started(command_execution)` → `tool_use`
- `item.completed(command_execution)` → `tool_result`
- `item.completed(file_change)` → `tool_use`（简化展示）

### 放弃方案

- 方案 A：前端直接识别 Codex 原始 `item.*` 结构  
  - 放弃原因：会破坏“后端统一协议”边界，让前端耦合 provider-specific 格式。
- 方案 B：仅显示 `command_execution`，忽略 `file_change`  
  - 放弃原因：会继续遗漏关键编辑动作，调试信息不完整。

### Open Questions

- 是否还要把 `reasoning` 事件也映射成系统消息（当前不建议，先保守）。
- `tool_result` 的输出是否需要更严格截断策略（避免超长污染 UI）。

### Next Action

- 在前端会话里再次触发 Codex 工具调用，确认工具轨迹已正常展示。

---

## 5. 验证方式

1. 单测：`codex-agent-service` 新增用例应覆盖 command/file-change 映射。
2. 手工：触发一次 Codex 工具调用，聊天气泡应出现工具事件轨迹。
3. 回归：确认既有 `session_init/text/done` 语义无回归。

### 本次验证结果

- `pnpm -C packages/api run build && pnpm -C packages/api exec node --test test/codex-agent-service.test.js`  
  - `11 passed / 0 failed`
- `pnpm -C packages/api run build && pnpm -C packages/api run test`  
  - `570 passed / 0 failed / 1 skipped`

---

*签名: 缅因猫 🐾*
