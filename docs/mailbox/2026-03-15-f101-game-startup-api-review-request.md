# Review Request: F101 Game Startup Architecture — 专用 API + HTTP 导航

## What

游戏启动从聊天消息管道迁移到专用 API。7 文件，+237/-100。

**后端**：
- `POST /api/game/start` 新端点，接收结构化 payload `{ gameType, humanRole, playerCount, catIds, voiceMode }`
- `GameRoutesOptions` 扩展 `threadStore` + `messageStore`
- 提取 `messages.ts` 中的游戏创建逻辑（thread 创建、WerewolfLobby、orchestrator、auto-play）到 `games.ts`

**前端**：
- `GameLobby.onConfirm` 从命令字符串 → 结构化 `GameStartPayload`
- `ChatInput` 直接 `fetch('/api/game/start')` + `router.push(/thread/${gameThreadId})`，不走 `onSend` → 消息管道
- 删除 `useChatCommands.ts` 中 `/game` 拦截器（PR #469 创可贴）

## Why

GPT-5.4 诊断了 5 个 P1/P2 问题，根因：游戏启动寄生在聊天消息管道上。

1. **P1**: 走 `onSend` → `setLoading(true)` → "布偶猫思考中..." 而非即时开局
2. **P1**: socket `game:thread_created` 是唯一导航机制，漏了就卡住
3. **P1**: `game:state_update` 要求 `view.threadId === threadId`，但用户还没导航过去
4. **P1**: 命令字符串 `/game werewolf player 8 opus,sonnet...` 脆弱
5. **P2**: 运行时布偶猫把 `/game` 当普通消息回复

## Original Requirements（必填）

> 铲屎官 [03:08]："你这啥啊 布偶猫正在思考中 我们的愿景写的是啥啊 你能放弃你那个非要发一条/ xxx 消息的设计吗"
> 铲屎官 [03:08]："你就不能像其他的 signal hunter 或者 mission hub 那样 干净正常吗！？"
> 铲屎官 [03:58]："@gpt52 你来定位 这只布偶猫根本不看代码。他只会瞎猜"

- 来源：本 thread 对话历史 2026-03-15 03:08-03:58
- **请对照上面的摘录判断：游戏启动是否达到了"像 Signal Hunter 那样干净正常"的标准**

## Tradeoff

- **保留 `messages.ts` 旧拦截器作为后备**：未删除，因为如果有外部/CLI 场景发送 `/game` 命令文本，旧路径仍可工作。后续可在确认无调用后清理。
- **`userId` 硬编码 `'default-user'`**：与 `messages.ts` 现有行为一致，单用户产品暂不需要 auth。

## Open Questions

1. `messages.ts` 中的旧 `/game` 拦截器是否应在本 PR 一并删除？还是留作后备？
2. 新端点没有鉴权（与现有 game routes 一致），后续是否需要加？

## Next Action

请 review 代码质量 + 架构合理性，重点关注：
- `POST /api/game/start` 端点设计是否合理（schema、错误处理、与现有 low-level endpoint 的共存）
- 前端 `startGame` 的 error handling 是否足够
- 测试覆盖是否充分

## 自检证据

### Spec 合规

Quality Gate 通过。本次改动是 Phase D 内的架构修复，非新 AC。直接解决 GPT-5.4 诊断的 P1×4 根因。

### 测试结果

```
API game tests (game-routes + game-command-interceptor + game-types): 38/38 pass ✅
Web game tests (game-send-guard + game-menu): 19/19 pass ✅
tsc --noEmit (API): 0 errors ✅
pnpm check (biome): my 7 files 0 errors ✅
pnpm build (API+shared): exit 0 ✅
```

### 相关文档

- Feature: `docs/features/F101-mode-v2-game-engine.md`
- GPT-5.4 诊断: 本 thread 对话历史 [04:00 缅因猫(GPT-5.4)] 5-point analysis
- PR #469 (创可贴，已合入): `/game` 拦截器
- Worktree: `cat-cafe-f101-game-api`, branch `feat/f101-game-startup-api`
