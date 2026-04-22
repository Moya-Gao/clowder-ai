---
feature_ids: [F172]
related_features: [F089, F097]
topics: [react, claude-api, tool-use, cli, standalone]
doc_kind: spec
created: 2026-04-22
---

# F172: Claude Code React Lite -- 简易 Claude Code React 复刻

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

> "来吧 设计一个简单 claude code 的 react，然后需要能够简单的调用工具比如 grep 等，然后实现 cli 的交互"

铲屎官想要一个独立的、轻量的 Claude Code Web 版本：用 React 实现 CLI 风格的对话交互，支持 Claude 调用工具（grep/read/write/bash），让用户在浏览器里体验类似 Claude Code 终端的工作流。

可以作为教学 demo（展示 Claude tool use 能力）、也可以作为轻量替代方案。

## What

### 架构概览

```
┌─────────────────────────────────────┐
│  React Frontend (Vite + TS)         │
│  ┌───────────────────────────────┐  │
│  │  Terminal-style Message List  │  │
│  │  - User messages              │  │
│  │  - Assistant messages         │  │
│  │  - Tool calls (collapsible)   │  │
│  ├───────────────────────────────┤  │
│  │  Input Bar (Ctrl+Enter send)  │  │
│  └───────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │ SSE stream
               ▼
┌─────────────────────────────────────┐
│  Node.js Backend (Express + TS)     │
│  ┌───────────────────────────────┐  │
│  │  /api/chat  (SSE endpoint)    │  │
│  │  - Anthropic Messages API     │  │
│  │  - Tool use agentic loop      │  │
│  ├───────────────────────────────┤  │
│  │  Tool Executors               │  │
│  │  - grep (ripgrep wrapper)     │  │
│  │  - read_file                  │  │
│  │  - write_file                 │  │
│  │  - bash (sandboxed)           │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Phase A: MVP -- 对话 + 工具调用

核心：能对话、能调工具、能看到工具调用过程。

**前端 (React + Vite + TypeScript)**
- Terminal 风格的消息列表（深色背景、等宽字体）
- 消息类型：user / assistant / tool_use / tool_result
- Tool call 展示：可折叠的工具调用块（工具名 + 输入 + 输出）
- 输入区：多行文本框，Ctrl+Enter 发送
- SSE 流式接收，逐 token 渲染 assistant 回复
- 基础 Markdown 渲染（代码块高亮）

**后端 (Node.js + Express + TypeScript)**
- `POST /api/chat`：接收 messages 数组，返回 SSE 流
- Anthropic Messages API 调用（streaming）
- Agentic tool loop：Claude 请求工具 → 执行 → 把结果喂回 → 继续生成
- 4 个内置工具：
  - `grep`: 正则搜索文件内容（底层调 ripgrep 或 Node grep）
  - `read_file`: 读取文件内容（带行号）
  - `write_file`: 写文件
  - `bash`: 执行 shell 命令（有 timeout + 目录限制）
- 工作目录配置：启动时指定 `--workdir`，工具操作限定在此目录

### Phase B: 体验增强

- 会话历史持久化（localStorage / SQLite）
- 文件树侧边栏（展示 workdir 结构）
- 工具调用耗时展示
- 中断生成（abort）
- 系统提示词自定义

## Acceptance Criteria

### Phase A（MVP）
- [ ] AC-A1: 浏览器打开后展示 terminal 风格对话界面，可发送消息
- [ ] AC-A2: Claude 回复通过 SSE 流式渲染，逐 token 显示
- [ ] AC-A3: Claude 调用 grep 工具时，UI 展示工具名 + 参数 + 执行结果（可折叠）
- [ ] AC-A4: Claude 调用 read_file 工具时，正确返回文件内容（带行号）
- [ ] AC-A5: Claude 调用 bash 工具时，执行命令并返回 stdout/stderr
- [ ] AC-A6: Agentic loop 正常工作——Claude 可以连续调用多个工具完成复合任务
- [ ] AC-A7: 工具操作限定在配置的 workdir 内，不可越权访问

### Phase B（体验增强）
- [ ] AC-B1: 对话历史可持久化，刷新后恢复
- [ ] AC-B2: 左侧文件树展示工作目录结构
- [ ] AC-B3: 可中断正在生成的回复

## Dependencies

- **Related**: F089（Hub Terminal -- 浏览器终端经验）
- **Related**: F097（CLI Output Collapsible UX -- 工具调用折叠交互）

## Risk

| 风险 | 缓解 |
|------|------|
| bash 工具安全风险（任意命令执行） | workdir 限制 + timeout + 命令黑名单 |
| SSE 流式传输中工具调用的序列化 | 明确事件协议：`text_delta` / `tool_use_start` / `tool_result` |
| 大文件读取导致上下文溢出 | read_file 加行数限制（默认 200 行） |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 独立项目 or cat-cafe monorepo 内的 package？ | 待铲屎官定 |
| OQ-2 | Phase B 是否需要？还是 MVP 即满足需求？ | 待铲屎官定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 前端用 Vite + React + TS | 最快启动、生态成熟、铲屎官熟悉的技术栈 | 2026-04-22 |
| KD-2 | 后端用 Express + Anthropic SDK | 轻量、SSE 原生支持、SDK 直接对接 Claude API | 2026-04-22 |
| KD-3 | SSE 而非 WebSocket | 单向流足够、实现简单、与 Anthropic streaming API 天然对齐 | 2026-04-22 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-22 | 立项 |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F089-hub-terminal-tmux.md` | 浏览器终端经验参考 |
| **Feature** | `docs/features/F097-cli-output-collapsible-ux.md` | 工具调用折叠 UX 参考 |
| **Research** | `docs/archive/2026-02/research/AI-Coding-Tools-research.md` | Claude Code/Codex/Gemini CLI 调研 |
