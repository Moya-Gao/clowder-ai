# Review Request: F058 Phase E — Mission Hub UX 收尾

## What
1. Mission Hub header 增加"← 返回"按钮（`Link href="/"`），用户可从 `/mission-hub` 返回对话页
2. 线程态势面板（ThreadSituationPanel）改进：
   - 无关联 thread 的 dispatched 项改为紧凑单行显示（dashed border 区分）
   - 列表区域加 `max-h-64 overflow-auto`，防止大量 dispatched 项撑开整个面板

## Why
铲屎官实测反馈：进入 Mission Hub 后无法返回（只能点 sidebar 其他 thread），且线程态势面板内容截断看不全。

## Original Requirements（必填）
> "这里还有点点问题！然后就是 从mission hub如何退出呢？ 现在是要点击另一个thread"
- 来源：铲屎官 2026-03-05 19:42 消息（附截图）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 返回按钮固定指向 `/`（首页），而非 `router.back()`——避免浏览器历史栈不确定性
- 线程态势面板 max-h-64（16rem=256px）是固定值，未做响应式——够用，不过度设计

## Open Questions
- 无关联 thread 的 dispatched 项是否应该隐藏（而非紧凑显示）？当前选择保留可见性

## Next Action
请 review 代码改动，确认 UX 改进合理。

## 自检证据

### Spec 合规
- AC-E1: back button 已加 ✅
- AC-E2: 紧凑显示 + 面板内滚动 ✅

### 测试结果
- pnpm --filter @cat-cafe/web test: 717 passed, 0 failed
- pnpm --filter @cat-cafe/web build: clean
- biome check on changed files: only pre-existing issues (cognitive complexity, noUnsafeFinally)

### 相关文档
- Feature: `docs/features/F058-mission-control-enhancements.md`
- 教训: `docs/stories/f058-grep-is-not-verification.md`
