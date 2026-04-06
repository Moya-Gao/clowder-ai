---
doc_kind: review-request
created: 2026-04-05
feature_ids: [F063]
topics: [workspace, focus-mode, ux]
---

# Review Request: Focus Mode UX 层级修复

## What

2 commits on `fix/focus-mode-ux`（4 files, +48 −34）：

1. **FocusModeButton 移位**：从 tab bar（与 view mode 同级）→ per-pane toolbar 行
   - 文件 viewer：toolbar 右侧（和 Copy/Path/Finder/编辑 同行）
   - 浏览器 pane：右上角浮层 overlay
2. **WorkspaceFocusShell 退出样式**：暗色 sticky header → 暖色调半透明浮标
   - `bg-cocreator-light/70 rounded-full backdrop-blur-sm shadow-sm`
3. **F063 spec 同步更新**：组件表 + UX 修复表 + 新增 UX R2 section

## Why

铲屎官视觉审查发现两个 UX 层级问题：
- 专注按钮和 view mode tabs 同级 → 用户困惑"这是第六个视图？"
- 退出专注暗色 header 与 Cat Cafe 暖色设计语言冲突

## Original Requirements（必填）

> "这个专注放在这个地方很突兀啊...他凭啥和其他的按钮一个级别呢？ux逻辑不对"
> "退出专注这个乌漆嘛黑的也很奇葩"
> "toolbar 行右侧（和 Copy/Path/Finder/编辑 同行）...用暖色调的半透明小浮标"

- 来源：铲屎官 2026-04-05 视觉审查（附截图指出问题位置）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

保留 FocusModeButton 独立组件而非内联到各 pane——浏览器 pane 仍用 FocusModeButton 浮层，文件 viewer 改用 ToolbarBtn 内联渲染（因为 toolbar 行已有统一 helper）。两种渲染路径是有意为之，匹配各 pane 的现有 UI pattern。

## Open Questions

1. 浏览器 pane 的浮层 FocusModeButton（`absolute top-2 right-2 z-10`）在内容很高时会不会被滚动遮挡？（当前 BrowserPanel 是 iframe 所以不会，但值得确认）
2. 退出浮标的 `cocreator-light/70` 透明度在深色背景内容上的可读性

## Next Action

请 review 代码 + UX 合理性。4 个文件改动量小，重点关注层级逻辑是否正确。

## 自检证据

### Spec 合规

quality-gate 通过（2026-04-05 16:26）：
- 愿景覆盖：铲屎官 2 个 P1 需求 → 全部实现
- AC-F1~F6：全部 ✅
- 设计稿对照：无 .pen 文件（⚠️ 铲屎官口头指导）

### 测试结果

```
pnpm --filter @cat-cafe/web test   # 271 files, 1932 passed, 0 failed ✅
pnpm lint                          # 0 errors ✅
pnpm check                         # 4/4 pass, 0 fail ✅
pnpm -r --if-present run build     # exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F063-hub-workspace-explorer.md` → Phase: Focus Mode + UX R2 section
- Intake ledger: `docs/ops/opensource-intake-ledger.json` (#362)

## Review 元数据

```
Review-Target-ID: focus-mode-ux
Branch: fix/focus-mode-ux
```
