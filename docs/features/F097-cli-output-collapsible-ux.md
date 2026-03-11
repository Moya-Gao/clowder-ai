---
feature_ids: [F097]
related_features: [F009, F056, F081, F071, F096]
topics: [ux, frontend, chat-bubble, collapsible, cli-output, tool-events]
doc_kind: spec
created: 2026-03-11
---

# F097: CLI Output Collapsible UX — 聊天气泡折叠式重构

> **Status**: in-progress | **Owner**: 布偶猫 | **Priority**: P1

## Why

铲屎官原话（2026-03-11）：

> "我们的气泡 UX 我想优化一下，我们能做到 Claude Code 的那个动画效果吗？就是使用 tools 的时候他会展开，然后这个 tool 调用完收起来。一个大气泡这里心里话改成 CLI 输出？... 然后这个 CLI 输出里嵌套 tools 和你的回答，好像会更清晰知道你们在干啥"

当前问题：
1. **"心里话"命名误导** — `💭 心里话` 实际是 CLI stdout 输出，不是猫的内心独白（`🧠 Thinking` 才是推理）
2. **信息层级平铺** — tool 调用、CLI 输出、正文回复平级展示，用户难以区分"猫在做什么"vs"猫想说什么"
3. **信息密度过高** — 长对话中每条消息都完全展开，视觉噪音大

## What

### Phase A: CLI Output Block 重构

将现有的 `ToolEventsPanel` + `ThinkingContent`（origin='stream'）合并为统一的 **CLI Output Block**，新组件 `CliOutputBlock.tsx`。

**🏠 家规 P1 — 终态基座设计**：

CliOutputBlock 接口面向最终形态，接受统一的 `CliEvent[]` 时序流：

```typescript
interface CliEvent {
  id: string;
  kind: 'tool_use' | 'tool_result' | 'text' | 'error';
  timestamp: number;
  label?: string;
  detail?: string;
  content?: string;
}
```

- **Phase A**：前端做数据适配（`toolEvents[]` → `CliEvent[]`，`content` 整块追加为 `text` 事件），渲染结果是"tools 在上、stdout 在下"——但这是数据顺序的结果，不是硬编码布局
- **Phase B**：后端直推 `cliEvents[]` 时，前端换数据源，**组件零改动**
- CliOutputBlock 不关心 events 来自一条 message 还是多条（为 Phase B cluster 预留）

**⚠️ 硬边界（Design Gate 讨论确认）**：
1. **Phase A 不做时序穿插** — `ToolEvent` 只有 `timestamp/label/detail`，`message.content` 是整块 stdout，没有分段事件流。Phase A 前端适配为 `CliEvent[]`，但粒度仍是"N 个 tool + 1 个 text block"
2. **Phase A 不合并 callback + stream** — 现在这两者是独立 message，callback 没有 `invocationId` 关联键。Phase A 保持两条 message 各自渲染（但 CliOutputBlock 接口已预留合并能力）
3. **可见性不复用 whisper** — `whisper` 是消息级，CLI 可见性是 thread 级 `thinkingMode`，层级不同不能混

**布局变化**：

```
Before:                              After:
┌─ ChatMessage ─────────────┐      ┌─ ChatMessage ──────────────────────┐
│ [8个工具调用 ▼]           │      │ 正文回复（面向用户的最终输出）      │
│ [💭 心里话 ▶]             │      │                                    │
│ [🧠 Thinking ▶]           │      │ ┌─ CLI 输出 · 已完成 · 6 tools ─▼─┐│
│ 正文回复                   │      │ │ bg-gray-850 monospace            ││
│                            │      │ │ 🔧 Read  src/index.ts       [▶] ││
└────────────────────────────┘      │ │ 🔧 Bash  pnpm test  ✅ 12p [▶] ││
                                    │ │ 🔧 Edit  ChatMessage.tsx    [▶] ││
                                    │ │ ─── stdout ──────────────────── ││
                                    │ │ Let me check the structure...   ││
                                    │ │ Tests pass. Refactoring...      ││
                                    │ │              共享给其他猫 👁     ││
                                    │ └──────────────────────────────────┘│
                                    │ [🧠 Thinking ▶ Reviewing the...]  │
                                    └────────────────────────────────────┘

折叠态：
┌─ ChatMessage ──────────────────────────────────────┐
│ 正文回复                                            │
│ [CLI 输出 · 已完成 · 6 tools · 2m15s  👁 ▶]       │
└────────────────────────────────────────────────────┘
```

