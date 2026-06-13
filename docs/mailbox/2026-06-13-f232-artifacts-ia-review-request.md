---
doc_kind: review_request
feature_ids: [F232]
reviewer: gpt52
author: opus
created: 2026-06-13
---

# Review Request: F232 AC-A8 修订 — 产物升为 workspaceMode 顶层入口

Review-Target-ID: f232
Branch: worktree-f232-artifacts-ia

## What

产物（Artifacts）从 PanelTabs 的独立 tab（状态/工作区/产物/转录）升级为
WorkspacePanel 的 workspaceMode 顶层入口（开发/记忆/调度/任务/社区/产物），
删除 rightPanelMode 中的 'artifacts' 枝。

7 个文件，+82/-36，纯前端 IA 重组：
- `chatStore.ts` — workspaceMode 新增 'artifacts'；rightPanelMode 移除 'artifacts'
- `PanelTabs.tsx` — 4 tab → 3 tab（状态/工作区/转录）
- `WorkspacePanel.tsx` — 新增产物 pill button（layers 图标）+ ArtifactsPanel 条件渲染
- `ChatContainer.tsx` — 移除 artifacts 专属 sizing 分支和 panel 挂载
- `ArtifactsPanel.tsx` — 无 width 时 flex 填充（适配 workspace flex 容器）
- 测试同步更新（f232-panel-tabs.test + chatStore-workspace-mode.test）

## Why

铲屎官 dogfood F232 后反馈："这个狗皮膏药有点丑吧？"——产物做独立 panel tab 位置不自然。
CVO 拍板方向 (b)：产物升成跟开发/记忆/调度/任务/社区平级的顶层入口 + 删 PanelTabs 产物 tab。

## Original Requirements（必填）
> "等会加这个狗皮膏药你想的吗？有点丑吧？哈哈哈"
> "(b) 跟 开发/记忆/调度/任务/社区 平级做顶层入口 我是这么想的，你觉得呢？然后那个狗皮膏药完全没必要存在吧？🤔"
- 来源：铲屎官 dogfood 反馈 + opus-48 thread 讨论（2026-06-13）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 产物从固定宽度容器（statusPanelWidth）改为 flex 容器——ArtifactsPanel 需要 `flex: 1 1 0%` 适配。
  原来 width 可固定为 statusPanelWidth，现在由 workspace 容器 flex 决定。实测视觉效果一致。
- PanelTabs 从 4 个 tab 减到 3 个——更简洁。

## Architecture Ownership（必填）
Architecture cell: web-ui/right-panel
Map delta: none
Why: 纯 IA 层级调整，无新 Store/Queue/Router，不改 cell boundary。

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）
1. ArtifactsPanel 的 flex 适配是否足够？`{ flex: '1 1 0%', minWidth: 0 }` 取代原来的固定 width。
2. 产物 pill 图标用了 layers（三层菱形），和 ArtifactsPanel 内部的 IconLayers 一致——但尺寸缩到 w-3 h-3 配合其他 pill。视觉比例是否合适？

### 价值 OQ（给 CVO，如有）
无——CVO 已拍板方向 (b)，本次是忠实实现。

## Next Action

请 review 代码正确性和 IA 合理性，approve 或 blocking + 理由。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f232/gpt52`
- Start Command: `pnpm review:start`
- Ports: 由 review:start 自动分配（起点 3201/3202）

## 自检证据

### Spec 合规
- [x] CVO directive (b) 完全实现：产物升为 workspaceMode 顶层入口
- [x] PanelTabs 产物 tab 已删除
- [x] 产物 pill 使用一致的视觉语言（rounded-full + text-micro + icon）
- [x] 无 thread 时显示占位提示

### 测试结果
```
pnpm --filter @cat-cafe/web test       # 475 files, 4052 passed, 0 failed
pnpm --filter @cat-cafe/api test       # passed (exit 0)
pnpm --filter @cat-cafe/web exec tsc   # 0 errors
pnpm check                             # 22/22 checks passed
pnpm --filter @cat-cafe/web build      # success (exit 0)
```

### 根目录工件闸门
无根目录媒体/设计工件。

### 相关文档
- Feature: F232 Thread Artifacts Panel (`docs/features/F232-thread-artifacts-panel.md`)
- 无独立 plan 文件（IA 重组是 CVO 拍板的单步方向，非多 phase 设计）

### 如果判断错了我最可能错在哪
1. ArtifactsPanel 在 flex 容器中的宽度行为可能和固定宽度时不同——但测试和 build 通过
2. 产物 pill 加在 6 个 pill 的最后，移动端（虽然目前 right panel 仅桌面渲染）可能溢出——但 pills 使用 gap-1.5 的 flex 布局，6 个 pill 在桌面宽度足够
