---
feature_ids: []
topics: [background, system, message]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report - Background System Message Variant Leak

## 1. 报告人

- 报告人：铲屎官
- 发现方式：在非当前 thread 里观察到 `缅因猫 → 布偶猫` 这类 A2A 文本被渲染成红色错误气泡（应为普通信息样式）
- 时间：2026-02-19

## 2. 复现步骤（期望 vs 实际）

1. 在 thread-A 触发后台事件（例如 `a2a_handoff` 或可见 `system_info`）。
2. 切换到 thread-B 并让 thread-A 的事件继续作为 background message 到达前端。
3. 切回 thread-A 查看消息渲染。

期望：
- `a2a_handoff` 与普通 `system_info` 走信息样式（`info`），`a2a_followup_available` 走 follow-up 样式（`a2a_followup`）。

实际：
- background 分支写入的这类 system message 没有 `variant`，UI 落到默认分支，被渲染为红色错误样式。

## 3. 根因分析

- `ChatMessage` 组件里，`type === 'system'` 且 `variant` 不是 `info/tool/a2a_followup` 时，默认使用红色样式。
- active 路径（`useAgentMessages.ts`）写 system 消息时会显式设置 `variant`（例如 `info` / `a2a_followup`）。
- background 路径（`useSocket-background.ts`）使用 `addBackgroundSystemMessage`，未设置 `variant`。
- 同时，`consumeBackgroundSystemInfo` 只返回 `{ consumed, content }`，没有把语义样式（variant）传回调用侧，导致解析后的可见 system_info 也丢失样式语义。

## 4. 修复方案

- 将 background 可见系统事件的语义样式完整对齐 active 路径：
1. `addBackgroundSystemMessage` 支持传入 `variant` 并写入消息。
2. `a2a_handoff` 固定写 `variant: 'info'`。
3. 扩展 `consumeBackgroundSystemInfo` 返回 `variant`：
   - `a2a_followup_available` -> `a2a_followup`
   - 其他可见 system_info（raw/mode_switch/session_seal 等）-> `info`
4. 保持已“consume 的静默事件”不落消息（如 `invocation_metrics` / `invocation_usage` / `context_health` / `task_progress`）。

## 5. 验证方式

- 新增回归测试覆盖 background 可见系统事件矩阵（Red→Green）：
  - `a2a_handoff` -> `variant: info`
  - raw `system_info` -> `variant: info`
  - parsed `mode_switch_proposal` -> `variant: info`
  - parsed `session_seal_requested` -> `variant: info`
  - parsed `a2a_followup_available` -> `variant: a2a_followup`
- 跑 hooks/store 相关回归测试集，确认无回归。
