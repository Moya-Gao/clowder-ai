# Review Request: F063 搜索结果点击后自动展开文件树

## What
在 WorkspacePanel 添加 `revealInTree()` 函数，搜索结果点击时自动展开目标文件的所有祖先目录。

## Why
铲屎官反馈：搜索文件点击打开后，文件树没有展开到对应位置，找文件不方便。

## Original Requirements（必填）
> 比如我搜了一个文件点击开了！那个文件树能展开一下吗？ 不然找半天 哈哈哈
- 来源：thread 对话（2026-03-12 01:45 铲屎官）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
只在搜索结果点击时触发 reveal，不在 tab 切换时触发（tab 切换是已打开的文件，不需要 reveal）。

## Open Questions
无

## Next Action
请 review 代码，确认无问题后放行。

## 自检证据

### Spec 合规
- 搜索点击后 → 祖先目录全展开 ✅
- 懒加载目录自动 fetchSubtree ✅

### 测试结果
- workspace-panel-reveal-in-tree.test.ts: 1/1 passed ✅
- pnpm lint: 0 errors ✅

### 相关文档
- Feature: F063 / hub-workspace-explorer
- 改动文件: `packages/web/src/components/WorkspacePanel.tsx:221-244`
