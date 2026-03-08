# Review Request: F063 Phase 2B — Resizable Split Panes + Auto-Open Workspace

## What

Phase 2B P0 功能增强（3 项）：
1. **P2B-1**: 文件名搜索模式 — Phase 1 已实现（searchMode toggle + backend `type: 'filename'`），无需额外代码
2. **P2B-2**: 消息路径点击 → workspace 面板自动打开 — `useEffect` 监听 `rightPanelMode` 变化，自动设置 `statusPanelOpen`
3. **P2B-3**: 可拖拽分栏比例调整 — `ResizeHandle` 组件 + 横向（聊天 vs workspace）和纵向（文件树 vs 文件查看器）两个方向

变更文件：
- `packages/web/src/components/workspace/ResizeHandle.tsx` (NEW, ~70 lines) — 通用拖拽分隔条
- `packages/web/src/components/ChatContainer.tsx` — 横向 resize + auto-open effect
- `packages/web/src/components/WorkspacePanel.tsx` — 纵向 resize + fragment fix
- `packages/web/src/components/workspace/WorkspaceTree.tsx` — 接受 `basisPct` prop

## Why

铲屎官 2026-03-06 反馈 Phase 2A 后的体验需求闭环：搜文件名导航、消息路径点击打开 workspace、三视图可调比例。

## Original Requirements（必填）
> "搜索我可以搜文件名吗？比如 贴他的相对路径帮我导航一下？甚至你们发的文本里的那些地址我点击 右边这里能打开吗？"
> "要允许我能够调整两个 的占比？或者说三个？ 聊天 然后文件系统 然后打开的文件 三个视图"
- 来源：thread 消息，铲屎官 2026-03-06 21:09 + 21:20
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- ResizeHandle 用原生 mousedown/mousemove/mouseup 而非 Framer Motion drag，保持轻量
- 最小/最大比例硬编码 20%/80%，未做可配置（YAGNI）
- 双击恢复默认值（横向 50%，纵向 40%），不记忆 localStorage（后续可加）

## Open Questions

1. ResizeHandle 的 hover/active 样式是否需要更明显的视觉反馈？
2. 触摸设备（iPad）的 touch 事件支持——目前只处理 mouse 事件，Phase 3 再加？

## Next Action

请 review 代码质量和 UX 合理性，特别关注：
- ResizeHandle 的事件监听是否有内存泄漏风险
- auto-open useEffect 是否有循环触发风险
- flexBasis 百分比方案是否有边界 case

## 自检证据

### Spec 合规
- AC-12 (文件名搜索): Phase 1 已实现 ✅
- AC-13 (消息路径点击自动打开): useEffect auto-open ✅
- AC-14 (可拖拽分栏): ResizeHandle 横+纵 ✅

### 测试结果
- `pnpm --filter @cat-cafe/api test` → 19 passed, 0 failed, 113 cancelled (pre-existing)
- `pnpm lint` → 0 errors
- `pnpm --filter @cat-cafe/web build` → exit 0

### 相关文档
- Feature: `docs/features/F063-hub-workspace-explorer.md`
- BACKLOG: F063
