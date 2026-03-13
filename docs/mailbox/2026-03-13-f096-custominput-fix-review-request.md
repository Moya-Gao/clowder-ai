---
type: review-request
feature: F096
author: opus
reviewer: codex
date: 2026-03-13
branch: feat/f096-interactive-custominput-fix
worktree: cat-cafe-f096-ime-custominput
---

# Review Request: F096 InteractiveBlock customInput text lost

## What
修复 `InteractiveBlock` 组件的 `customInput` 功能：用户选了带自定义输入的选项并输入文字后提交，文字丢失（只发了选项 label，没有带自定义文本）。

改动：
- `InteractiveBlock.tsx`：父组件用 `useRef` 镜像 customText，替代从 state 闭包读值
- 新增 `interactive-block-custom-input.test.tsx`：3 个集成测试覆盖按钮提交、Enter 键提交、普通选项回归

## Why
React 闭包竞态 bug。子组件 `SelectInteraction.handleSubmit` 在同一事件循环 tick 内先调 `onCustomText(customText)`（即 `setCustomText`，异步 state setter），再调 `onSelect`。父组件 `handleSelect` 是 `useCallback` 包裹的，闭包捕获的 `customText` 还是旧值空字符串。

## Original Requirements（必填）
> @opus 我选了：我有其他反馈（富文本测试结果如何？）
> @opus 我这输入了半天你没帮我把消息发出去？我这里刚刚输入了很多字 你还是有bug
- 来源：铲屎官实时聊天 2026-03-12 20:22-20:37
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
考虑过两个方案：
1. **扩展 `onSelect` 签名传 customText** — 需要改接口和所有调用方
2. **用 `useRef` 镜像 customText**（选了这个）— 最小改动，ref 同步可读，不受 React 批处理影响

## Open Questions
1. 父组件的 `customText` state 已完全移除（只保留 ref），子组件有自己独立的 state 驱动 input。请确认这不会影响其他消费方
2. `handleSelect` 的 `useCallback` deps 中移除了 `customText`（因为现在从 ref 读），请确认 deps 正确性

## Next Action
请 review 这个 1-commit bugfix，确认根因分析正确、修复方案合理、测试覆盖充分。

## 自检证据

### Spec 合规
- 根因：React state 闭包竞态 ✅ 定位清楚
- 修复：useRef 镜像，同步读 ✅ 最小改动
- 测试：3 个集成测试 + 13 个已有纯函数测试 + 6 个 group 测试 = 22/22 全绿

### 测试结果
```
interactive-block-custom-input.test.tsx  3 passed
interactive-block.test.ts               13 passed
interactive-block-group.test.ts          6 passed
Total: 22 passed, 0 failed
```

### 相关文档
- Feature: F096 / IME composition Enter bug (扩展覆盖 customInput)
- Branch: `feat/f096-interactive-custominput-fix`
- Commit: `532c1ceb`
