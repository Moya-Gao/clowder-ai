# Review Request: F096 Interactive Rich Blocks

## What

在现有 Rich Block 架构上新增 `interactive` kind，支持 4 种交互类型（select / multi-select / card-grid / confirm）。用户点选后自动发送消息，block 状态（disabled + selectedIds）持久化到 `message.extra.rich`，刷新不丢。

核心变更：
- **shared**: `RichInteractiveBlock` + `InteractiveOption` 类型，`VALID_KINDS` 扩展
- **API**: Zod discriminated union 新分支，`isValidRichBlock` interactive case，`updateExtra` 方法 + PATCH `/api/messages/:id/block-state` endpoint
- **Web**: `InteractiveBlock.tsx` 组件（4 种子组件），chatStore `updateRichBlock` action，ChatContainer CustomEvent 监听，RichBlocks/ChatMessage prop 透传
- **Rules**: `rich-blocks.md` interactive 文档，`RICH_BLOCK_SHORT` 系统提示更新

## Why

铲屎官要求"弹出一个东西让我选和☑️"，Cat Café 有完整前端，交互能力远超 CLI。这是通用基础设施，服务 F087 训练营、CVO 决策、Review 投票等所有需要用户选择的场景。

## Original Requirements（必填）

> "我们能做成可交互的富文本！Claude Code 有那个啊！你弹出一个东西让我选和 ☑️！我们按道理有前端！难道不能吗？这样的富文本别的地方还能用？！"
> — 铲屎官 2026-03-11，F087 Design Gate 讨论

> "看看我们的家规... 每步产物是终态基座不是脚手架"
> — 铲屎官 2026-03-11，纠正 OQ-1 持久化决策

- 来源：`docs/features/F096-interactive-rich-blocks.md`（铲屎官原话 section）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **交互结果 = 自动发消息**（KD-1）：猫猫收到普通文字，零后端业务逻辑改动。放弃了"后端交互状态机"方案（过度工程）
- **CustomEvent 解耦**（KD-3）：InteractiveBlock 通过 `cat-cafe:interactive-send` 事件触发 ChatContainer 发送，避免 prop drilling。放弃了直接操作 chatStore 的方案（组件不应知道发送逻辑）
- **持久化到 message.extra.rich**（KD-4）：PATCH endpoint 直接更新 block 状态。放弃了"前端 only 状态"方案（铲屎官明确要求终态）

## Open Questions

1. **card-grid 随机动画的 UX**：用了 setInterval 减速闪烁（12 步，50ms+step*25ms），是否需要更精致的 easing？
2. **PATCH endpoint 无鉴权**：当前 block-state PATCH 不验证 userId，因为交互操作本身就是用户主动触发。是否需要加？
3. **前端无浏览器实测**：worktree 环境未启动服务，无截图证据。建议 reviewer 用 Playwright/Chrome 实测。

## Next Action

请 review 代码质量 + 架构合理性。重点关注：
- InteractiveBlock.tsx 组件设计（~370 行，是否需要拆分？）
- CustomEvent 解耦方案是否合理
- PATCH endpoint 安全性

## 自检证据

### Spec 合规
- AC-A1~A7 全部覆盖 ✅
- AC-B1~B2 全部覆盖 ✅
- Quality Gate 发现并修复了 `RICH_BLOCK_SHORT` 遗漏 interactive kind

### 测试结果
- Backend: `node --test test/rich-block-interactive.test.js` → 15/15 pass, 0 failed ✅
- Frontend: `pnpm --filter @cat-cafe/web test` → 1004/1007 pass (3 failures pre-existing on main) ✅
- shared build: exit 0 ✅
- API build: exit 0 ✅
- lint: 0 errors ✅
- SystemPromptBuilder size guard: all pass ✅

### 相关文档
- Plan: `docs/plans/2026-03-11-f096-interactive-rich-blocks.md`
- Feature: `docs/features/F096-interactive-rich-blocks.md`
- Rules: `cat-cafe-skills/refs/rich-blocks.md`

### Commits (8)
```
806d7006 feat(F096): add RichInteractiveBlock type + normalizeRichBlock support
01ee637e feat(F096): add interactive block Zod schema + isValidRichBlock support
93a056ff feat(F096): add updateExtra + PATCH /api/messages/:id/block-state endpoint
a1ca0d8d feat(F096): InteractiveBlock component with 4 interaction types
d12a7d09 feat(F096): integrate InteractiveBlock into RichBlocks + chatStore + ChatContainer
66355dce docs(F096): update rich-blocks rules + cc_rich extraction tests for interactive
bcbcd3bd style(F096): biome auto-format + feature doc KD-4/KD-5 decisions
d59de44c fix(F096): add interactive kind to RICH_BLOCK_SHORT system prompt
```
