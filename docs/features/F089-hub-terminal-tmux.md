---
feature_ids: [F089]
related_features: [F063, F061]
related_decisions: [012]
topics: [terminal, tmux, workspace, xterm, pty, agent-observability]
doc_kind: spec
created: 2026-03-09
---

# F089 Hub Terminal & tmux Integration — 浏览器终端 + 猫猫可观测性

## Why

### 核心需求（铲屎官 2026-03-08）

1. **观察猫猫操作**：agent 在 Claude CLI 里跑的子进程（Bash tool、subagent 等）铲屎官看不到
2. **崩溃恢复**：agent 卡死时想看现场（而不是只能杀进程重来）
3. **手动接管**：agent 做到一半想人工接手继续
4. **浏览器内 terminal**：不想切 iTerm，在 Hub 里直接操作

### 第一性原理对照（P1 面向终态，不绕路）

> 终态是 tmux 管理所有 session，所以从 Day 1 底层就是 tmux。
> "先做纯 PTY 再叠 tmux" = 脚手架（Phase 1 PTY 在 Phase 3 被推翻），违反 P1。

## What

### 双轨制架构（GPT Pro + 布偶猫共识）

```
Machine Track（不变）：spawn → pipe → NDJSON → 后端解析 → socket.io → 前端
Human Track（新增）：tmux server → tmux pane → node-pty → @fastify/websocket → xterm.js
```

两条轨道互不干扰。机器轨继续走 pipe + NDJSON；人类轨走 tmux + PTY + plain WebSocket。

### tmux 架构

- **一个 worktree = 一个 tmux server**：`tmux -L catcafe-{worktreeId}`
- **用户 shell = tmux 里的一个 window/pane**
- **agent watch = tmux 里的另一个 pane**（read-only）
- **takeover = 把 watch pane 从 read-only 切到 read-write**

### 技术栈

| 组件 | 选型 | 理由 |
|------|------|------|
| 前端 terminal | `@xterm/xterm` + addons | 业界标准，VSCode 也用 |
| terminal 传输 | `@fastify/websocket`（plain WS） | **已在 package.json，零新依赖** |
| 结构化事件 | `socket.io`（不变） | 现有基础设施 |
| 后端 PTY | `node-pty` | 跨平台，xterm.js 生态配套 |
| tmux 集成 | control mode (`-CC`) | 文本协议，可编程控制 |
| 进程监控 | `pidtree` + `pidusage` | 跨平台（macOS + Linux） |

## Acceptance Criteria

### Phase 1：tmux 基础设施 + 用户 Shell（终态基座）

- [ ] TmuxGateway 服务：worktree = tmux server 生命周期管理
- [ ] `@fastify/websocket` 路由 `ws://host/api/terminal/:sessionId`
- [ ] 用户 shell = tmux window/pane，通过 xterm.js 在浏览器操作
- [ ] WorkspacePanel 新增 Terminal tab
- [ ] tmux window/pane 列表 UI
- [ ] 前端 `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-attach`

### Phase 2：Agent Watch Pane

- [ ] Agent 启动时自动在 tmux 里开 watch pane（`select-pane -d` read-only）
- [ ] `remain-on-exit` 保留崩溃现场
- [ ] 前端点 pane 即可 attach 观看 agent 操作
- [ ] `pipe-pane -O` tee 日志给解析器

### Phase 3：Takeover + 进程监控

- [ ] `select-pane -e` 切换 watch → takeover
- [ ] takeover 时暂停机器轨 NDJSON 解析（防干扰）
- [ ] `pidtree` + `pidusage` 进程树监控
- [ ] 前端 ProcessTree 组件

### Phase 4（远期）：stdin pipe + stream-json 双向通信

- [ ] 打开 `stdio[0]` 为 pipe
- [ ] `--input-format stream-json` / `--output-format stream-json`
- [ ] 程序化交互（Agent SDK 前置步骤）

## Links

- GPT Pro 咨询文档：`docs/research/2026-03-08-hub-terminal-tmux-gpt-pro-consult.md`
- F063 Workspace Explorer（基座）
- F061 CDP Bridge（agent 子进程管理经验）

## Key Decisions

1. **双轨制**：机器轨（pipe+NDJSON）不动，人类轨（tmux+PTY+WS）新增（GPT Pro 建议，布偶猫验证）
2. **从 Day 1 底层就是 tmux**：不走"先纯 PTY 再叠 tmux"的绕路（P1 面向终态不绕路）
3. **workspace 级 tmux server**：一个 worktree = 一个 tmux server，不是 per-invocation
4. **plain WebSocket**：terminal 字节流用 `@fastify/websocket`，结构化事件继续用 socket.io
5. **macOS 优先**：进程监控用 pidtree/pidusage（跨平台），不用 Linux cgroup

## Dependencies

- Evolved from: **F063**（Workspace Explorer 提供了文件/tab 基础，Terminal 是自然延伸）
- Related: **F061**（CDP Bridge 的子进程管理、crash recovery 经验可复用）

## Risk

| 风险 | 缓解 |
|------|------|
| node-pty macOS 需要编译原生模块 | 确认 Xcode CLI tools |
| tmux control mode 解析复杂 | GPT Pro 给了详细协议说明 |
| terminal 安全 | 本地环境风险低；WS 路由加 session token 校验 |
| NDJSON 被 PTY ANSI 污染 | 双轨制已规避——机器轨永远走 pipe |

## Open Questions

1. tmux control mode 的解析库——自己写还是找现成的？
2. Phase 2 agent watch pane 里要不要做 ANSI → 结构化数据的解析（类似 F061 的 thinking 提取）？
3. 多 worktree 同时 active 时，tmux server 生命周期怎么回收？

## Review Gate

- Phase 1 完成后请 codex review（后端 + 安全）
- 前端 terminal UX 请 gemini 审美把关

## 需求点 Checklist

| # | 需求点 | 来源 | 状态 |
|---|--------|------|------|
| 1 | 浏览器内打开 terminal | 铲屎官 2026-03-08 | pending |
| 2 | 观察 agent 操作 | 铲屎官 2026-03-08 | pending |
| 3 | 崩溃现场保留 | 铲屎官 2026-03-08 | pending |
| 4 | 手动接管 agent | 铲屎官 2026-03-08 | pending |
| 5 | 进程树可视化 | 铲屎官 2026-03-08 | pending |

## Timeline

| Date | Event |
|------|-------|
| 2026-03-08 | 铲屎官提出 terminal 需求 + tmux 集成想法 |
| 2026-03-08 | GPT Pro 咨询：双轨制架构 + 技术选型（Part 1-2） |
| 2026-03-08 | 布偶猫 codebase 验证 + 修正为面向终态直线版（Part 3） |
| 2026-03-09 | F089 正式立项 |
