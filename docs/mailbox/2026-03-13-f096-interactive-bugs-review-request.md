---
type: review-request
date: 2026-03-13
feature: F096
author: opus
reviewer: codex
branch: fix/f096-interactive-bugs
scope: full-audit
---

# Review Request: F096 Interactive Rich Blocks — 全量交互 Bug 审查

## What

F096 interactive rich blocks 的前端交互逻辑已经被铲屎官报了多轮 bug，每次零散修复都没改全。这次请做一次**全量交互 bug 审查**，不只看本次 diff，要看整个 `InteractiveBlock.tsx` + `InteractiveBlockGroup.tsx` + 相关组件的完整交互链路。

本次已修的点（`fix/f096-interactive-bugs` 分支，1 commit）：
- card-grid 点卡片不再直接发消息，改为两步交互（高亮 → 确认）
- 随机抽卡动画结束后只高亮，不自动发送，需要用户点确认

## Why

铲屎官原话："你这修了至少五次了，每次都不行，瞎修"。零散修不如一次全量扫。

## Original Requirements（铲屎官原话合集）

> "单选后我点击哪个单选的确认 这个消息直接发出去了！"
> "随机抽卡难道不是给我几个选项然后还有一个是随机抽卡 我随机了才是随机吗？"
> "我只确定了一项，你就让我发一条消息，这有问题吧？难道不是都选完一起提交吗？"
> "有其他想法，你得搞一个输入栏让我输，不然的话我有其他想法，你这让我闭嘴嘛？"
> "诈骗骗猫猫！你这个我点了提交之后切不到（别的选项）"

- 来源：cat-cafe thread 对话历史（多轮反馈，2026-03-09 ~ 2026-03-13）

**请对照上面的摘录判断交付物是否解决了铲屎官的问题。**

## Tradeoff

这次只修了 card-grid 的两步交互。其他已知问题（多 block auto-grouping 未生效、提交后不能改选等）尚未修，等 reviewer 全量扫完一起改。

## Open Questions（请 reviewer 重点关注）

1. **auto-grouping 是否生效**：同一消息多个 interactive block 应自动分组为 `InteractiveBlockGroup`，统一"全部提交"。铲屎官测试时每个 block 各自有确认按钮 → 没分组。查 `hasCustomInput` 条件是否过严、demo 发送时是否有非 interactive block 打断连续检测。
2. **提交后能否改选**：铲屎官说"点了提交之后切不到别的选项"，是 disabled 状态的问题还是 UX 预期不匹配？
3. **customInput 输入框**：有"其他想法"选项但没有输入框让用户打字的情况。
4. **select 单选确认流程**：铲屎官说"想选宪宪点成了砚砚就发出去了"——select 的 handleClick 只设 pendingId，handleSubmit 才发送，confirm 按钮在 `!hideSubmit && pendingId` 时显示。请验证这条链路在 standalone 和 group 模式下是否都正确。
5. **confirm 类型的交互**：点确认/取消直接发送是否合理？还是应该也有二次确认？
6. **整体 UX 一致性**：4 种 interactiveType（select/multi-select/card-grid/confirm）的交互模式是否统一？

## Next Action

请 @codex 做全量代码审查：
1. 读 `packages/web/src/components/rich/InteractiveBlock.tsx`（完整文件）
2. 读 `packages/web/src/components/rich/InteractiveBlockGroup.tsx`
3. 读 `packages/web/src/components/rich/RichBlocks.tsx`（groupBlocks 逻辑）
4. 对照铲屎官原话，逐条验证交互链路
5. 跑定向测试：`pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/interactive-block`
6. 给出所有 bug 的完整列表（含 P 级、文件行号、复现步骤）

## 自检证据

### 测试结果
```
pnpm --filter @cat-cafe/web exec vitest run interactive-block  # 22 passed, 0 failed
pnpm biome check InteractiveBlock.tsx                          # 0 errors
```

### 相关文件
- Feature spec: `docs/features/F096-interactive-rich-blocks.md`
- 前端组件: `packages/web/src/components/rich/InteractiveBlock.tsx`
- 分组组件: `packages/web/src/components/rich/InteractiveBlockGroup.tsx`
- 路由渲染: `packages/web/src/components/rich/RichBlocks.tsx`
- 分支: `fix/f096-interactive-bugs`（基于 main `b9814383`）
