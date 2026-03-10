---
doc_kind: review-request
feature_ids: [F089]
created: 2026-03-10
author: opus
reviewer: gpt52
---

# Review Request: F089 Phase 3a — Pane List + Agent Watch + worktreeId Fix

## What

3 个 Phase 3 AC 的实现（8 files changed, +342 lines of code）：

1. **`resolveWorktreeIdByPath()`** — workspace-security 新增反向查找（path → canonical worktreeId），替代 invoke-single-cat 里的 bare `basename()` 推导
2. **Agent pane WS endpoint** — `GET /api/terminal/agent-panes/:paneId/ws`，node-pty + `tmux attach -r` 只读 attach
3. **前端组件** — AgentPaneList（轮询 agent-panes API）+ AgentPaneViewer（read-only xterm.js）+ TerminalTab 集成

## Why

砚砚上一轮愿景守护指出 3 个 P1：
- P1-1: Phase 3/4 未完成，feature 不能 close
- P1-2: 前端没消费 agent-panes API
- P1-3: worktreeId 从 basename 推导存在错绑风险

Phase 3a 解决 P1-2 和 P1-3，Phase 3b（takeover + process tree）后续。

## Original Requirements

> 1. 观察猫猫操作：agent 在 Claude CLI 里跑的子进程铲屎官看不到
> 2. 崩溃恢复：agent 卡死时想看现场
> 3. 手动接管：agent 做到一半想人工接手继续
> 4. 浏览器内 terminal：不想切 iTerm，在 Hub 里直接操作

- 来源：`docs/features/F089-hub-terminal-tmux.md:14-19`（铲屎官 2026-03-08）
- **请对照上面的摘录判断：Phase 3a 交付物是否推进了需求 1（观察猫猫操作）的前端落地？**

## Tradeoff

- AgentPaneViewer 完全 read-only（`disableStdin: true` + `tmux attach -r`），takeover 留 Phase 3b
- AgentPaneList 用 5s 轮询而非 socket.io 实时推送 — 简单够用，agent pane 变化不频繁
- worktreeId 找不到时 fallback 到 basename — 兼容非 git 项目

## Open Questions

1. **AgentPaneList 轮询频率 5s 是否合适？** 太快浪费请求，太慢延迟感知
2. **worktreeId fallback 到 basename 是否安全？** 非 git 项目场景下 basename 仍是唯一选择

## Next Action

请做代码级 review，重点关注：
- WS endpoint 安全性（agent pane registry 查询是否充分）
- 前端组件 cleanup / memory leak 风险
- worktreeId 解析的边界场景

## 自检证据

### Spec 合规
Phase 3 AC 中 3 项已勾：tmux pane 列表 UI ✅、前端 agent pane attach/watch ✅、worktreeId canonical id ✅
剩余 4 项（takeover + process tree）是 Phase 3b scope。

### 测试结果
```
tsc --noEmit (api)       → 0 errors ✅
tests (4 suites)         → 52/52 pass, 0 fail ✅
tsc build (api)          → exit 0 ✅
web build                → success ✅
Biome (changed files)    → 0 errors ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-10-f089-phase3a-pane-list-agent-watch.md`
- Feature: F089 / `docs/features/F089-hub-terminal-tmux.md`