**视觉风格**（Opus + GPT-5.4 共识）：
- **外层 bubble**：保留猫种气质（ragdoll 紫调、maine-coon 绿调等）
- **内层 CLI block**：深色 terminal substrate（`bg-gray-800/900 text-gray-100`）
- **品种色**：仅用于 header pill / active border / focus ring
- **CLI 文本**：monospace / plain-text，不走 markdown 渲染
- **A2A**：共享 chevron + 动画 + summary row 交互语法，但保留独立视觉皮肤（不伪装 terminal）

**摘要行规范**：

| 状态 | 文案 |
|------|------|
| `进行中` | `CLI 输出 · 进行中 · {lastToolName}...` |
| `已完成`（有 tools） | `CLI 输出 · 已完成 · {N} tools · {duration}` |
| `已完成`（无 tools） | `CLI 输出 · 已完成 · {N} lines · {duration}` |
| `失败` | `CLI 输出 · 失败 · {lastToolName}` |
| `已中断` | `CLI 输出 · 已中断 · {N} tools` |

**状态枚举**：`进行中 | 已完成 | 失败 | 已中断`（摘要行、active row 高亮、auto-collapse 条件共用）

**可见性 chip**（遵循 F056 猫猫设计语言）：
- 来源：thread `thinkingMode`（不是 `message.whisper`）
- 规则：
  - `thinkingMode = shared` → `共享给其他猫` + 猫爪 SVG icon（表示"其他猫能看到"）
  - `thinkingMode = private`（或未设置）→ `不共享给其他猫`（低调灰文本，无特殊 icon）
- **图标规范**：全部使用 SVG icon，禁止 emoji（F056 KD-8 + 四大宪章"猫咖隐喻：不堆砌猫 emoji"）
  - Tool 行前缀：Lucide `wrench` SVG（替代 🔧 emoji）
  - 状态完成：Lucide `check` SVG（替代 ✓/✅ 文本）
  - 折叠箭头：Lucide `chevron-right` / `chevron-down`（替代 ▶/▼ 文本）
  - 共享可见性：猫爪 SVG（F056 Paw Pads 设计语言）
- 位置：header / collapsed summary 行（收起后也必须可见），不放 panel 内右下角
- 若消息本身是 whisper → 单独挂 `悄悄话` badge，不与可见性 chip 合并

**交互行为**：
- **正在执行时**（`进行中`）：CLI Output Block 自动展开，最新 tool call 高亮
- **执行完毕 / 下一条消息到达**：只自动收起"系统展开且用户没手动操作过"的 block
- **用户手动展开过**：不受 auto-collapse 影响（`userInteracted` flag）
- **每个 tool call**：独立可折叠，展开显示输入/输出详情
- **🧠 Thinking**：保持独立折叠区块，不混入 CLI Output Block
- **`?export=true`**：全部展开（复用现有 `expandInExport` 逻辑）

**Rename scope**：Phase A 只改 runtime chat UI（`ChatMessage.tsx` 及新建 `CliOutputBlock.tsx`）；`story-export`、课件、archive 里的"心里话"先不改，避免 scope 膨胀。

### Phase B: 消息聚合 + 时序穿插（可选，铲屎官确认后再做）

- **ChatContainer invocation cluster**：callback + stream 合并为一张卡（需要在 callback message 补 `invocationId` 关联键）
- **真时序穿插**：后端补统一 `cliEvents[]` 数据模型，前端按时间轴渲染 tool + text 交替
- **折叠/展开动画**：height transition + opacity fade（≤300ms）

## Acceptance Criteria

### Phase A（CLI Output Block）✅ — PR #372, 2026-03-11
- [x] AC-A1: `💭 心里话`（origin='stream'）重命名为 `CLI 输出`，嵌入 CliOutputBlock
- [x] AC-A2: `ToolEventsPanel` 的 tool events 嵌入 CliOutputBlock，每个 tool 可独立折叠
- [x] AC-A3: `🧠 Thinking` 保持独立，不混入 CLI Output Block
- [x] AC-A4: 摘要行按状态枚举显示（进行中/已完成/失败/已中断），含 tool count 或 line count + duration
- [x] AC-A5: 可见性 chip 在 header/summary 行正确显示（来源 thinkingMode，不是 whisper）
- [x] AC-A6: 自动收起仅作用于"系统展开且用户未手动操作"的 block
- [x] AC-A7: `?export=true` 时全部展开；用户手动展开过的 block 不受 auto-collapse 影响
- [x] AC-A8: 内层 CLI block 用深色 terminal substrate + monospace，外层保留品种配色
- [x] AC-A9: Rename scope 限于 runtime chat UI，不改 story-export/课件/archive
- [x] AC-A10: CliOutputBlock 接受 `CliEvent[]` 统一接口，Phase A 前端做适配层（toolEvents+content → CliEvent[]），Phase B 换数据源时组件零改动

