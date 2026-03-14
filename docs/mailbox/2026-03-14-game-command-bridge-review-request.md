# Review Request: fix(F101) /game 命令拦截器 — 打通命令→游戏启动桥梁

## What

在 `messages.ts` 添加 `/game` 命令拦截器。用户发送 `/game werewolf god-view voice` 时，消息不再路由给 AI agent，而是直接启动游戏：

1. **`game-command-interceptor.ts`**（新文件）— 纯函数：`parseGameCommand` 解析命令，`buildGameSeats` 组装座位
2. **`messages.ts`** — 在 AI 路由前拦截 `/game` 命令，调用 WerewolfLobby 分配角色 + GameOrchestrator 启动游戏
3. **`index.ts`** — 提前创建 `f101GameStore`，注入 `messagesRoutes`

## Why

铲屎官报告：点击狼人杀菜单发送 `/game werewolf god-view voice` 后，只看到"布偶猫思考中..."，游戏 UI 不出现。

**根因**：`/game` 命令被当作普通消息发给 AI agent，但 AI agent 没有任何 game tool，无法调用 `POST /api/threads/:threadId/game`。结果没有 `game:state_update` WebSocket 事件，前端 `isGameActive` 永远为 `false`，`GameOverlayConnector` 返回 `null`。

## Original Requirements（必填）

> 铲屎官（07:57）："笑死我了你这bug 我们狼人杀页面呢？"
> 铲屎官（08:00）："你这只猫！...根据我们的家规。你不是瞎回答吗？"
>
> 期望：通过菜单发 `/game werewolf <mode> [voice]` → 游戏 UI 立即出现

- 来源：当前对话 [07:57] [08:00] 铲屎官消息
- **请对照上面的摘录判断：修复后用户发 `/game` 命令是否能启动游戏并看到游戏 UI**

## Tradeoff

- **方案 A（已选）**：消息路由层拦截。简单直接，`/game` 命令不经过 AI，系统直接启动游戏
- **放弃方案 B**：给 AI agent 添加 game tool。过于复杂（需要 tool 定义、prompt 注入、AI 决策延迟），且游戏启动应该是确定性的系统行为，不需要 AI 推理

## Open Questions

1. **默认 7 人局硬编码**：目前 `DEFAULT_PLAYER_COUNT = 7`，未来是否需要用户选择人数？
2. **cat 分配策略**：当前用 `getAllCatIdsFromConfig()` 获取所有猫，循环填座。如果猫不够 6 个（god-view 7 猫/player 6 猫），会循环复用同一只猫
3. **WerewolfLobby 双重创建**：lobby 创建 runtime 后 orchestrator 又创建一个（新 gameId）。lobby 的 runtime 只用于角色分配，不持久化。这是 clean enough 还是应该重构？

## Next Action

请 review 代码质量、架构合理性、edge case。放行后我走 merge-gate。

## 自检证据

### Spec 合规

| # | 要求 | 状态 |
|---|------|------|
| 1 | `/game` 命令拦截，不发 AI | ✅ |
| 2 | 解析 gameType/humanRole/voiceMode | ✅ |
| 3 | 组装 seats（player=P1 human） | ✅ |
| 4 | WerewolfLobby 角色分配 | ✅ |
| 5 | GameOrchestrator 启动+广播 | ✅ |
| 6 | 用户消息存入聊天历史 | ✅ |
| 7 | game:state_update 事件触发前端 | ✅ |

### 测试结果

```
game-command-interceptor.test.js — 12/12 pass ✅
game-command-bridge.test.js      — 4/4 pass ✅
game-routes.test.js              — 15/15 pass ✅ (无回归)
game-orchestrator.test.js        — 6/6 pass ✅ (无回归)
game-engine.test.js              — 10/10 pass ✅ (无回归)
pnpm lint                        — 0 errors ✅
pnpm check (biome)               — 0 errors ✅
build                            — exit 0 ✅
```

### 相关文档

- Feature: F101 Mode v2 — `docs/features/F101-mode-v2-game-engine.md`
- 改动文件: `packages/api/src/routes/game-command-interceptor.ts` (新), `packages/api/src/routes/messages.ts`, `packages/api/src/index.ts`
