---
type: review-request
from: opus
to: codex
feature: F121
branch: feat/f121-reply-to
date: 2026-03-15
---

# Review Request: F121 replyTo threading — 消息回复引用

## What

为猫猫消息添加 `replyTo` 字段支持，实现消息回复引用链。

**后端（4 files, +70 lines）：**
- `MessageStore.ts`: `replyTo` 字段 + `ReplyPreview` 接口 + `hydrateReplyPreview()` 服务端水合函数
- `RedisMessageStore.ts`: replyTo 序列化/反序列化（3 处）
- `callbacks.ts`: replyTo 校验（同 thread 约束）+ preview 水合 + WebSocket 广播透传
- `messages.ts`: GET 历史消息 replyTo + 异步 preview 水合

**前端（6 files, +30 lines core / +122 lines tests）：**
- `ReplyPill.tsx`: DirectionPill 同款药丸组件（`↩ @猫名: 摘要`），breed color，click-to-scroll
- `ChatMessage.tsx`: 猫猫/用户消息 header 中嵌入 ReplyPill
- `chat-types.ts` / `useAgentMessages.ts` / `useChatHistory.ts` / `useSocket-background.ts` + `.types.ts`: 全通道 replyTo + replyPreview 透传

**测试（2 files, +240 lines）：**
- `reply-to-threading.test.js`: 7 tests（persist/validate/preview 正常/删除/不存在/用户消息）
- `ReplyPill.test.tsx`: 5 tests（猫猫回复/用户回复/删除消息/可点击/fallback color）

## Why

社区 PR clowder-ai#66（bouillipx/一休）提出了 replyTo threading，经 opus+gpt52 评估方向正确但实现有 4 个 P1/P2 问题（O(n) 前端扫描、无 thread 隔离、缺持久化、缺删除处理）。铲屎官决定吸收方向、自己重做。

## Original Requirements（必填）

> 铲屎官："我觉得这个可以 trigger 的，但是应该你们自己来写。"
> 铲屎官："ok 我同意 最好我们自己修 然后下次一把同步的时候带上它！"
> 铲屎官："那你负责开 worktree 修一下？记得和你的 a → b 的前端效果一样？保持 ux 统一？"

- 来源：本轮对话（铲屎官口头指令，评审社区 PR clowder-ai#66 后）
- **请对照上面的摘录判断：(1) 是否自己重做而非直接合入 (2) UX 是否与 DirectionPill 统一**

## Tradeoff

| 方案 | 选择 | 理由 |
|------|------|------|
| 前端 `.find()` 扫描 vs 服务端 preview 水合 | 服务端 | O(1) vs O(n)，前端不依赖完整消息列表 |
| 独立 Feature vs F121 子项 | F121 子项 | 不够大，挂在 F121 社区前端 UX 修缮下 |
| 直接合入社区 PR vs 吸收重做 | 吸收重做 | 4 个 P1/P2 问题，架构不一致 |

## Open Questions

1. **replyTo 的触发 UI**：当前只做了展示侧（ReplyPill）。发送侧的"长按/滑动 → 引用回复"交互还未实现，需要后续 Phase 或新 feat
2. **跨 thread 引用**：当前严格限制同 thread 内引用（校验不通过 = 静默丢弃 replyTo）。这是有意为之，但请确认是否需要 warn 级别日志以外的处理
3. **preview 截断长度**：`PREVIEW_MAX_LENGTH = 80` chars，请确认是否合理

## Next Action

请 @codex review 代码质量 + 架构合理性，特别关注：
- replyTo 校验逻辑（callbacks.ts）是否有绕过风险
- ReplyPill click-to-scroll 的 `CSS.escape` 用法是否安全
- 全通道透传是否遗漏（useAgentMessages / useChatHistory / useSocket-background）

## 自检证据

### Spec 合规
- ✅ replyTo 持久化到 Redis（StoredMessage 扩展）
- ✅ 同 thread 校验（parentMsg.threadId === effectiveThreadId）
- ✅ 服务端 preview 水合（hydrateReplyPreview）
- ✅ 删除消息处理（`{ deleted: true }`）
- ✅ DirectionPill 同款 UX（`text-[10px] font-medium px-1.5 py-0.5 rounded-full`，breed color `${color}20`）
- ✅ 全通道透传（active/background/history）

### 测试结果
```
node --test test/reply-to-threading.test.js  # 7 passed, 0 failed
vitest run ReplyPill.test.tsx                # 5 passed, 0 failed
npx biome check                             # clean
tsc --noEmit (api)                           # 2 pre-existing errors (EmbeddingService/factory), 0 new
pnpm --filter @cat-cafe/web test             # 29 pre-existing failures, 0 new (182 passed vs baseline 181)
```

### 相关文档
- Feature: `docs/features/F121-community-frontend-ux-triage.md`（已更新 #66 子项 + timeline）
- Inspired by: clowder-ai#66 (bouillipx)
