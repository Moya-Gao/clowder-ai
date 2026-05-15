---
title: "Review Request: F198 Phase C — Hub Oversight UI"
date: 2026-05-15
from: sonnet
to: codex
pr: "https://github.com/zts212653/cat-cafe/pull/1678"
---

# Review Request: F198 Phase C — Hub Oversight UI

Review-Target-ID: f198
Branch: feat/F198-phase-c-oversight
PR: https://github.com/zts212653/cat-cafe/pull/1678

## What

F198 Phase C 全量交付，单 PR 闭环 6 个 AC：

- **AC-C1**: `GET /api/threads/:id/active-pane` — bg carrier session 与 thread 绑定查询
- **AC-C2**: `ClaudeBgCarrierService` working 阶段定期 yield `status` message（含 `state.detail` 文本）；原来只在 error 时读
- **AC-C3**: `ThreadCatStatus` hover tooltip 当猫在工作时显示 daemon detail 文本
- **AC-C4**: Hub 新增"后台会话"tab（`agent-sessions`），读 `~/.claude/jobs/*/state.json`，展示 session 列表 + 状态
- **AC-C5**: `ChatContainerHeader` 加 `DaemonActiveIndicator`，每 5s 轮询 `active-pane` API，daemon 运行时显示 amber pill + shortId，点击导航到 agent-sessions tab
- **AC-C6**: 跨猫愿景守护（@opus-47 另行 ping）

新增文件：
- `packages/api/src/domains/terminal/agent-sessions-reader.ts`
- `packages/web/src/components/HubAgentSessionsTab.tsx`

## Why

铲屎官硬约束（来自 F198 spec）：

> 方案必须保留 Hub 内可观察宪宪在干嘛（thread 流、tool call、状态、错误、长任务、崩溃现场）——不能"消失在外部终端里"。

## Original Requirements（必填）

> 铲屎官硬约束（Phase C 不放行就不通过）：方案必须保留 **Hub 内可观察宪宪在干嘛**（thread 流、tool call、状态、错误、长任务、崩溃现场）——不能"消失在外部终端里"。

来源：`docs/features/F198-claude-code-subscription-carrier.md`，第 25 行

**请 reviewer 对照上面摘录判断交付物是否解决了铲屎官的问题。**

Audit baseline（2026-05-15）能看到/看不到的 delta：

| 项目 | Before | After |
|------|--------|-------|
| daemon `state.json.detail` | 看不到 | AC-C2 + AC-C3: status tooltip 实时显示 |
| pane↔thread invocation 联动 | 无 | AC-C1: active-pane API |
| active sessions 列表 | 无 | AC-C4: 后台会话 tab |
| thread→pane 接管入口 | 无 | AC-C5: amber pill 导航 |

## Tradeoff

1. **DaemonActiveIndicator 5s 轮询** vs WebSocket push — 轮询实现简单且与现有 polling 模式一致；daemon 状态变化频率低，5s 延迟可接受。WebSocket push 可作 Phase D 优化。
2. **`agent-sessions-reader.ts` 读 `~/.claude/jobs/*/state.json`** — glob 路径里的 `*/` 在 `/** */` 块注释内会提前关闭注释（TypeScript + Node.js 均受影响）。已改用 `//` 行注释避开。
3. **`catStatusDetails` 为 required 字段**（非 optional）— 强制 compile-time 安全，7 个测试 helper 需同步更新（已完成）。

## Architecture Ownership（必填）

Architecture cell: F089 (Hub Terminal) + F143 (ProcessModel)
Map delta: update required — `agent-sessions-reader.ts` 新建独立 reader；`catStatusDetails` 扩展 ThreadState；Hub navigation 增加 monitor group tab
Why: oversight surface 扩展，不是新 Router/Store/Adapter，是 F089 hub infra 的 incremental extension

请 reviewer 检查：
- diff 是否与 `Map delta: update required` 一致
- `HubAgentSessionsTab` 是否新建了并行 Store（答案：否，复用 chatStore）
- `agent-sessions-reader.ts` 是否真的只是 reader，没有写路径

## Open Questions

### 技术 OQ（给 reviewer）

1. **`agent-sessions-reader.ts` 错误处理**：`readdir` 失败时 catch 返回 `[]`；malformed JSON 单 session 跳过，不影响整体。是否应该把错误 surface 到响应体而不是静默？
2. **`DaemonActiveIndicator` 5s 轮询内存泄漏**：effect cleanup 正确 cancel + clearInterval。但 `Promise` 未 cancel（cancel 变量做了 guard）——是否有 edge case 值得 reviewer 关注？
3. **`ThreadState.catStatusDetails` 清理时机**：`clearCatStatuses` / `clearThreadCatStatuses` / `setThreadIntentMode` 均 reset `catStatusDetails: {}`。是否遗漏了需要清理的路径？

### 价值 OQ（给 CVO，如有）

无——所有实现细节在 spec AC 定义范围内，无价值取舍需要 CVO 判断。

## 自检证据（来预防 reviewer 捷径错误）

如果判断错了我最可能错在哪：
1. `active-pane` API 的 404/501 边界处理（`agentPaneRegistry` 未初始化时返回 501）
2. `glob('*/state.json')` 写法在注释外是否正确（已用 `join(dir, shortId, 'state.json')` 逐目录读，不用 glob）
3. `catStatusDetails` 是否在所有 thread 切换路径上都被正确清理

### Spec 合规

Gate 通过（SHA: 6b2089ef3）：
- AC-C1 ✅ `GET /api/threads/:id/active-pane` 实现
- AC-C2 ✅ `ClaudeBgCarrierService` status message working 阶段
- AC-C3 ✅ ThreadCatStatus tooltip
- AC-C4 ✅ HubAgentSessionsTab + agent-sessions navigation
- AC-C5 ✅ DaemonActiveIndicator in ChatContainerHeader

### 测试结果

```
pnpm --filter @cat-cafe/api test     → 10999 passed, 0 failed, 3 skipped
pnpm --filter @cat-cafe/web test     → 3070 passed, 0 failed
pnpm -r --if-present run build       → 成功
pnpm lint                            → 通过
pnpm check                           → 通过
tsc --noEmit (api)                   → clean
tsc --noEmit (web)                   → clean
```

### 相关文档

- Plan: `docs/plans/2026-05-15-F198-phase-c-implementation-plan.md`
- Feature: F198 `docs/features/F198-claude-code-subscription-carrier.md`

## Next Action

请 @codex approve 或 blocking feedback。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f198/codex`
- Start Command: `pnpm review:start`
- Ports: web=3201, api=3202

[Sonnet/Sonnet-4-6🐾]
