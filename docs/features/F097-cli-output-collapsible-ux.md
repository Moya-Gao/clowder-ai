---
feature_ids: [F097]
related_features: [F009, F081, F071, F096]
topics: [ux, frontend, chat-bubble, collapsible, cli-output, tool-events]
doc_kind: spec
created: 2026-03-11
---

# F097: CLI Output Collapsible UX — 聊天气泡折叠式重构

> **Status**: spec | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官原话（2026-03-11）：

> "我们的气泡 UX 我想优化一下，我们能做到 Claude Code 的那个动画效果吗？就是使用 tools 的时候他会展开，然后这个 tool 调用完收起来。一个大气泡这里心里话改成 CLI 输出？... 然后这个 CLI 输出里嵌套 tools 和你的回答，好像会更清晰知道你们在干啥"

当前问题：
1. **"心里话"命名误导** — `💭 心里话` 实际是 CLI stdout 输出，不是猫的内心独白（`🧠 Thinking` 才是推理）
2. **信息层级平铺** — tool 调用、CLI 输出、正文回复平级展示，用户难以区分"猫在做什么"vs"猫想说什么"
3. **信息密度过高** — 长对话中每条消息都完全展开，视觉噪音大

## What

### Phase A: CLI Output Block 重构

将现有的 `ToolEventsPanel` + `ThinkingContent`（origin='stream'）合并为统一的 **CLI Output Block**，采用类似 Claude Code / Codex CLI 的嵌套折叠交互。

**布局变化**：

```
Before:                          After:
┌─ ChatMessage ─────────┐      ┌─ ChatMessage ─────────┐
│ [8个工具调用 ▼]       │      │ 正文回复（面向用户）   │
│ [💭 心里话 ▶]         │      │                        │
│ [🧠 Thinking ▶]       │      │ ┌─ CLI 输出 ▼ ────────┐│
│ 正文回复               │      │ │ 🔧 Read index.ts  ▶ ││
│                        │      │ │ 💬 "看完了，测试.." ││
└────────────────────────┘      │ │ 🔧 Bash: pnpm test▶ ││
                                │ │ 💬 "全部通过"       ││
                                │ └────────────────────┘│
                                │ [🧠 Thinking ▶]       │
                                └────────────────────────┘
```

**交互行为**：
- **正在执行时**：CLI Output Block 自动展开，最新 tool call 高亮
- **执行完毕时**：自动收起为一行摘要 `CLI 输出 · 8 calls · 2m15s`
- **下一条消息到达时**：上一条的 CLI Output 自动折叠
- **每个 tool call**：独立可折叠，展开显示输入/输出详情
- **🧠 Thinking**：保持独立折叠区块（这是推理，不是 CLI 输出）

**可见性标签**：CLI Output 标题栏显示 `👁 全猫可见` / `🔒 仅铲屎官`（复用 `message.whisper` 字段）

### Phase B: 动画与过渡

- 折叠/展开动画（height transition + opacity fade）
- Tool call 执行中的 loading spinner
- 自动滚动：新 tool output 时 auto-scroll 到最新行

## Acceptance Criteria

### Phase A（CLI Output Block）
- [ ] AC-A1: `💭 心里话`（origin='stream'）重命名为 `CLI 输出`，嵌入 CLI Output Block
- [ ] AC-A2: `ToolEventsPanel` 的 tool events 嵌入 CLI Output Block，每个 tool 可独立折叠
- [ ] AC-A3: `🧠 Thinking` 保持独立，不混入 CLI Output Block
- [ ] AC-A4: CLI Output Block 在消息完成后自动折叠为摘要行
- [ ] AC-A5: 下一条消息到达时，上一条的 CLI Output 自动折叠
- [ ] AC-A6: 可见性标签在 CLI Output 标题栏正确显示

### Phase B（动画与过渡）
- [ ] AC-B1: 折叠/展开有平滑动画（≤300ms）
- [ ] AC-B2: 执行中的 tool call 显示 loading 状态
- [ ] AC-B3: 新 tool output 时自动滚动到最新

## Dependencies

- **Evolved from**: F009（tool_use/tool_result 显示）、F081（气泡连续性）
- **Related**: F071（UX debt batch）、F096（Interactive Rich Blocks）

## Risk

| 风险 | 缓解 |
|------|------|
| 折叠逻辑与 streaming 冲突 | streaming 时强制展开，完成后才允许折叠 |
| 现有 export 模式被破坏 | export=true 时全部展开（复用现有 expandInExport 逻辑） |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | CLI 输出的终端风格用黑底还是保持当前配色？ | ⬜ 待讨论 |
| OQ-2 | A2ACollapsible 是否也需要重构为类似风格？ | ⬜ 待讨论 |
| OQ-3 | 摘要行显示什么信息？（tool count / duration / 状态） | ⬜ 待讨论 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 💭心里话 → CLI 输出 | "心里话"误导，实际是 CLI stdout | 2026-03-11 |
| KD-2 | 🧠Thinking 保持独立 | Thinking 是推理过程，不是 CLI 输出 | 2026-03-11 |
| KD-3 | 纯前端改造，不改后端数据结构 | toolEvents/origin/thinking 数据已足够 | 2026-03-11 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-11 | 立项，铲屎官提需求 |

## Review Gate

- Phase A: 跨家族 review（@codex 或 @gpt52）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F009-tool-use-tool-result.md` | tool 事件显示基础 |
| **Feature** | `docs/features/F081-bubble-continuity-observability.md` | 气泡连续性 |
| **Component** | `packages/web/src/components/ChatMessage.tsx` | 主要改造目标 |
