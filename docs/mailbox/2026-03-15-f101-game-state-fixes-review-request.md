# Review Request: F101 三个 P1 游戏状态 bug 修复

## What
修复缅因猫(gpt52) 全量审查发现的 3 个 P1 bug：
1. **P1-1**: god-view/detective 观察者收不到 `game:state_update` — `broadcastGameState` 只遍历 `runtime.seats`，观察者不在 seats 中
2. **P1-2**: 倒计时显示固定值不会动 — `view.config.timeoutMs` 是常量，没有传递 `phaseStartedAt`
3. **P1-3**: 座位状态永远显示"等待" — `deriveSeatStatus` 没有 `hasActed` 信息

## Why
铲屎官在阿尔法环境实测发现游戏卡在"加载中"状态，所有座位显示"等待"，倒计时不动。gpt52 审计后确认了 3 个 P1 级别根因。

## Original Requirements（必填）
> 铲屎官："等待是个啥意思我要怎么知道他们跑起来没有啊？还是静默失败"
> 铲屎官："你这根本不会倒计时"
> 铲屎官："你全量审查一下和这个狼人杀有关的代码，看看它还有什么 bug，把它都抓出来"
- 来源：本次对话 2026-03-15
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- P2-1（清理双重游戏启动路径）和 P2-2（god timeline 用真实 pendingActions）暂不在本次修复范围，留给后续迭代

## Open Questions
1. `useCountdown` 的 `phaseStartedAt` 依赖触发了 biome `useExhaustiveDependencies` 警告 — 这是 reset-on-prop-change 模式的常见假阳性，请确认是否接受
2. `reconnectGame` 在 `ChatInput.tsx` 中的调用是否位置合理？（game start 成功后立即 hydrate game store）

## Next Action
请 @codex review 代码质量 + 逻辑正确性

## 自检证据

### Spec 合规
- 3 个 P1 bug 全部修复，根因对齐 gpt52 审计报告
- 改动范围：8 files, +60/-6 lines

### 测试结果
```
pnpm --filter @cat-cafe/shared build    # exit 0 ✅
API game tests (38 tests)               # 38 passed, 0 failed ✅
pnpm --filter @cat-cafe/web test game   # 187 passed, 2 failed (pre-existing on main) ✅
pnpm --filter @cat-cafe/web test        # 1314 passed, 101 failed (identical to main) ✅
biome check (changed files)             # 0 errors ✅
```

### 相关文档
- Feature: F101
- Branch: `feat/f101-game-state-fixes`
- Commit: `72fc8f70`
