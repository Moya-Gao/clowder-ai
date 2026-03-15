# Review Request: F101 Phase D — 狼人杀重做

## What

基于铲屎官 1v1 采访定案，重做狼人杀游戏引擎和 UI。8 个 Task，9 个 commits，28 个测试。

核心变更：
- **后端**：GameRuntime `paused` 状态、god actions API (pause/resume/skip)、独立游戏 thread（`games/werewolf` projectPath）、游戏结算统计 + MVP 计算、AutoPlayer 生命周期修正
- **前端**：GameResultScreen（结算画面）、GodInspector 操控按钮、PlayerGrid ready/loading 状态

## Why

Phase A-C 的实现被铲屎官实际体验后发现不可用（LL-032：92 个测试全绿但零 E2E 验证）。Phase D 是基于铲屎官采访的 6 个关键决策的重做。

## Original Requirements（必填）

> R11: "新建独立 thread，类似新手训练营那样独立"
> R13: "发牌✅ 暂停✅ 踢人❌ 跳过超时✅"
> R14: "展示真实状态，不是假动画"
> R16: "要战绩统计 + MVP"

- 来源：`docs/features/F101-mode-v2-game-engine.md` Phase D 节 + `docs/plans/2026-03-14-f101-phase-d-werewolf-redo.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- D5（狼人猫猫风视觉资产）本次只做深色主题框架，完整视觉需暹罗猫参与
- `useGodActions` hook 未独立提取，god action 回调直接通过 prop chain 传递（简单够用）
- 发牌按钮未实现（需要 lobby UI 选角色流程，scope 外）

## Open Questions

1. `messages.ts` 的 `/game` 拦截器改动较大 — 请重点审查独立 thread 创建逻辑
2. `GameStatsRecorder.extractDetailedStats()` MVP 算分公式是否合理？（当前：`killCount + savedCount * 2 + divineCount`）
3. 前端无 E2E 测试 — 需要铲屎官实际启动验证（LL-032 教训）

## Next Action

请 @codex review 代码质量 + spec 合规。分支：`feat/f101-phase-d`。

## 自检证据

### Spec 合规

| AC | 状态 | 说明 |
|----|------|------|
| AC-D1 | ✅ | 独立 thread + `games/werewolf` projectPath |
| AC-D2 | ✅ | KD-14 已满足，无需改动 |
| AC-D3 | ✅ | pause/resume/skip API + GodInspector 按钮 |
| AC-D4 | ✅ | `deriveSeatStatus()` 展示 ready/loading |
| AC-D5 | ⚠️ | 深色主题框架就位；视觉资产待暹罗猫 |
| AC-D6 | ✅ | GameResultScreen + MVP 计算 |

### 测试结果

```
Backend (node --test): 22 passed, 0 failed ✅
Frontend (vitest):     11 passed, 0 failed ✅
pnpm check:            0 biome errors ✅
pnpm lint:             0 errors ✅
pnpm build:            exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-14-f101-phase-d-werewolf-redo.md`
- Feature: `docs/features/F101-mode-v2-game-engine.md`
