---
feature_ids: [F132]
topics: [review-request, bug-fix, wecom-bot]
doc_kind: mailbox
created: 2026-04-15
---

# Review Request: Bug-8 WeCom Bot group @mention bypass + hardcoded 飞书群聊 title

Review-Target-ID: f132-bug-8
Branch: worktree-bug-8-wecom-bot-hub

## What

Three bugs fixed in WeCom Bot IM integration:

1. **Bug A** — `WeComBotAdapter.parseEvent()` now strips leading `@botName` prefix from group messages. WeCom SDK includes raw `@猫猫名` in `text.content` (unlike Feishu's structured mention tokens or DingTalk's SDK auto-strip). Without stripping, `ConnectorRouter` command check `trimmedText.startsWith('/')` fails for `@宪宪 /threads`.

2. **Bug B** — Consequence of Bug A. Once commands are intercepted, `resolveHubThread()` is called, creating Hub threads with `connectorHubState`. No separate code change needed.

3. **Bug C** — `ConnectorRouter` hardcoded `飞书群聊` for ALL platforms' group chat titles (thread title + source label + Hub thread label). Now uses `getConnectorDefinition(connectorId).displayName` → 企业微信群聊 / 钉钉群聊 / 飞书群聊.

## Why

铲屎官连接企业微信后实测发现：`/threads` 命令不被拦截而是发给猫猫处理；Hub 的 IM 列表没有 WECOM 分区；群聊标题写的是"飞书群聊"。

## Original Requirements（必填）

> 铲屎官 [2026-04-14 22:18]: "笑死 有bug 你们这企业微信的对接没和飞书和私人微信那样对接到im hub里边吗？"
> 铲屎官 [2026-04-14 22:21]: "你们是没对接这个 /threads是系统命令不应该让一只布偶猫出来"
> 铲屎官 [2026-04-14 22:26]: "@opus 必须的！！ 你最好对齐一下飞书和个人微信的实现然后把这个实现一下的"

- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- WeCom Bot SDK 不提供结构化 mentions 数组（Feishu 有），采用 regex `^@\S+\s*` 剥离首个 @mention。只处理 leading mention，不处理 inline mentions（群消息里 bot 只收到 @自己 的消息，@mention 总在开头）。
- WeCom Bot SDK 不提供群名（Feishu/DingTalk 有），群聊标题 fallback 到 `chatId.slice(-8)`。

## Open Questions

1. `stripGroupMention` 用 `^@\S+\s*` 够用吗？WeCom bot name 中可能有空格吗？（据了解不会）
2. voice 消息的 ASR 文本不包含 @mention，所以不需要 strip — 请确认这个假设。

## Next Action

请 review 代码正确性 + 对照铲屎官原始需求判断交付完整性。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f132-bug-8/codex`
- Start Command: `pnpm review:start`
- 纯后端改动，无前端变更，无需起 dev server

## 自检证据

### Spec 合规

- Bug A: @mention 群消息 → 命令拦截 ✅（对齐 Feishu stripBotMention 模式）
- Bug B: Hub thread 创建 → 自动随 Bug A 修复 ✅
- Bug C: 平台特定群聊标题 → 3 处硬编码全替换 ✅

### 测试结果

```
node --test packages/api/test/wecom-bot-adapter.test.js  # 86 passed, 0 failed
node --test packages/api/test/connector-router.test.js   # 42 passed, 0 failed
pnpm --filter @cat-cafe/api test                         # 7890 passed, 12 failed (all pre-existing Redis isolation)
pnpm --filter @cat-cafe/api exec tsc --noEmit            # clean
pnpm check                                               # clean
```

### 相关文档

- Feature: [F132](../features/F132-dingtalk-wecom-gateway.md)
- 8 new tests (5 adapter @mention + 3 router platform titles)

### 变更文件

| 文件 | 改动 |
|------|------|
| `WeComBotAdapter.ts` | +`stripGroupMention()` for text/mixed |
| `ConnectorRouter.ts` | 3x `飞书群聊` → `${displayName}群聊` |
| `wecom-bot-adapter.test.js` | +5 tests (@mention stripping) |
| `connector-router.test.js` | +3 tests (platform-specific titles) |
