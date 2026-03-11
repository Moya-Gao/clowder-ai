---
feature_ids: [F088]
doc_kind: review-request
created: 2026-03-11
author: opus
reviewer: gpt52
---

# Review Request: F088 AC-14 + Phase 5 + Phase 6 (Adapter Layer)

## What

三个 deferred 功能的 adapter 层实现：

1. **AC-14**: 飞书卡片按钮交互回调 — `parseCardAction()` + bootstrap webhook routing
2. **Phase 5**: 图片/文件/语音消息双向解析 — 两个 adapter 的 `parseEvent/parseUpdate` 扩展 + `sendMedia()` 出站
3. **Phase 6**: Audio rich block 出站 — `OutboundDeliveryHook.deliver()` 检测 audio block with url → `sendMedia()`

**变更范围**: 9 files, +753/-118 lines, 190 connector tests pass (0 fail)

## Why

铲屎官要求三个功能一起做。这是完整 Phase 5/6 的基建层 — 解析 + 路由 + 出站管道。后续的文件下载/存储和 STT 服务集成会在此基础上扩展。

## Original Requirements（必填）

> 铲屎官原话：
> "AC-14: 飞书卡片按钮交互回调...Phase 5: 图片/文件收发...Phase 6: 语音消息...一起写到你下一个worktree的计划里一起做了？应该不会很大吧 加起来"
> "开worktree！！然后和你的小伙伴 选择gpt54吧完成闭环！ 不要走一步问一下"
- 来源：thread context（Cat Café 对话）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

1. **不含文件下载/存储**：AC-19~20 的"下载 → 存储 → 传递给猫"需要 blob store 集成，超出 adapter 层范围。当前传递 `[图片]`/`[文件]` 文本 + attachment metadata，猫可以知道用户发了什么。
2. **不含 STT**：AC-22 的"语音 → STT → 文本"需要外部 STT provider。当前传递 `[语音]` 文本 + attachment metadata。
3. **sendLarkMessage 提取**：FeishuAdapter 从 398 行压到 299 行，提取了 `sendLarkMessage()` 私有方法。副作用是 `sendReply` 现在发 `JSON.stringify({ text: content })` 而非 raw text — 这是 Lark API 的正确格式，测试已同步更新。

## Open Questions

1. **OutboundDeliveryHook 复杂度**: Biome 报 cognitive complexity 26（限制 15）。这是 pre-existing issue（Phase 3 引入的 4-way 分支）。需要后续拆分为 strategy pattern 还是接受现状？
2. **sendMedia 管道**: 目前 audio block → sendMedia 只传 `{ type, url, text }`。Feishu/Telegram 实际发送语音需要先下载 WAV → 上传到平台 → 拿到 file_key/file_id。这部分留给 Phase 5/6 完整实现时做。

## Next Action

请 review 代码质量、架构决策、测试覆盖。关注点：
- AC-14 card action parsing 的安全性（`actionValue` 直接 JSON.stringify 传入 router）
- Phase 5 attachment 类型定义是否合理
- OutboundDeliveryHook audio delivery 的时序（先发 rich message 再发 media）

## 自检证据

### Spec 合规
- AC-14 ✅ (parseCardAction + bootstrap routing, 5 tests)
- Phase 5 inbound ✅ (12 adapter tests for image/file/audio parsing)
- Phase 5 outbound ✅ (sendMedia + IOutboundAdapter interface, 5 tests)
- Phase 6 outbound ✅ (audio block → sendMedia delivery, 4 tests)
- Phase 6 inbound ✅ (voice message parsing, 1 bootstrap test)

### 测试结果
```
connector tests → 190/190 pass, 0 fail
pnpm build → exit 0
biome (changed files) → 0 errors, 9 warnings (pre-existing complexity)
file sizes → all under 350 lines (FeishuAdapter: 299L)
```

### 相关文档
- Feature: `docs/features/F088-multi-platform-chat-gateway.md`
- AC list: `docs/features/assets/F088/acceptance-criteria.md`
- Branch: `feat/f088-media`
