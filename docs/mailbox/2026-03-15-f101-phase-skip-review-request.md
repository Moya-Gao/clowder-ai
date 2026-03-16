# Review Request: F101 auto-skip phases with no actors

## What

`GameOrchestrator.advancePhase` 新增 `skipEmptyPhases()` 循环：当阶段的 `actingRole` 在存活座位中不存在时，系统自动跳过该阶段。

改动文件（2 个）：
- `packages/api/src/domains/cats/services/game/GameOrchestrator.ts` — 新增 `skipEmptyPhases()` + 在 `startGame` 和 `advancePhase` 末尾调用
- `packages/api/test/game-orchestrator.test.js` — 2 个新测试（单阶段跳过 + 连续多阶段跳过）

## Why

铲屎官 alpha 实测 8 人局（无守卫角色），游戏卡死在 `night_guard` 阶段。根因：`GameAutoPlayer` 对无人可行动的 action phase 不触发超时推进，30 秒后倒计时归零但无猫入场。

按 KD-2（法官=纯代码 GameEngine），缺席角色的阶段应由系统（程序）自动跳过，不能让猫猫来处理。

## Original Requirements（必填）

> "guard不应该是让猫来担任吗？而是应该是系统来担任，要是程序，不能让由猫猫来来搞。"
> — 铲屎官 2026-03-15 23:41

- 来源：本 thread 对话（铲屎官 alpha 实测反馈）
- 关联：KD-2 "法官 = 纯代码 GameEngine，不用 LLM"
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择在 `advancePhase` 后做 loop-based skip（非递归），比在 AutoPlayer 里加 tick 更干净——引擎层面解决，不依赖 AutoPlayer 运行
- `phase_skip` 事件写入 eventLog 留审计痕迹（上帝面板可见）

## Open Questions

- `skipEmptyPhases` 的 safety bound 是 `phases.length`，理论上不可能死循环（每次推进至少前进一个 phase），但请 reviewer 确认边界
- 阶段跳过的 eventLog 格式（`phase_skip` + `skippedPhase` payload）是否合理

## Next Action

请 review 这个 1-commit 的 bug fix，确认无信息隔离/状态推进回归。

## 自检证据

### Spec 合规
- 愿景对照：铲屎官要求系统自动处理缺席角色 → `skipEmptyPhases` 在引擎层面解决 ✅
- 信息隔离：不涉及 GameViewBuilder 改动，RED-LINE 1-12 全绿 ✅
- 文件大小：GameOrchestrator.ts 316 行（<350 硬上限）✅

### 测试结果
- game-orchestrator: 12/12 pass（含 2 新测试）
- game-engine: 13/13 pass
- game-isolation: 12/12 pass
- game-auto-player-lifecycle: 2/2 pass
- game-win-condition + game-end-stats + game-pause: 9/9 pass
- pnpm build: 成功

### 相关文档
- Feature: F101 Mode v2 — `docs/features/F101-mode-v2-game-engine.md`
- 无独立 plan（单点 bug fix）
