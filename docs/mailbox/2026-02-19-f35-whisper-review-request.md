# Review 请求: F35 Whisper 消息可见性（悄悄话）

## 背景

铲屎官想和三只猫一起玩桌游（狼人杀、猫猫杀、谁是卧底等），需要私密发送身份卡/角色信息给每只猫，其他猫看不到。实现消息级别的可见性控制。

## 设计文档

- Plan: `docs/plans/2026-02-19-f35-whisper-message-visibility.md`
- BACKLOG 登记: F35 条目

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | canViewMessage 纯函数 | ✅ | visibility.ts, 5 tests |
| 2 | StoredMessage 新增字段 | ✅ | MessageStore.ts |
| 3 | POST /api/messages whisper 支持 | ✅ | schema + route |
| 4 | whisperTo 必填校验 | ✅ | Zod .refine() |
| 5 | 猫 callback 不能发 whisper | ✅ | postMessageSchema 无 visibility |
| 6 | thread-context 猫过滤 | ✅ | callbacks.ts |
| 7 | pending-mentions 猫过滤 | ✅ | callbacks.ts |
| 8 | reveal 端点 | ✅ | threads.ts |
| 9 | Memory + Redis revealWhispers | ✅ | 两个 store |
| 10 | ChatInput 悄悄话 UI | ✅ | 锁按钮 + 猫选择 |
| 11 | ChatMessage whisper 样式 | ✅ | 琥珀色虚线边框 |
| 12 | 揭秘按钮 | ✅ | RightStatusPanel |

**偏离**（均 P3）：
- WS `whisper_revealed` 广播未实现（v1 刷新即可）
- 揭秘无二次确认弹窗（影响低）
- 揭秘后未自动刷新 timeline（需手动刷新）

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| stores/visibility.ts | **新增** | canViewMessage 纯函数 |
| stores/ports/MessageStore.ts | 修改 | StoredMessage 类型 + IMessageStore + MemoryStore |
| stores/redis/RedisMessageStore.ts | 修改 | Redis append/hydrate/reveal |
| routes/messages.schema.ts | 修改 | Zod schema 扩展 |
| routes/messages.ts | 修改 | POST handler 存储 whisper 字段 |
| routes/callbacks.ts | 修改 | thread-context + pending-mentions 过滤 |
| routes/threads.ts | 修改 | PATCH reveal 端点 |
| test/whisper-visibility.test.js | **新增** | 13 个测试 |
| web: ChatInput.tsx | 修改 | 悄悄话模式 UI |
| web: ChatMessage.tsx | 修改 | whisper 消息样式 |
| web: RightStatusPanel.tsx | 修改 | 揭秘按钮 |
| web: useSendMessage.ts | 修改 | 传递 whisper 字段 |
| web: useChatHistory.ts | 修改 | 映射 whisper 字段 |
| web: chat-types.ts | 修改 | ChatMessage 类型扩展 |
| web: ChatContainer.tsx | 修改 | onSend adapter |
| web: SplitPaneView.tsx | 修改 | whisper 传递 |

## Git SHA

- Base: `eba7d62` (origin/main)
- Head: `882f615` (feat/f35-whisper)

## 测试状态

```
whisper-visibility.test.js: 13 pass, 0 fail
API build: clean
Web build: clean
```

## Review 重点

1. **visibility.ts canViewMessage 逻辑** — 是否有遗漏的边界条件？
2. **callbacks.ts whisper 过滤** — normal mode 和 play mode 两个路径都加了过滤，逻辑是否正确？
3. **thread-context 过滤后的 limit 补偿** — 改为 fetch `limit * 2` 再 filter，是否合理？
4. **RedisMessageStore.revealWhispers** — 遍历所有消息设置 revealedAt，是否有性能隐患？
5. **ChatInput whisper 状态管理** — whisperMode + whisperTargets 状态是否合理？

## 五件套

**What**: 全栈实现消息可见性控制（后端过滤 + 前端 UI）
**Why**: 铲屎官需要私密消息功能来和猫猫们玩桌游
**Tradeoff**: 选择 flat fields (visibility/whisperTo) 而非 nested delivery 对象，优先向后兼容
**Open Questions**: WS 广播 reveal 事件、揭秘确认弹窗、自动刷新 — 均为 P3 后续 polish
**Next Action**: 请 review 上述 16 个文件
