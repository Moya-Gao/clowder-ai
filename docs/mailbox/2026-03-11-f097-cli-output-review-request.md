# Review Request: F097 CLI Output Collapsible UX — Phase A

## What
将聊天气泡中的 `ToolEventsPanel` + stream origin `ThinkingContent` 合并为统一的 **CliOutputBlock** 组件，dark terminal substrate 风格，折叠/展开交互。

核心变更：
- 新组件 `CliOutputBlock.tsx`：dark terminal substrate (`bg-[#1a1b26]`)，Lucide SVG icons，summary line + visibility chip
- 新适配器 `toCliEvents.ts`：`ToolEvent[] + stream content → CliEvent[]` 统一时序流
- `ThinkingContent.tsx` 抽取为独立组件（🧠 Thinking 与 CLI 输出分离）
- `ChatMessage.tsx` 重构：内容在上（结论先行）→ CLI block → Thinking

## Why
铲屎官要求参照 Claude Code / Codex CLI 的折叠式 tool call 交互模式，解决：
1. "心里话"命名误导（实际是 CLI stdout，不是内心独白）
2. 信息层级平铺（tool 调用、输出、正文回复难以区分）
3. 信息密度过高（长对话视觉噪音大）

## Original Requirements（必填）
> "我们的气泡 UX 我想优化一下，我们能做到 Claude Code 的那个动画效果吗？就是使用 tools 的时候他会展开，然后这个 tool 调用完收起来。一个大气泡这里心里话改成 CLI 输出？... 然后这个 CLI 输出里嵌套 tools 和你的回答，好像会更清晰知道你们在干啥"
- 来源：`docs/features/F097-cli-output-collapsible-ux.md` Why 部分
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- Phase A 只做前端适配，不做后端 `cliEvents[]` 数据模型（Phase B scope）
- 粒度限制：Phase A 是"N 个 tool + 1 个 text block"，不是真正的时序穿插（数据源限制）
- 终态基座设计（家规 P1）：`CliEvent[]` 接口面向最终形态，Phase B 换数据源时组件零改动

## Open Questions
1. CliOutputBlock 的 dark substrate 与各品种猫的气泡配色融合度——请关注视觉冲突
2. `useLayoutEffect` 的 `expanded` dep 用了 biome-ignore（intentional dispatch on toggle）——是否有更好写法
3. stream origin 消息的内容现在只在 CLI block 内展示，不再有 MarkdownContent 渲染——这是 spec 要求的行为，但请确认 UX 合理性

## Next Action
请 review 代码质量 + 愿景覆盖度，放行后我走 merge-gate。

## 自检证据

### Spec 合规
10 ACs 全部通过（AC-A1 ~ AC-A10），逐项验证：
| AC | 状态 | 代码位置 |
|----|------|----------|
| AC-A1 新组件 CliOutputBlock | ✅ | cli-output/CliOutputBlock.tsx |
| AC-A2 ToolEventsPanel 移除 | ✅ | ChatMessage.tsx 无旧组件引用 |
| AC-A3 🧠 Thinking 独立 | ✅ | ThinkingContent.tsx 独立组件 |
| AC-A4 Dark terminal substrate | ✅ | bg-[#1a1b26] |
| AC-A5 Summary line | ✅ | buildSummary() |
| AC-A6 Lucide SVG icons | ✅ | 5 inline SVG components |
| AC-A7 Visibility chip | ✅ | thinkingMode prop |
| AC-A8 内容在上 CLI 在下 | ✅ | ChatMessage render order |
| AC-A9 Streaming 自动展开 | ✅ | forceExpanded logic |
| AC-A10 CliEvent[] 终态接口 | ✅ | chat-types.ts + toCliEvents.ts |

### 测试结果
pnpm test → 1043 passed, 3 failed (pre-existing: mission-control-page, signal-inbox-view, useAgentMessages-web-search)
biome check (F097 files) → 0 errors
pnpm lint → 0 new errors (pre-existing only)

### 相关文档
- Feature: `docs/features/F097-cli-output-collapsible-ux.md`
- Plan: `docs/plans/2026-03-11-f097-cli-output-collapsible-ux.md`
- Design: `designs/F097-cli-output-collapsible-ux.pen`
