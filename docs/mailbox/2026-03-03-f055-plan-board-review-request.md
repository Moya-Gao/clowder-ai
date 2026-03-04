---
feature_ids: [F055]
topics: [review-request, plan-board]
doc_kind: review-request
created: 2026-03-03
---

# Review Request: F055 猫猫祟祟 Plan Board

## What

新增独立的「猫猫祟祟」panel 到右侧状态栏，将 task progress 从"当前调用"解耦为每猫独立卡片。

核心改动：
- 新增 `PlanBoardPanel.tsx`（173 行）：每猫独立计划卡，running/interrupted/completed 三层分类
- 修改 `RightStatusPanel.tsx`：删除 `CatTaskProgress` 组件 + 集成新 panel
- 新增 9 条测试，更新 4 条现有测试

## Why

现有"当前调用"把路由意图（targetCats）和执行进度（task_progress）耦合。8 猫并发时计划串位/不刷新（F045 系列 bug 的根因）。铲屎官明确要求不做最小修复，新增独立板块。

## Original Requirements (铲屎官原话)

> "不要按着他的思路走去魔改当前调用的板块，而是和 session chain 类似新增一个 mission / plan 的板块，这样多少只猫不同的 plan 各自管各自的。我们现在可是有 8 只猫。不建议做最小，而是按照一个新的 feat 那样对齐需求搞。"
>
> "1A 2A 3 猫猫祟祟！猫猫祟祟执行计划嘛！更可爱！更猫猫！"

来源：Thread 对话历史 2026-03-03 21:01~21:03

请对照上面的摘录判断交付物是否解决了铲屎官的问题。

## Tradeoff

- 没有改后端/store/事件消费链路，纯前端展示层改动
- CatTaskProgress 从 CatInvocationCard 完全删除（而非保留双份），因为铲屎官要的是职责彻底分离
- completed 用折叠（而非淡化/隐藏），参照 SessionChainPanel 的 sealed sessions 模式

## Open Questions

1. PlanBoardPanel 放在消息统计和 SessionChainPanel 之间——位置是否合适？
2. 8 猫同时有计划时的紧凑度是否足够？（测试通过但无实际 UI 截图）
3. 是否需要"全部折叠/展开"按钮？当前只有 completed 折叠

## Next Action

请 review 代码质量、架构合理性、和铲屎官原始需求的覆盖度。

## 自检证据

### Spec 合规
- 10/10 AC 全覆盖（详见 quality-gate report）
- 铲屎官 4 条原始需求全覆盖

### 测试结果
```
pnpm --filter @cat-cafe/web test -- --run
→ 115 files, 697 passed, 0 failed ✅

pnpm lint
→ 0 errors (pre-existing warnings only) ✅

pnpm --filter @cat-cafe/web build
→ Next.js 14.2.35 production build, exit 0 ✅
```

### 相关文档
- Spec: `docs/features/F055-plan-board.md`
- Plan: `docs/plans/2026-03-03-f055-plan-board-impl.md`
- Evolved from: F045（PR #186/#187/#188/#191/#201）
