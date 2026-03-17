---
type: review-request
date: 2026-03-16
feature: F101
phase: G
author: opus
reviewer: codex
branch: feat/f101-autoplay-recovery
---

# Review Request: F101 Phase G — AutoPlayer loop recovery + runtime logs

## What

3 个 AC，4 个文件改动 + 1 个测试文件：

- `GameAutoPlayer.ts`: +`recoverActiveGames()`, +`isLoopActive()`, +运行时日志（loop started/exited/tick/error）
- `IGameStore.ts`: +`listActiveGames()` 接口
- `RedisGameStore.ts`: +`listActiveGames()` 实现（`keys game:thread:*:active`）
- `index.ts`: API 启动后调用 `recoverActiveGames()` 恢复活跃游戏 loop

## Why

铲屎官 2026-03-16 实测发现"倒计时结束无事发生，所有猫猫等待中"。砚砚（GPT-5.4）+ 宪宪联合定位根因：

- `GameAutoPlayer.startLoop()` 是纯内存异步循环，只在创建游戏时挂一次
- API 进程退出后，Redis 里游戏状态还活着，但驱动循环丢失
- 前端倒计时是纯本地 `setInterval`，API 死了照样倒到 0

## Original Requirements（必填）

> 铲屎官："狼人杀这个现在还是倒计时结束无事发生所有猫猫等待中，这个 cli spawn 到底拉起来没有？"

- 来源：thread 对话 2026-03-16 18:48
- **请对照上面的摘录判断：API 重启后游戏是否能自动恢复推进**

## Tradeoff

- 用 `redis.keys('game:thread:*:active')` 而非 SCAN：数据量小（同时最多几个游戏），keys 更简单。如果未来游戏量大了再改 SCAN。
- Recovery 在 `app.listen()` 之后执行（跟 StartupReconciler 同一模式），不会阻塞服务启动。

## Open Questions

1. `listActiveGames` 返回包含 finished 状态的游戏（如果 `endGame` 没清 active key），`recoverActiveGames` 内部过滤了 `status === 'playing'`。这个防御够吗？
2. 新创建的 `GameAutoPlayer` 实例每次 recovery 是新的——如果 API 运行中也创建了（route handler 里 `new GameAutoPlayer`），loop 不会冲突（`activeLoops` Set 去重），但两个实例并存不够优雅。

## Next Action

请 review `feat/f101-autoplay-recovery` 分支，放行或退回。

## 自检证据

### Spec 合规
- AC-G1: `recoverActiveGames()` 扫描活跃游戏 ✅
- AC-G2: 运行时日志 `[GameAutoPlayer]` tag ✅
- AC-G3: 测试验证 recovery 启动 loop ✅

### 测试结果
- game-autoplay-recovery.test.js: 5/5 pass
- 全量游戏测试: 54/54 pass, 0 fail
- biome check (changed files): 0 errors
- build: exit 0

### 相关文档
- Feature: `docs/features/F101-mode-v2-game-engine.md` Phase G section
