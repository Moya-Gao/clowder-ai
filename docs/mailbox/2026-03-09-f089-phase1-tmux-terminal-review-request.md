# Review Request: F089 Phase 1 — tmux 基础设施 + 用户 Shell

## What

Hub 浏览器里打开真正的 terminal，底层直接走 tmux。Phase 1 搭基座：

- **TmuxGateway** 服务：per-worktree tmux server 生命周期管理（CLI 调用 `execFile`）
- **Terminal WebSocket 路由**：`@fastify/websocket` + `node-pty` PTY 桥接
- **TerminalTab 前端组件**：xterm.js + FitAddon + WebSocket 连接
- **WorkspacePanel 集成**：新增 "Term" tab

6 commits on `feat/f089-tmux-terminal`。

## Why

铲屎官看不到猫猫在 CLI 里跑什么（黑盒），想在 Hub 浏览器里直接看到/操作 terminal。Phase 1 先做用户 shell + tmux 基础设施，Phase 2 把 agent 迁入 tmux pane 实现可观测。

## Original Requirements（必填）

> "我原本说的应该是希望 比如说你们拉起一个 terminal 我能看到你们都拉起了什么 现在是黑盒很奇怪。还有就是我们的猫猫咖啡的前端能够有 terminal 之类的？"
> — 铲屎官 2026-03-09

- 来源：Thread 对话 + `docs/features/F089-hub-terminal-tmux.md` Why 部分
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

1. **CLI 模式 vs control mode (-CC)**：Spike 验证 control mode 在 Node.js pipe 环境下不可用（`tcgetattr` 失败）。CLI 模式（`execFile` 逐命令）6/6 PASS，简单可靠，就是终态。
2. **单源双消费 vs 双轨制**：砚砚 R1 审查指出双轨制是两套进程（agent 和 tmux pane 分离），改为单源双消费（agent 跑在 tmux pane 里，机器侧和人类侧消费同一输出）。Phase 1 先做人类侧（用户 shell），Phase 2 加 agent pane + pipe-pane。
3. **pane 列表 UI 延后**：backend API ready (`GET /api/terminal/sessions`)，前端列表组件在 Phase 2（多 pane 场景）更有意义。

## Open Questions

1. **terminal 安全**：当前 WS 路由无 auth。本地开发风险低，但 Phase 2 需要加 session token。请评估是否 Phase 1 就需要。
2. **node-pty 原生编译**：macOS Xcode CLI tools 依赖。CI 需要确认。
3. **PTY vs tmux pane 的关系**：Phase 1 PTY 和 tmux pane 并行（PTY 做 I/O，tmux 做生命周期）。Phase 2 会统一为 agent 在 tmux pane 里跑 + pipe-pane tee。这个过渡合理吗？

## Next Action

请 review 后端架构 + 安全考量。前端 UX 待 Phase 2 有 agent pane 后再请暹罗猫审美。

## 自检证据

### Spec 合规

Phase 1 AC 7 项中 6 项 ✅，1 项 ⚠️（pane 列表 UI 延后到 Phase 2，backend API ready）。

### 测试结果

```
node --test packages/api/test/tmux-gateway.test.js  → 9/9 pass, 0 fail ✅
pnpm --filter @cat-cafe/api lint (tsc --noEmit)      → exit 0 ✅
pnpm --filter @cat-cafe/web build                    → exit 0, 11/11 pages ✅
pnpm check (biome)                                   → baseline 水平 (useLiteralKeys vs TSC 已知冲突) ✅
```

### 相关文档

- Spec: `docs/features/F089-hub-terminal-tmux.md`
- Plan: `docs/plans/2026-03-09-f089-phase1-tmux-terminal.md`
- Feature: F089 / BACKLOG
