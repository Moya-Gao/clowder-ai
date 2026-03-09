# Review Request: F088 Multi-Platform Chat Gateway — MVP Phase 1

## What
飞书 + Telegram 双平台 DM-only 双向聊天网关。在现有 Connector 框架上扩展：
- **Inbound**: Telegram long polling + Feishu webhook → ConnectorRouter → thread binding → 触发猫猫
- **Outbound**: agent 执行完成后 final-only 回复到外部平台（OutboundDeliveryHook）
- **Thread mapping**: ConnectorThreadBindingStore（外部 chatId ↔ Cat Café threadId）
- **Dedup**: InboundMessageDedup 防止 webhook 重试风暴

新增 8 个源文件 + 9 个测试文件，55 新测试 + 27 现有测试全绿。

## Why
铲屎官和未来用户希望在已有的工作聊天工具中直接与猫猫交互，不用切换窗口。MVP 选了飞书（国内企业）+ Telegram（海外开发者，10亿 MAU，Bot API 最开放）。

## Original Requirements（必填）
> 铲屎官原话（Thread 讨论 + Feature spec）：
> - "飞书等聊天软件的Gateway能力"
> - "来个海外的" — 选了 Telegram
> - 消息双向通（收+回）
> - 入站幂等（不重复触发）
- 来源：`docs/features/F088-multi-platform-chat-gateway.md`（需求点 Checklist R1-R6）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
1. **Outbound = final-only**（不做流式/编辑同步）— 降低首个平台复杂度，Phase 2+ 可加 streaming
2. **DM-only**（不支持群聊 @mention）— 群聊依赖 F077 多用户安全模型
3. **In-memory stores**（BindingStore + Dedup）— MVP 足够，Phase 2 可迁移 Redis
4. **messageStore wrapper**（sync→async 适配）— 避免侵入修改 MessageStore 接口

## Open Questions
1. `ConnectorInvokeTrigger.setOutboundHook()` 用 `as` cast 绕过 `readonly` — 是否应该把 `outboundHook` 改为 mutable field？
2. Telegram 4096 字符截断策略 — 长消息是截断+省略号还是分段发送？
3. Feishu adapter 目前没有 webhook 签名校验（MVP 简化） — Phase 2 是否必须加？

## Next Action
请 review 代码质量、架构合理性、测试覆盖是否充分。重点关注：
- ConnectorRouter 路由逻辑是否正确
- OutboundDeliveryHook 的 Promise.allSettled 容错是否足够
- server entry wiring（index.ts）是否安全（env-gated + best-effort）

## 自检证据

### Spec 合规
- AC-1 (飞书 E2E): ✅ integration test
- AC-2 (Telegram E2E): ✅ integration test
- AC-3 (Thread mapping): ✅ 7 unit tests
- AC-4 (Auth): ✅ adapter tests
- AC-5 (Regression): ⚠️ pending live testing (all changes additive, build clean)
- AC-6 (Dedup): ✅ 4 + 1 tests
- AC-7 (Outbound final-only): ✅ 5 tests + wired in trigger

### 测试结果
```
node --test (F088 + existing)  → 82/82 pass, 0 fail ✅
pnpm lint                      → 0 errors ✅
pnpm -r --if-present run build → exit 0 ✅
npx tsc --noEmit               → 0 errors ✅
npx biome check (F088 files)   → 0 errors ✅
```

### 相关文档
- Feature: `docs/features/F088-multi-platform-chat-gateway.md`
- Plan: `docs/plans/2026-03-09-f088-chat-gateway.md`
- Branch: `feat/f088-chat-gateway` (11 commits)
