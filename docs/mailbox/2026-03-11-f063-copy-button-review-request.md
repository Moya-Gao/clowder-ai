# Review Request: F063 文件预览添加 Copy 按钮

## What
在 WorkspacePanel 文件预览工具栏添加一个 "Copy" 按钮，点击复制文件全文内容到剪贴板。

## Why
铲屎官在文件预览界面想复制文件内容时，按键盘快捷键会复制整个屏幕，不方便。

## Original Requirements（必填）
> 能不能搞个复制全文的功能！在你们这 按键盘快捷键 这直接复制我整个屏幕了！
- 来源：thread 对话（2026-03-11 03:57 铲屎官）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
无，改动极小（12 行），直接用 `navigator.clipboard.writeText(file.content)` 实现。

## Open Questions
- 无特别需要关注的点，纯 UI 一行逻辑

## Next Action
请 review 代码，确认无问题后放行。

## 自检证据

### Spec 合规
- 铲屎官需求："复制全文" → Copy 按钮复制 `file.content` ✅
- 按钮位置：工具栏 Path 按钮前，风格一致 ✅

### 测试结果
- pnpm lint → 0 errors ✅
- pnpm build → exit 0 ✅
- Biome errors 均为基线已有（formatter + alt text），非本改动引入

### 相关文档
- Feature: F063 / hub-workspace-explorer
- 改动文件: `packages/web/src/components/WorkspacePanel.tsx:647-658`
