# Review Request: F063 Phase 2A Workspace UI Beautification

## What

Phase 1 的 WorkspacePanel 功能完整但"有点丑不够猫猫"（铲屎官原话）。Phase 2A 做了 8 项 UI 改进：

1. 拆分 488 行单体组件为 4 个文件（`workspace/FileIcons.tsx`, `WorkspaceTree.tsx`, `CodeViewer.tsx`, `WorkspacePanel.tsx`）
2. 文件类型彩色 badge 图标替换 emoji
3. 文件树 indent guide（竖线）+ hover 效果 + 展开动画
4. 搜索栏内嵌式重设计（大圆角 + focus ring + 关键词高亮）
5. 面板 slide-in 动画（Tailwind keyframes）
6. Worktree 指示器重设计（绿色圆点 + branch + SHA + 多 worktree 下拉）
7. 空状态（🐾 + 引导文字）+ 骨架屏 shimmer
8. CodeMirror 自定义 cafeTheme（Cat Café 色板：`#1E1E24` 底、`#815B5B` 行号、opus-primary 选中色）

全面使用 `owner-*` / `cafe-*` Tailwind tokens，与 Hub 其他面板风格统一。

## Why

铲屎官对 Phase 1 UI 不满意，要求参考 Claude.ai 和 Codex 应用的设计感。F063 spec `Phase 1 UI 改进需求` 列出 8 个具体问题 (U1-U8)，本次逐项解决。

## Original Requirements（必填）
> "Phase 1 UI 有点丑不够猫猫，感觉没有设计感"
> "可能需要去看看 claude app 和 codex app"
- 来源：铲屎官 2026-03-05 消息 + `docs/features/F063-hub-workspace-explorer.md` §Phase 1 UI 改进需求
- **请对照 U1-U8 判断改动是否解决了铲屎官的视觉体验问题**

## Tradeoff

- 选 Tailwind CSS keyframes 而非 Framer Motion：避免新依赖，slide-in/fade-in/shimmer 用纯 CSS 足够
- CodeMirror 自定义主题硬编码 hex 值（`#1E1E24`等）：CM6 theme API 不接受 CSS variables，用了和 CSS vars 相同的实际色值

## Open Questions

1. **indent guide 样式**：当前用 1px `owner-light/50` 竖线。深度 > 3 的可读性需实际浏览验证
2. **CodeMirror 选中色 opacity**：`rgba(155, 126, 189, 0.25)` — 是否在深色背景下足够明显？
3. **组件拆分粒度**：4 文件是否合理？FileIcons 只有 53 行，是否值得独立？（利：单一职责 + 可复用；弊：文件数增加）

## Next Action

请 review 以下 5 个文件的代码质量和设计语言一致性：
- `packages/web/src/components/WorkspacePanel.tsx`（290 行）
- `packages/web/src/components/workspace/CodeViewer.tsx`（77 行）
- `packages/web/src/components/workspace/FileIcons.tsx`（53 行）
- `packages/web/src/components/workspace/WorkspaceTree.tsx`（146 行）
- `packages/web/tailwind.config.js`（+15 行 keyframes/animations）

## 自检证据

### Spec 合规
U1-U8 全部解决（见 quality-gate report）：
- U1 文件树视觉层次 → P2A-1 (icons) + P2A-3 (indent guides) ✅
- U2 搜索栏 → P2A-4 (内嵌重设计) ✅
- U3 文件头 → P2A-8 (cafeTheme) ✅
- U4 设计语言 → P2A-2 (全面 owner-*/cafe-* 对齐) ✅
- U5 worktree 指示器 → P2A-6 (redesign) ✅
- U6 空状态 → P2A-7 (skeleton + 🐾) ✅
- U7 动画过渡 → P2A-5 (slide-in) + P2A-3 (fade-in) ✅
- U8 搜索结果 → P2A-4 (highlight + icon) ✅

### 测试结果
- `npx @biomejs/biome check` (4 workspace files) → 0 errors ✅
- `pnpm lint` → 0 errors (pre-existing warnings only) ✅
- `pnpm --filter @cat-cafe/web run build` → exit 0 ✅
- workspace security tests → 18/18 pass ✅
- API tests → 113 cancelled (pre-existing on main, not caused by our changes)

### 相关文档
- Spec: `docs/features/F063-hub-workspace-explorer.md`
- Feature: F063 / BACKLOG
- Branch: `feat/f063-phase2-ui` (worktree `cat-cafe-f063p2`)
