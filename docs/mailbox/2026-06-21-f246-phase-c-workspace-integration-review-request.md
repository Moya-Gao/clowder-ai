---
title: "Review Request: F246 Phase C"
feature: F246
type: review-request
date: 2026-06-21
author: opus
---

# Review Request: F246 Phase C — Approval Hub workspace tab + responsive tab bar

Review-Target-ID: f246-phase-c
Branch: feat/f246-phase-c

## What

Approval Hub 从 drawer overlay 迁移到 workspace panel 顶层 tab，加上 workspace tab bar 响应式宽度适配。

核心变更（6 files, +387 lines）：
1. **chatStore** — WorkspaceMode union 扩展 `'approval'`
2. **ApprovalPanel** — 新组件，workspace 内嵌审批面板（复用 ApprovalItemCard + store）
3. **WorkspaceTabBar** — 新组件，ResizeObserver 驱动的三档响应式 tab bar（full/overflow/icon-only）+ active-in-overflow swap
4. **WorkspacePanel** — 硬编码 tab 按钮替换为 WorkspaceTabBar，routing 加 approval mode
5. **ActivityBar** — Bell 点击从"弹 drawer"改为"打开 workspace + 切 approval tab"（toggle 保留）
6. **AppShell** — 移除 ApprovalHubDrawer 渲染

## Why

CVO 指出 approval drawer 应该作为 workspace 的一个 tab 而非浮层，并要求 tab bar 按 workspace 宽度动态适配（7 个 tab 在窄 panel 下会挤）。

## Original Requirements（必填）
> "说实话你们的这个东西合适放在workspace这里"
> "铃铛必须在，不然我不知道到底有谁要我审批，但是点击的话那就是打开workspace - 审批就行了"
> "动态计算啊！！按照用户给workspace拉的宽度来匹配？你看现在如果我给这个workpsace 宽度很少就很难看也没展示全！"
- 来源：当前 session CVO 设计决策（2026-06-21），记录在 `docs/features/F246-approval-hub.md` Phase C section
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Tab 顺序：审批放最后（最新加入）。用户反馈后可调
- Overflow 优先级：按声明顺序从左到右保留，溢出从右截断。审批虽在最后但有铃铛常驻兜底
- ApprovalHubDrawer 未删除，标 deprecated + 注释，下个 PR 清理（避免同 PR 风险叠加）
- 未实现 AC-C8（Phase B residual P2 mention pruning）——属于 C3 成熟化范畴，非 CVO C1/C2 设计决策

## Architecture Ownership（必填）

Architecture cell: platform-infra (approval-index) + web-shell (workspace-panel)
Map delta: none
Why: 扩展现有 WorkspacePanel 路由 + chatStore WorkspaceMode union，不新增架构 cell

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **WorkspaceTabBar 常量**：`TAB_FULL_WIDTH=60` / `TAB_ICON_WIDTH=28` / `OVERFLOW_WIDTH=32` / `CONTAINER_PADDING=24` — 这些是基于现有 tab 按钮尺寸估算的。请 reviewer 在浏览器中验证三档切换的阈值是否合理
2. **Active-in-overflow swap**：当前选中 tab 在 overflow 中时，与最后一个可见 tab 交换位置。这保证 active tab 始终可见，但可能让 tab 顺序"跳"。请判断用户体感是否 OK
3. **Bell toggle 行为**：当前在 approval tab + workspace 打开时，再点 bell 会关闭 workspace（`setRightPanelMode('status')`）。这是保留快捷切换体感，但铲屎官可能更期望 bell 始终打开 approval tab

### 价值 OQ（给 CVO，如有）

无——所有设计决策已由 CVO 在本 session 确认

## Next Action

请 review AC-C1~C7 实现正确性 + 浏览器实测 tab 响应式行为。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f246-phase-c/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 由 review:start 自动分配（起点 3201/3202）

## 自检证据

### Spec 合规
AC-C1~C7 全部实现，逐条验证代码位置（见 quality gate report）。AC-C8 不在 PR scope（C3 成熟化）。

### 测试结果
```
pnpm test      → 17003 tests, 16989 pass, 1 pre-existing fail (ppt-forge, unrelated) ✅
pnpm lint      → 0 errors ✅
pnpm check     → 0 errors (biome + followup-tails + scripts-ascii) ✅
pnpm build     → exit 0 ✅
pnpm check:capability-tips → 11/11 pass ✅
```

### 相关文档
- Feature: `docs/features/F246-approval-hub.md` Phase C
- Plan: `docs/plans/2026-06-21-f246-phase-c-workspace-integration.md`

[宪宪/Opus 4.6🐾]
