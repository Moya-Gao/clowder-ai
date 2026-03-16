# Review Request: F101 Phase F — Core Gameplay Fixes

## What

9 commits on `feat/f101-gameplay-fixes`，解决铲屎官实测反馈的 4 类核心体验 bug：

1. **Types** — `ActionStatus` 5-state、`PendingAction`、`Ballot`、`Resolution` 数据模型（shared 包）
2. **Multi-wolf ballot** — 独立夜杀投票 + 多数票结算 + 平票 no_kill（WerewolfEngine）
3. **Action lifecycle** — `action.requested → action.submitted → action.timeout → action.fallback` 事件链 + Round 1 grace period（GameOrchestrator）
4. **God-view transparency** — revealPolicy 事件过滤 + god 看 per-seat actionStatus、player 只看 aggregate progress（GameViewBuilder）
5. **Day vote revision** — 改票 revision++ + lock + commit 机制 + 全员 commit 提前结束（WerewolfEngine）
6. **Early advance** — all-committed 检测 + wolf discussion phase scope（GameOrchestrator）
7. **Frontend** — PlayerGrid 三态指示器 + GodInspector 夜间 ballot panel（React）
8. **Integration tests** — 6 个端到端场景覆盖多狼投票→fallback→透明度

## Why

铲屎官 2026-03-16 实测发现的 4 类 P1 体验 bug。游戏能跑但体验差：god 看不到谁投了谁、行动状态不透明、慢猫卡住整局、多狼投票规则缺失。

## Original Requirements（必填）

> R18: "看不到他们投了谁"
> R19: "gemini 还没启动起来…30s到及时结束gemini还没行动整个游戏又卡了"
> R20: "太不透明了…真的有输出吗？几乎秒行动"
> R21: "到底我们现在是出bug了还是猫猫在吗了"
> R22: "票数一样就随机？可以一直改票？以timeout为准？全部commit？"

- 来源：`docs/features/F101-mode-v2-game-engine.md` L239-L243
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 保留 legacy `castVote`/`resolveVotes`/`setNightAction` 接口向后兼容，新逻辑走 Ballot 路径
- `revealPolicy` 三级（live/phase_end/game_end）而非更细粒度的 per-role reveal——够用且简单
- Grace period 只在 Round 1 生效（KD-28），不做通用 adaptive timeout——避免过度工程

## Open Questions

1. **Ballot `source` 字段**：目前支持 `player | llm | fallback | random`，是否需要更细的 fallback 来源追踪？
2. **Day vote lock 时机**：当前实现是玩家主动 lock，是否需要超时自动 lock？
3. **faction:wolf scope**：狼人讨论阶段的事件隔离是否足够严格？请重点审查 `GameViewBuilder.isVisible()` 的 faction scope 逻辑
4. **前端组件**：PlayerGrid 和 GodInspector 的纯函数已有 vitest 覆盖，但 JSX 渲染未做 Playwright 实测（需合入后在 alpha 环境验证）

## Next Action

请 @codex 做跨家族 code review，重点关注：
- Ballot/Resolution 数据模型是否健壮
- 信息隔离（player 不泄漏 seat-level detail at night）
- Fallback 逻辑的边界条件
- 向后兼容性

## 自检证据

### Spec 合规

| # | AC | 状态 | 代码位置 | 测试覆盖 |
|---|----|----|----------|----------|
| 1 | AC-F2: God-view 夜晚行动目标 | ✅ | GodInspector.tsx + GameViewBuilder.ts | god-inspector-night-panel.test.ts + game-view-builder-transparency.test.js |
| 2 | AC-F3: 三态 ActionStatus | ✅ | game.ts + PlayerGrid.tsx | game-types-phase-f.test.js + player-grid-action-status.test.ts |
| 3 | AC-F4: 多狼独立投票 | ✅ | WerewolfEngine.ts | werewolf-night-ballot.test.js |
| 4 | AC-F5: 白天改票+commit | ✅ | WerewolfEngine.ts | werewolf-day-vote.test.js |
| 5 | AC-F6: 超时 fallback | ✅ | GameOrchestrator.ts | game-orchestrator-fallback.test.js |
| 6 | AC-F7: Grace period | ✅ | GameOrchestrator.ts | game-orchestrator-fallback.test.js |
| 7 | AC-F8: God-view 清晰状态 | ✅ | GameViewBuilder.ts + PlayerGrid.tsx | game-view-builder-transparency.test.js |

### 测试结果

```
pnpm --filter @cat-cafe/api test  → 87 game tests passed, 0 failed ✅
pnpm --filter @cat-cafe/web test  → 97 tests passed, 0 failed ✅
pnpm check                       → 0 errors ✅
pnpm -r --if-present run build   → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-03-16-f101-phase-f-gameplay-core-fixes.md`
- Feature: `docs/features/F101-mode-v2-game-engine.md`
- KD decisions: KD-25 (multi-wolf), KD-26 (day vote public), KD-27 (wolf channel), KD-28 (grace period)

---
*[布偶猫🐾]*
