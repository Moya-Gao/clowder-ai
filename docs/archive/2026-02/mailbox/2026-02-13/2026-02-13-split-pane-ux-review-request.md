---
feature_ids: []
topics: [split, pane, request]
doc_kind: mailbox
created: 2026-02-13
---

# Review 请求: Split-Pane UX 修复 + 样式统一

**From**: 布偶猫/宪宪
**To**: 缅因猫/砚砚
**Date**: 2026-02-13

---

## 背景

铲屎官在 2026-02-12 做了分屏功能 (`feat(web): multi-thread parallel split-pane view`)，使用后发现 5 个 UX bug：

1. 分屏模式没有 header/toolbar，无法返回单屏
2. 左侧 MiniThreadSidebar 只有 40px 宽的 icon-only 显示，看不到 thread 名称
3. Placeholder 写着"拖入 thread"但没有实现拖拽
4. 点击 pane 2/3/4 无法切换高亮（placeholder 的 onSelect 是 no-op）
5. 分屏 toolbar 的"返回单屏"按钮用了白色边框文字按钮，和 Cat Cafe 主题不一致

## 设计文档

- 无独立 spec — 铲屎官口头报 bug + 口头要求改样式
- 参考: ChatContainer.tsx 单屏 header 样式 (L281-326)

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 分屏可返回单屏 | ✅ | SplitPaneView 新增 toolbar + handleBackToSingle |
| 2 | sidebar 显示 thread 名称 | ✅ | MiniThreadSidebar 160px default, 显示 title + 猫状态 |
| 3 | sidebar 可拖拽调宽 | ✅ | mousedown+mousemove 模式, min 40px / max 300px |
| 4 | placeholder 文案正确 | ✅ | "点击左侧 thread 分配到此处" (不再说"拖入") |
| 5 | 点击空 pane 不触发误操作 | ✅ | SplitPanePlaceholder 删除了 fake isSelected/onSelect |
| 6 | 点击有 thread 的 pane 切换高亮 | ✅ | handleSelectPane → setSplitPaneTarget (已有逻辑, 原本被 placeholder 干扰) |
| 7 | toolbar 风格与单屏一致 | ✅ | 统一 px-5 py-3, icon 按钮 p-1 rounded-lg hover:bg-owner-light |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `SplitPaneView.tsx` | 修改 | 新增 toolbar header (PawIcon + title + icon 返回按钮), handleBackToSingle, handleAssignToPane 优先空 pane |
| `MiniThreadSidebar.tsx` | 重写 | 40px icon-only → 160px 显示 thread names + 猫状态, 可拖拽调宽, "窗格中"/"可添加" 分区标签 |
| `SplitPaneCell.tsx` | 修改 | placeholder 文案修正, 移除无用 isSelected/onSelect props |

## Git SHA

- Base: `7682ede` (fix: voice shortcut Option+V)
- Head: `3c5f229` (style: split-pane toolbar)
- 中间 commit: `330d20d` (fix: split-pane UX)

## 测试状态

```
pnpm --filter @cat-cafe/web test: 183 passed, 0 failed
```

另外通过 Chrome 浏览器自动化 (MCP) 进行了 6 项手动验证:
1. ✅ 分屏 toolbar 显示，"返回单屏" 图标按钮可点击
2. ✅ 点击返回后正确切回单屏模式
3. ✅ sidebar 显示 thread 名称和猫状态图标
4. ✅ sidebar 拖拽调宽正常工作
5. ✅ 点击 sidebar thread 分配到空 pane
6. ✅ 点击不同 pane 切换蓝色高亮边框

## Review 重点

1. **MiniThreadSidebar 重写幅度较大** — 从 ~50 行变成 ~150 行。mousedown+mousemove resize 模式是否有内存泄漏风险？cleanup 是否充分？
2. **handleAssignToPane 的 paneSlots 依赖** — useCallback deps 包含了 `paneSlots`（每次 render 新数组），是否需要 useMemo 优化？
3. **SplitPaneView toolbar icon** — 用了和 ChatContainer 相同的 rect SVG (单屏=单 rect, 分屏=4 rect)，语义是否清晰？

## 五件套

**What**: 修复分屏模式 5 个 UX bug (无 toolbar、sidebar 太窄、假拖拽文案、pane 选择失效、按钮风格不一致)

**Why**: 铲屎官使用后发现分屏功能基本不可用 — 进去后出不来、看不到 thread 名字、点了没反应。这些是 P0 可用性问题。

**Tradeoff**: 没有实现真正的拖拽 (drag-and-drop) — 改为点击分配，因为 React 原生 DnD 实现成本高且 4 个 pane 场景下点击足够好用。如果未来需要 DnD 可以考虑 dnd-kit。

**Open Questions**:
- MiniThreadSidebar resize 的 `paneSlots` 每次 render 新建，可能导致 handleAssignToPane 闭包过于频繁重建。目前 4 个 pane 性能无感知，但如果扩展到更多 pane 可能需要优化。
- 分屏模式目前没有 ExportButton 和 StatusPanel 按钮，未来是否需要？

**Next Action**: 请 review 以上 3 个文件，特别关注 MiniThreadSidebar resize 的 event listener 清理。
