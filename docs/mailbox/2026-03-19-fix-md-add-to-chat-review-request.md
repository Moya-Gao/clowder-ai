# Review Request: fix(F063) — Markdown Rendered 模式补全 Add to Chat

## What

`WorkspacePanel.tsx` 的 markdown 渲染模式（`MarkdownContent` 分支）缺少 "Add to Chat" 功能。JSON/TS/JS 等走 `CodeViewer` 的文件有此功能，但 `.md` 文件默认 `markdownRendered=true`，走的是 `MarkdownContent` 渲染路径，没有选中文本 → 引用到聊天的能力。

改动（+47 行，1 文件）：
- 添加 `selectionchange` 事件监听，检测用户在渲染 markdown 容器内选中文本
- 选中后浮现 "Add to Chat" 按钮（样式/SVG icon 与 CodeViewer 完全一致）
- 点击后以 `` `path` ```markdown ... ``` `` 格式插入聊天
- `container.contains(sel.anchorNode)` 限定选中范围，防止误触

## Why

铲屎官在 Hub 里打开 md 文档（默认渲染模式），选中文本后没有 "Add to Chat" 按钮。必须手动切到 Raw 模式才能用。这违反了 F063 spec 的核心设计意图。

## Original Requirements（必填）
> "铲屎官在文件面板中选中代码 → 可直接引用到对话中问猫猫"
- 来源：`docs/features/F063-hub-workspace-explorer.md` Phase 1.4（L51）
- **请对照上面的摘录判断：渲染模式的 md 文件也属于"文件面板"，应有同样能力**

## Tradeoff

- 渲染模式用 `window.getSelection()` 取文本，无法像 CodeViewer（CodeMirror）那样精确到行号。引用格式用 `` `path` ``` markdown ``` `` 而非 `path:lineRange`
- 没有抽取共享组件（AddToChatButton），因为 CodeViewer 用 CodeMirror selection API，渲染模式用 DOM selection API，两者逻辑不同。SVG icon 直接内联（5 行），不值得为此加 export

## Open Questions

1. 渲染模式下按钮 `position: absolute top-2 right-3` — 当用户滚动 md 内容时按钮固定在容器顶部右侧，是否合理？（和 CodeViewer 行为一致）
2. 是否需要在渲染模式也显示行号/段落引用？（当前方案不含行号，后续可扩展）

## Next Action

Review-Target-ID: `fix-md-add-to-chat`
Branch: `fix/md-add-to-chat`

请 review 代码改动，特别关注：
- selectionchange 监听的性能影响（高频事件）
- container.contains 的边界 case

## 自检证据

### Spec 合规
- F063 L51 "文件面板选中 → 引用到对话"：✅ 渲染模式已补全
- 愿景覆盖：✅ 铲屎官的 md 文件（spec/plan/docs）可在渲染模式直接引用

### 测试结果
- `pnpm lint` → 0 errors ✅
- `tsc --noEmit` (web) → WorkspacePanel.tsx 0 errors ✅
- `pnpm check` → 10 format errors 全部 pre-existing（main 同数），本改动 0 新增 ✅
- `pnpm test` → mcp-server tool-registration failure pre-existing，本改动无关 ✅

### 相关文档
- Feature: F063 `docs/features/F063-hub-workspace-explorer.md`
- 无单独 Plan/ADR（bug fix 级别）
