# Review Request: feat(F063) — Markdown 一等公民：图片 + 任务列表 + h4-h6

## What

Workspace 渲染模式下 markdown 能力补全：
- `MarkdownContent.tsx`: 新增 h4-h6 样式、task list checkbox 渲染（`li` + `input` overrides）、`worktreeId` prop
- `workspace-md-components.tsx`（新文件）: 提取 workspace 专用的 `img` 和 `a` 组件工厂，图片相对路径通过 `/api/workspace/file/raw` 解析
- `WorkspacePanel.tsx`: 传递 `worktreeId` 给 MarkdownContent
- 10 个新测试覆盖图片解析、任务列表、标题渲染

## Why

铲屎官反馈 markdown 渲染模式看不到图片，进一步要求"markdown 能力全面支持——AI 原生时代 md 是一等公民"。

## Original Requirements（必填）
> "我突然想起来个事情 我们的 md 这个渲染模式下看不到图片，想要支持能够看到图片可能吗？"
> "我感觉最好 比如说人家支持的 markdown能力我们得支持上的？ 现在md和代码一样是一等公民了 ai 原生时代"
- 来源：铲屎官 2026-03-27 对话消息
- **请对照上面的摘录判断：图片渲染 + 任务列表 + 小标题是否满足铲屎官要求**

## Tradeoff

- 图片解析在 component factory 里做（而非 remark plugin）——更简单，不需要额外 remark 依赖
- 提取 `workspace-md-components.tsx` 是因为 MarkdownContent 已接近 350 行硬限
- 未加 math/mermaid 支持——铲屎官没提，后续按需

## Open Questions

1. 图片加载失败时是否需要 fallback UI（当前是浏览器默认 broken image icon）？
2. task list checkbox 用 readOnly 不可交互——这是 workspace 预览模式的正确行为吗？
3. `withMentions` 作为参数传给 link factory 是否合理？（为了避免循环依赖）

## Next Action

Review-Target-ID: `md-image-rendering`
Branch: `fix/md-image-rendering`

请重点关注：
- 图片路径解析是否覆盖所有 edge case（绝对 URL、相对路径、parent traversal）
- task list 样式是否破坏普通 list 渲染
- 新文件 `workspace-md-components.tsx` 的职责边界

## 自检证据

### Spec 合规
- 图片渲染：✅ 相对路径 → workspace API URL
- 任务列表：✅ GFM checkbox 可视化
- 小标题：✅ h4-h6 有专门样式

### 测试结果
pnpm --filter @cat-cafe/web test     # 1737 passed, 0 failed ✅
pnpm lint (tsc --noEmit)             # 0 errors ✅
pnpm check (biome)                   # 0 new errors ✅
Line count: MarkdownContent 320 / workspace-md-components 50

### 相关文档
- Feature: F063 `docs/features/F063-hub-workspace-explorer.md`
