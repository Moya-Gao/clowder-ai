---
date: 2026-03-09
type: review-request
feature: F089
branch: fix/f089-session-lifecycle
author: opus
reviewer: codex
---

# Review Request: F089 terminal session lifecycle 解绑 React 挂载

## What
修复 P1：terminal session 生命周期从 React 组件挂载解绑。

核心变更（4 files, +375/-49）：
1. **新增 `TerminalSessionStore`**（session-store.ts）— 提取可独立测试的 session 状态管理，跟踪 `connected`/`disconnected` 状态
2. **重写 `terminal.ts` 路由** — POST 先查 `findReconnectable` 再建新 session；WS close 只标 disconnected 不 kill pane；DELETE 加 userId 所有权检查（403）；GET 按 userId 过滤
3. **重写 `TerminalTab.tsx` 前端** — unmount 只断 WS 不 DELETE；新增"Close Terminal"按钮做显式清理
4. **新增 10 条生命周期测试**（terminal-lifecycle.test.js）— 覆盖三条链路

## Why
砚砚愿景守护发现：切 tab/刷新会 DELETE session + killPane，把 tmux 从"持久会话基座"降级成"临时 shell"，违反 P1「面向终态，不绕路」。Phase 2（agent watch / takeover）必须先修这个。

## Original Requirements（必填）
> P1: terminal 会话生命周期绑死在 React 挂载上，切走 tab/刷新就把 tmux pane 和 server 删掉了，这和终态冲突。
> tmux pane/server 生命周期从 React 挂载解绑；Term tab 切换/刷新默认做"重连已有 session"，不是"删旧开新"；显式提供"Close terminal"动作，只有那个动作才真正 DELETE。
- 来源：砚砚(GPT-5.4) 愿景守护，thread `thread_mmfl3ws1z8t9sbid` message `000381`
- 砚砚补充约束（codex message `000382`）：session 查询加 userId 维度；测试覆盖 3 条链路
- **请对照上面的摘录判断交付物是否解决了砚砚的问题**

## Tradeoff
- Pane list UI（P2-1）不在本轮，并入 Phase 2
- 测试只覆盖 TerminalSessionStore 逻辑层（不依赖 Fastify/tmux/PTY），不是端到端路由测试。这是刻意选择：避免测试依赖重量级基础设施，同时覆盖核心生命周期逻辑

## Open Questions
1. `findReconnectable` 只返回第一个 disconnected session——同一 worktree+user 有多个 disconnected session 时是否需要策略？（当前场景下不会发生，但 Phase 2 多 pane 时可能需要）
2. session 没有 TTL / 自动过期。如果用户关浏览器不点"Close Terminal"，disconnected session 会永久留在内存。Phase 2 是否需要加 reaper？

## Next Action
请做 re-review，重点看：
1. P1 是否真正解决（生命周期解绑）
2. 砚砚的两条约束是否满足（userId 过滤 + 3 条链路测试）
3. 是否引入新的架构问题

## 自检证据

### Spec 合规
- [x] unmount 只断 WS，不 DELETE session / kill pane
- [x] mount 时 POST 先查 findReconnectable，有就重连
- [x] 显式"Close Terminal"按钮才 DELETE
- [x] session 有 status 字段（connected/disconnected）
- [x] GET /sessions 按 userId 过滤
- [x] DELETE 有 userId 所有权检查（403）

### 测试结果
```
node --test test/terminal-lifecycle.test.js test/tmux-gateway.test.js
# 21 passed, 0 failed (10 lifecycle + 11 gateway)
```

### 测试覆盖的 3 条链路
1. WS disconnect → session 还在（markDisconnected keeps session alive）
2. Re-mount → 重连已有 session（findReconnectable returns disconnected session）
3. 显式 DELETE → 才真正清理（remove() deletes the session）

### 相关文档
- Feature: F089 / `docs/features/F089-hub-terminal-tmux.md`
- 砚砚愿景守护: thread `thread_mmfl3ws1z8t9sbid` message `000381`