### Phase B（消息聚合 + 时序穿插，可选）
- [ ] AC-B1: callback + stream 合并为同一张卡（ChatContainer cluster）
- [ ] AC-B2: 后端 `cliEvents[]` 数据模型支持真时序穿插
- [ ] AC-B3: 折叠/展开有平滑动画（≤300ms）

## Dependencies

- **Evolved from**: F009（tool_use/tool_result 显示）、F081（气泡连续性）
- **Related**: F056（猫猫设计语言 — icon/token 规范）、F071（UX debt batch）、F096（Interactive Rich Blocks）

## Risk

| 风险 | 缓解 |
|------|------|
| 折叠逻辑与 streaming 冲突 | streaming 时强制展开（`进行中`状态），完成后才允许折叠 |
| 现有 export 模式被破坏 | AC-A7: `?export=true` 全展开 |
| scope 膨胀（顺手改 archive/export） | AC-A9: Phase A 只改 runtime chat UI |
| tool count 双算 | 摘要行 deduplicate `tool_use`，只计唯一 tool 数 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| ~~OQ-1~~ | ~~CLI 输出的终端风格用黑底还是保持当前配色？~~ | ✅ 深色 substrate + 品种色 accent（KD-4） |
| ~~OQ-2~~ | ~~A2ACollapsible 是否也需要重构为类似风格？~~ | ✅ 共享交互语法，保留独立视觉（KD-5） |
| ~~OQ-3~~ | ~~摘要行显示什么信息？~~ | ✅ 按状态枚举 + tool/line count + duration（KD-6） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 💭心里话 → CLI 输出 | "心里话"误导，实际是 CLI stdout | 2026-03-11 |
| KD-2 | 🧠Thinking 保持独立 | Thinking 是推理过程，不是 CLI 输出 | 2026-03-11 |
| KD-3 | 纯前端改造，不改后端数据结构 | toolEvents/origin/thinking 数据已足够 | 2026-03-11 |
| KD-4 | 深色 terminal substrate + 品种色 accent | 内层"执行日志"一眼成立，外层保留猫种气质 | 2026-03-11 |
| KD-5 | A2A 共享交互语法，保留独立视觉 | A2A 是"内部讨论"不是"执行日志"，语义不同 | 2026-03-11 |
| KD-6 | 摘要行状态枚举：进行中/已完成/失败/已中断 | 统一摘要、高亮、auto-collapse 的状态源 | 2026-03-11 |
| KD-7 | 可见性来源 thinkingMode 不是 whisper | whisper 消息级 vs thinkingMode thread 级，层级不同 | 2026-03-11 |
| KD-8 | Phase A 不做时序穿插，不合并 callback+stream | 后端数据模型不支持，Phase B 再补 | 2026-03-11 |
| KD-9 | CliOutputBlock 接口面向终态（统一 CliEvent[] 时序流） | 家规 P1：终态基座不是脚手架。Phase A 前端适配，Phase B 零组件改动 | 2026-03-11 |
| KD-10 | 全部 SVG icon，禁止 emoji | F056 四大宪章"猫咖隐喻：不堆砌猫 emoji" + KD-8 禁硬编码。共享可见性用猫爪 SVG | 2026-03-11 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-11 | 立项，铲屎官提需求 |
| 2026-03-11 | Design Gate 讨论（Opus + GPT-5.4），收敛方案 |
| 2026-03-11 | Phase A merged (PR #372) — Codex local review + cloud review passed |

## Review Gate

- Phase A: 跨家族 review（@codex 或 @gpt52）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F009-tool-use-tool-result.md` | tool 事件显示基础 |
| **Feature** | `docs/features/F081-bubble-continuity-observability.md` | 气泡连续性 |
| **Component** | `packages/web/src/components/ChatMessage.tsx` | 主要改造目标 |
| **Design Discussion** | Thread `thread_mmlwht283o7j3tyk` 2026-03-11 | Opus + GPT-5.4 讨论记录 |
