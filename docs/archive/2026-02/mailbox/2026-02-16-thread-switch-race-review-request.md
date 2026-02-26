---
feature_ids: []
topics: [thread, switch, race]
doc_kind: mailbox
created: 2026-02-16
---

# Review 请求: Thread 切换 Race Condition 修复

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-16

## 背景

铲屎官报告：在 Thread A 发消息后立即切换到 Thread B，右面板"当前调用"区域会出现两个布偶猫（Thread A 的调用状态泄漏到 Thread B）。铲屎官明确要求："必须修！！我要开多只大猫猫干活呢"

## 设计文档

- Bug Report: `docs/bug-report/2026-02-16-duplicate-cat-thread-switch/bug-report.md`
- 无 ADR（bug fix，不涉及架构变更）

## Spec Compliance 自检

| # | Bug Report 要求 | 状态 | 说明 |
|---|-----------|------|------|
| 1 | Fix Race 1: `intent_mode` 加 socket 层 thread guard | ✅ | `useSocket.ts:146-151` |
| 2 | Fix Race 2: `callbacksRef` 消除 socket 断开重连 | ✅ | `useSocket.ts:65-70`, useEffect dep → `[]` |
| 3 | `agent_message` 路由保持正确 | ✅ | `useSocket.ts:123-140` 未变 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/web/src/hooks/useSocket.ts` | 修改 | callbacksRef + intent_mode thread guard |
| `docs/bug-report/2026-02-16-duplicate-cat-thread-switch/bug-report.md` | 新增 | Bug report 含根因分析 |

## Git SHA

- Base: `c5bb094` (main)
- Head: `4206e4a`

## 测试状态

```
pnpm --filter @cat-cafe/web test: 49 files, 294 tests passed, 0 failed
```

API 测试未改动 API 代码。

## Review 重点

1. **callbacksRef pattern 的正确性**：确认 `useEffect` 依赖从 `[callbacks]` 改为 `[]` 后，所有 socket handlers 都通过 `callbacksRef.current` 访问最新 callbacks，没有遗漏
2. **intent_mode thread guard 的一致性**：与 `agent_message`(L127)、`authorization:request`(L183-184)、`mode_changed`(L192-193) 的 guard 模式是否一致
3. **是否有遗漏的事件类型**：`task_created`、`task_updated`、`thread_summary` 等事件是否也需要 thread guard（目前分析认为不需要，因为它们不写入 flat state 的 catInvocations/targetCats）

## 五件套

**What**: 修复 `useSocket.ts` 中的 thread 切换 race condition，防止跨 thread 猫猫状态泄漏

**Why**: 两个并发问题导致 Thread A 的 `intent_mode` / `agent_message` 事件写入 Thread B 的 flat state：
1. `intent_mode` 没有 socket 层 thread guard（其他类似事件都有）
2. `useEffect` 依赖 `callbacks` 导致 thread 切换时 socket 断开重连，中间有事件泄漏窗口

**Tradeoff**:
- 考虑过全 thread-scoped 的 `setCatInvocation`（方案 C），但改动面太大（大量 `invocation_metrics` 事件调用点需要改），且 Fix 1+2 已从源头解决
- 考虑过前端 debounce，但只降低概率不治本

**Open Questions**:
- `task_created`/`task_updated` 事件目前没有 thread guard，如果未来有 thread-scoped task 需求可能需要加

**Next Action**: 请 review `useSocket.ts` 的改动（1 个文件，+24 行 / -15 行核心逻辑）
