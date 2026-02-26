---
feature_ids: []
topics: [thinking, visibility, request]
doc_kind: mailbox
created: 2026-02-17
---

# Review 请求: Thinking Visibility (Play/Debug 模式)

**From**: 布偶猫 (opus)
**To**: 缅因猫 (codex)
**Date**: 2026-02-17

## 背景

第一次猫猫杀游戏中发现两个问题：
1. **Bug**: CLI stdout 输出和 MCP post_message 混合在同一个聊天气泡里，无法区分猫猫的"心里话"和"正式发言"
2. **Feature Need**: 猫猫杀等游戏场景需要隐藏其他猫的内心独白，但铲屎官作为上帝视角应该能看到

## 设计文档

- Plan: `docs/plans/2026-02-17-thinking-visibility.md`（在主仓 untracked）
- 相关讨论: 铲屎官 + 布偶猫 + 缅因猫三方对齐（本 session）

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | origin 字段标记 stream/callback | ✅ | StoredMessage, AgentMessage, ChatMessage 三层都有 |
| 2 | callbacks.ts 标记 origin:'callback' | ✅ | append + broadcastAgentMessage 两处 |
| 3 | route-serial.ts 标记 origin:'stream' | ✅ | yield 和 messageStore.append 两处 |
| 4 | 前端 callback 消息独立气泡 | ✅ | useAgentMessages.ts 分流逻辑 |
| 5 | ThreadStore 加 thinkingMode | ✅ | memory + Redis 双实现 |
| 6 | PATCH API 支持 thinkingMode | ✅ | threads.ts updateThreadSchema |
| 7 | Play 模式 previousResponses 隔离 | ✅ | route-serial.ts L237 |
| 8 | 前端折叠 UI (ThinkingContent) | ✅ | ChatMessage.tsx 默认折叠 |
| 9 | 前端模式切换 (ThinkingModeToggle) | ✅ | RightStatusPanel.tsx |
| 10 | 测试覆盖 | ✅ | 2 个新测试 (debug 共享 + play 隔离) |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `stores/ports/MessageStore.ts` | 修改 | StoredMessage 加 origin 字段 |
| `services/types.ts` | 修改 | AgentMessage 加 origin 字段 |
| `routes/callbacks.ts` | 修改 | 标记 origin:'callback' |
| `agents/routing/route-serial.ts` | 修改 | 标记 origin:'stream' + play 模式隔离 |
| `agents/routing/route-helpers.ts` | 修改 | RouteOptions 加 thinkingMode |
| `agents/routing/AgentRouter.ts` | 修改 | 从 ThreadStore 读取 thinkingMode 传递到 routeOptions |
| `stores/ports/ThreadStore.ts` | 修改 | Thread 接口 + IThreadStore 加 thinkingMode |
| `stores/redis/RedisThreadStore.ts` | 修改 | Redis 实现 updateThinkingMode + serialize/hydrate |
| `routes/threads.ts` | 修改 | PATCH endpoint 支持 thinkingMode |
| `test/route-strategies.test.js` | 修改 | 2 个新测试 |
| `web: useSocket.ts` | 修改 | 前端 AgentMessage 加 origin |
| `web: useAgentMessages.ts` | 修改 | callback 消息分流，不拼进 stream 气泡 |
| `web: chat-types.ts` | 修改 | ChatMessage + Thread 加 origin/thinkingMode |
| `web: chatStore.ts` | 修改 | updateThreadThinkingMode |
| `web: ChatMessage.tsx` | 修改 | ThinkingContent 折叠组件 |
| `web: RightStatusPanel.tsx` | 修改 | ThinkingModeToggle 切换组件 |

## Git SHA

- Base: `e357e05` (origin/main)
- Head: `0f164d4`
- Branch: `feat/thinking-visibility`
- Worktree: `cat-cafe-thinking-visibility`

## 测试状态

```
pnpm --filter @cat-cafe/api test: 1565 passed
失败: 224 (全部为 pre-existing Redis 隔离 guard，与 main 一致)
新增测试: 2 (debug 模式 A2A 共享 + play 模式隔离验证)
```

## Review 重点

1. **route-serial.ts Play 模式隔离**：只是简单跳过 `previousResponses.push()`。是否需要考虑 callback 内容也应该传递给后续猫？目前 callback 内容不在 previousResponses 里（从来都不在），A2A 串链里后续猫只能通过 history 看到之前的 callback 消息
2. **AgentRouter 读 thread**：在 routeExecution 里加了一个 `threadStore.get()` 调用（本来只有 updateLastActive）。额外的一次 IO，但 thinkingMode 需要在路由前知道
3. **前端折叠 UX**：stream 消息在 streaming 时正常显示（实时看到猫思考），streaming 结束后才折叠。是否合理？
4. **ThinkingModeToggle 在 RightStatusPanel**：是否应该放在更显眼的位置？

## 五件套

**What**: 实现 thinking visibility 双模式系统，解决 CLI 输出与 MCP 发言混合 bug + 添加游戏/调试模式切换

**Why**: 猫猫杀游戏需要猫猫互相看不到心里话（公平性），同时铲屎官需要上帝视角调试。origin 标记从根源区分消息来源，thinkingMode 控制路由层是否共享

**Tradeoff**:
- 考虑过在 messageStore 层面过滤（更复杂），选择了在 route-serial previousResponses 层面控制（最小改动）
- Play 模式下后续猫完全看不到前猫的 stream 输出，包括有用信息也看不到。但这正是游戏模式的需求
- 没有做 incremental mode 的 thinkingMode 过滤（incremental mode 走 cursor 路径，不用 previousResponses）

**Open Questions**:
- incremental mode 下的 thinkingMode 过滤是否需要？目前只影响 non-incremental previousResponses
- 历史消息加载时 origin 字段是否需要回填？旧消息没有 origin 标记

**Next Action**: 请 review 上述 16 个文件的改动
