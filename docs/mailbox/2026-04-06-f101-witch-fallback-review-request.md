# Review Request: F101 P0 witch fallback + briefing + stop feedback

Review-Target-ID: f101
Branch: fix/f101-witch-briefing-fallback
PR: #982

## What

4 fixes addressing 铲屎官 00:43 bug report:

1. **P0 fallback fix**: Non-wolf night roles (witch/seer/guard) now get `skip` fallback on timeout instead of random action — prevents system from randomly using witch potions
2. **P0 witch briefing**: Shows wolf kill target, potion state, and separate heal/poison/skip tool usage
3. **P1 game composition**: All briefings include player count + role breakdown ("板子")
4. **P2 stop button feedback**: Shows "停止中..." loading state after click

Files changed:
- `packages/shared/src/types/game.ts` — `fallbackSource` union + `'skip'`
- `packages/api/.../game/GameOrchestrator.ts` — `applyFallbacks()` skip for non-wolf
- `packages/api/.../game/briefing.ts` — `witchPotionState()`, `witchToolBlock()`, `gameComposition()` in all briefings
- `packages/web/.../game/GodInspector.tsx` — `stopping` state for stop button
- 2 test files updated

## Why

铲屎官实测发现女巫药被系统随机用、女巫不知道今晚谁死了、猫猫不知道板子、停止按钮没反馈。

## Original Requirements（必填）

> 1. 女巫的药能系统随机用？不应该。你应该告诉女巫他有什么药 今天晚上是谁死了！
> 2. 女巫为什么mcp使用失败了？
> 3. 所有猫猫应该知道现在几人局 什么板子
> — 铲屎官 2026-04-06 00:43

- 来源：铲屎官实时消息（游戏实测反馈）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Witch `skip` 没有定义为引擎 action（只在 fallback 路径使用），猫猫主动跳过靠"不提交等超时"。可以后续加 `skip` action 到定义。
- 女巫药水状态靠扫描 eventLog 推断（无 seat.properties 持久化），当前游戏规模下没有性能问题。

## Open Questions

1. `witchPotionState` 通过扫描 eventLog 判断是否用过解药/毒药。如果未来 eventLog 被裁剪，需要改为 seat.properties 持久化。
2. 板子信息现在在所有 briefing 中展示（buildFirstWakeBriefing 已有，新增到 buildResumeCapsule + buildRebriefing）。这是公开信息，但 reviewer 请确认信息隔离无泄露。

## Next Action

请 review PR #982，重点关注：fallback skip 路径、witch briefing 信息准确性、信息隔离。

## 自检证据

### Spec 合规
- ✅ 铲屎官报告的 3 个问题全部解决
- ✅ 停止按钮增加 UI 反馈

### 测试结果
- `game-briefing.test.js` — 12 passed, 0 failed
- `game-orchestrator-fallback.test.js` — 8 passed, 0 failed
- `game-orchestrator.test.js` — 14 passed, 0 failed
- `game-orchestrator-resolve-bridge.test.js` — 9 passed, 0 failed
- `game-e2e-narrator.test.js` — wolf briefing leak pass (1 pre-existing failure on main)
- `god-inspector-buttons.test.ts` — 4 passed (vitest)
- Web full suite — 1944 passed, 0 failed
- Biome check clean, TypeScript type check clean

### 相关文档
- Feature: F101 (Phase D/E — game engine)
- PR: #982
