---
title: "Review Request: F088 K1 — Telegram placeholder chatId mapping + deleteMessage"
date: 2026-05-06
author: 宪宪/Sonnet-46
reviewer: 砚砚/codex
feature: F088
phase: K1
---

# Review Request: F088 K1 — Telegram placeholder chatId mapping + deleteMessage

Review-Target-ID: f088-k1
Branch: feat/F088-phase-k1-telegram-dedup

## What

`TelegramAdapter` 现在正确维护 `platformMessageId → externalChatId` 映射：

- `sendPlaceholder()` 改为同时将 `msgId → externalChatId` 存入 `placeholderChats` Map
- 新增 `deleteMessage(platformMessageId)` —— 用 Map 查出 chatId → 调用 `bot.api.deleteMessage` → 清除 Map 条目（防止双删）
- 未知 `platformMessageId` 时 `deleteMessage` 是 no-op，不抛异常
- 新增两个 `@internal` test helper：`_injectBotApiSendMessage` / `_injectBotApiDeleteMessage`

**仅改动 2 个文件：**
- `packages/api/src/infrastructure/connectors/adapters/TelegramAdapter.ts` (+39 行)
- `packages/api/test/telegram-adapter.test.js` (+53 行，3 个新 K1 测试)

不碰 `QueueProcessor`、`ConnectorInvokeTrigger`、`messages.ts`，不改其他 adapter。

## Why

Telegram streaming 结束后出现两条相同最终消息：`OutboundDeliveryHook` 在 `IStreamableOutboundAdapter.deleteMessage` 上有挂钩，但 `TelegramAdapter` 之前没有实现这个接口方法，也没有存 chatId 映射，导致 placeholder 删不掉，outbound delivery 再发一条 → 重复。

社区 PR #641 抓到了根因，但分支污染（Windows 脚本 + 跨 adapter 签名改动）；PR #642 scope 扩到 inline final + rich/media，引入 mid-loop skip 丢消息风险。本次在家里做 source-owned minimal fix。

## Original Requirements（必填）

> "你能看到我们开源社区有两个 telegram的pr嘛？贡献者小伙伴说 他搞不定了 改了半天把猫猫都改挂了"
> "那我们是在家里修 然后 同步出去？"
> "那我建议你看看有没有合适的feat 挂上这三个问题 然后commit push 之后 让宪宪开worktree开修？你来review？"

- 来源：当前 session 铲屎官原话（2026-05-06 06:41 - 08:33）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题（K1 scope：只修 duplicate）**

## Tradeoff

**放弃**：在 `sendPlaceholder` 复用现有 `sendMessageFn` 注入点（`sendMessageFn` 返回 `unknown`，没法拿到 `message_id`）。

**选择**：新增独立的 `botApiSendMessageFn` 和 `botApiDeleteMessageFn` test helpers，与现有 `_injectSendMessage` 并列，保持各方法注入点正交、不互相干扰。

**保守边界**：K1 不做 inline streaming final（K2），不做 rich/media/retry（K3），不动公共 delivery 状态机。

## Open Questions

这是砚砚 handoff 时明确的 review focus：

1. **K2/K3 scope 偷渡检查**：有没有任何改动暗地引入 inline final 或 connector-level skip？
2. **多 binding 安全**：`placeholderChats` Map 是实例级的，多个 externalChatId 共享同一 adapter 实例时，不同 chatId 的 placeholder 不会互相干扰吗？（预期：OK，Map 以 platformMessageId 为键，天然隔离）
3. **delivery 失败时 placeholder 保留**：如果 `OutboundDeliveryHook.deliver()` 失败而没有调用 `deleteMessage`，placeholder 会永远留在 Map 里（内存泄漏？）。K1 不 address 这个，但 reviewer 请确认这是可接受的 K1 边界，还是必须在本次处理。

## Next Action

请 @codex 确认：
- 代码满足 K1 spec 中列出的所有验收标准
- 无 K2/K3 scope 偷渡
- 可以放行进 merge-gate

## Review Sandbox

这是纯后端 adapter 改动，无 UI、无 API 路由变更，不需要启动服务验证。

若需本地跑测试：
- Branch: `feat/F088-phase-k1-telegram-dedup`
- Path: `/tmp/cat-cafe-review/f088-k1/codex`
- Run: `pnpm --dir packages/api run build && node --test packages/api/test/telegram-adapter.test.js`

## 自检证据

### Spec 合规（F088 Phase K1 验收标准）

| # | AC | 状态 | 代码位置 |
|---|-----|------|----------|
| K1-1 | Telegram streaming plain-text 回复最终只保留一条最终答案 | ✅ placeholder 被 deleteMessage 清除 | `TelegramAdapter.ts:332-344` |
| K1-2 | placeholder 只在 outbound delivery 成功后清理；delivery 失败时 placeholder 保留 | ✅ deleteMessage 由 OutboundDeliveryHook 在 deliver() 后调用，adapter 本身不主动清 | 接口约定不变 |
| K1-3 | 不修改 QueueProcessor / ConnectorInvokeTrigger / messages.ts | ✅ diff 只有 2 个文件 | `git diff --stat` |
| K1-4 | 不修改非 Telegram adapter 的 deleteMessage 签名或行为 | ✅ 只动 TelegramAdapter | `git diff --stat` |
| K1-5 | 回归测试覆盖 Telegram placeholder chatId 映射与 deletion | ✅ 3 个新 K1 测试 | `telegram-adapter.test.js:346-400` |

### 测试结果（worktree 实际运行输出）

```
路径：/Users/lysander/projects/relay-station/cat-cafe-F088-phase-k1-telegram-dedup
测试：telegram-adapter + streaming-outbound-hook + outbound-delivery-hook

ℹ tests 65
ℹ pass 65
ℹ fail 0
ℹ duration_ms 161ms
```

### 构建 & 静态检查

```
pnpm --dir packages/api run build     → exit 0 ✅
pnpm --dir packages/api run lint      → tsc --noEmit, 0 errors ✅
pnpm biome check TelegramAdapter.ts telegram-adapter.test.js → Checked 2 files, No fixes applied ✅
pnpm check:followup-tails             → ✅ No follow-up tails detected
```

### 工件闸门

```
root media artifacts (working tree)  → 无 ✅
root media artifacts (committed diff) → 无 ✅
```

### 相关文档

- Feature: `docs/features/F088-multi-platform-chat-gateway.md` — Phase K（K1 验收标准 at :163-184）
- 社区 issue: clowder-ai#524
- 社区 draft PRs: clowder-ai#641 / #642（不 merge，家里做 source-owned fix）
