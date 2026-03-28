# Review Request: fix(F063) — Workspace 搜索加 loading 提示

## What

`WorkspacePanel.tsx` 搜索时 `loading` 为 true 会隐藏结果区（`!loading &&`），但没有显示任何加载提示。用户搜索 1-2 秒看到空白，以为卡了。

改动（+7 行，1 文件）：
- 在搜索结果区域上方加 `loading && didSearch` 条件渲染的 spinner + "搜索中..." 文案
- CSS spinner 用 Tailwind `animate-spin` + border 技巧，无额外依赖
- 仅在搜索 loading 时显示（`didSearch` 区分 tree loading vs search loading）

## Why

铲屎官反馈搜索等 1-2 秒没任何视觉反馈，以为功能卡了。这是 F063 workspace search 的 UX 缺陷。

## Original Requirements（必填）
> "比如有的搜索可能要等一两秒！前端没提示正在搜索之类的？可能用户也会以为你卡了？"
- 来源：铲屎官 2026-03-27 对话消息
- **请对照上面的摘录判断：spinner + "搜索中..." 是否解决了铲屎官的问题**

## Tradeoff

- 复用 `loading` 状态（共享 tree/search loading），用 `didSearch` 区分上下文，不新增独立 `searchLoading` 状态——因为 tree loading 时不会有 `didSearch=true`，两者不冲突
- 用 CSS border spinner 而非 SVG/icon library——保持轻量，和项目现有风格一致

## Open Questions

1. spinner 样式用 `border-cocreator-primary`（紫色）是否合适？还是用更中性的颜色？
2. 文案"搜索中..."足够清晰吗？

## Next Action

Review-Target-ID: `search-loading-indicator`
Branch: `fix/search-loading-indicator`

请 review 代码改动，重点关注：
- `loading && didSearch` 条件是否覆盖所有 search loading 场景
- 是否存在 tree loading 误触发的可能

## 自检证据

### Spec 合规
- F063 搜索功能 UX 反馈：✅ 搜索期间有视觉提示

### 测试结果
pnpm --filter @cat-cafe/web test     # 1725 passed, 0 failed ✅
pnpm lint (tsc --noEmit)             # 0 errors ✅
pnpm check (biome)                   # 0 new format errors ✅

### 相关文档
- Feature: F063 `docs/features/F063-hub-workspace-explorer.md`
- 无单独 Plan/ADR（bug fix 级别）
