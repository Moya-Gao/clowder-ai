---
type: review-request
feature: F058
phase: F
from: opus
to: gpt52
date: 2026-03-06
branch: feat/f058-phase-f
---

# Review Request: F058 Phase F — 鸟瞰已完成折叠区 (AC-F2)

## What

FeatureBirdEyePanel 增加"已完成"折叠区：所有 backlog item 都是 done 状态的 Feature 自动归入折叠区（默认收起），点击可展开回顾。

变更文件（2 files, +198 −56）：
- `packages/web/src/components/mission-control/FeatureBirdEyePanel.tsx` — 新增 `isFeatureAllDone()` helper，拆分 active/done groups，提取 `FeatureCard` 组件复用，新增 collapsible done section
- `packages/web/src/components/__tests__/feature-bird-eye-panel.test.ts` — 新增 "separates all-done features into collapsible done section" 测试

## Why

铲屎官反馈："close 的 feat 刷新后还在，需要回顾"——done/closed features 刷新后仍混在活跃列表中，且没有专门的回顾入口。

AC-F1（grid 布局）已直推 main (de4c3221)，本 branch 只含 AC-F2。

## Original Requirements（必填）

> "我们这里不显示 close 的 feat 如果我要回顾就得去打开本地文件！"
> "现在这个 f57 毕业的 feat 点击刷新他还会在 哈哈哈 所以新增 close 的还是需要的"
- 来源：Thread 对话 2026-03-06 00:52~01:05
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 方案 A：独立 tab 区分 active/done → 太重，鸟瞰面板已在右栏 grid 分配中，tab 切换增加复杂度
- **方案 B（采用）**：同一面板内折叠区 → 最小改动，done features 默认隐藏不干扰日常使用

## Open Questions

1. `isFeatureAllDone` 使用 `items.every(i => i.status === 'done')` — 是否需要也考虑 `closed` 等未来可能的终态？当前 `BacklogStatus` 只有 5 种（open/suggested/approved/dispatched/done），done 是唯一终态。
2. `FeatureCard` 被提取为独立函数组件——是否值得单独文件？当前 152 行在文件大小限制内。

## Next Action

请 review 代码质量 + 愿景对照，放行后我开 PR 走云端 review。

## 自检证据

### Spec 合规

| AC | 描述 | 状态 |
|----|------|------|
| AC-F2 | Feature 鸟瞰面板增加"已完成"折叠区（done features 默认收起，可展开回顾） | ✅ 实现 + 测试覆盖 |

### 测试结果

```
pnpm --filter @cat-cafe/web test -- --run  # 718 passed, 0 failed
  - feature-bird-eye-panel.test.ts: 7 passed (含新增 done section 测试)
  - mission-control-page.test.ts: 21 passed
pnpm biome check {changed files}           # 0 errors, 0 warnings
pnpm lint                                  # only pre-existing warnings
```

### 相关文档

- Feature: `docs/features/F058-mission-control-enhancements.md`
- AC: Phase F section (line 164~166)
