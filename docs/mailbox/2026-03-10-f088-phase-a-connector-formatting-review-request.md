# Review Request: F088 Phase A — Connector Message Formatting + userId Alignment

## What
Phase A of F088 ISSUE-1 fix: 公共层消息格式化 + 前端可见性修复。

核心变更：
1. **ConnectorMessageFormatter** — 平台无关的 `MessageEnvelope { header, subtitle, body, footer }` 生成器（公共层）
2. **FeishuAdapter.sendFormattedReply()** — 将 MessageEnvelope 渲染为飞书 interactive card（适配层）
3. **OutboundDeliveryHook** — 新增 `threadMeta` 参数 + `sendFormattedReply` 路径，后向兼容无 threadMeta 的旧调用
4. **DEFAULT_OWNER_USER_ID** — `loadConnectorGatewayConfig()` 读取环境变量，connector thread 用真实 userId 创建

## Why
- 飞书消息用 `msg_type: 'text'` 输出丑陋（不支持 markdown），需要 interactive card
- Connector 创建的 thread 用 `default-user` userId，前端不可见（ISSUE-1）
- 铲屎官要求"能沉淀到公共层的就做成公共的"，禁止每个 adapter 各做一套格式化

## Original Requirements（必填）
> "能够沉淀到底层公共的就要做成公共的，避免每个 adapter 到时候做一套！！"
> "飞书消息必须在前端可见，铲屎官能看到 thread"
> "飞书是不支持富文本和 md 格式吗？看起来很奇怪"
- 来源：本次会话对话 (2026-03-10)，F088 架构讨论 + 飞书实测反馈
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- **未做 Redis 持久化 binding**：Phase A 只做格式化 + userId，binding 持久化留 Phase B
- **未做 Telegram sendFormattedReply**：Telegram 的 MarkdownV2 格式化留后续，当前走 sendReply 兜底
- **catEmoji 硬编码 🐱**：CatConfig 无 emoji 字段，暂用固定值

## Open Questions
1. `IOutboundAdapter.sendFormattedReply?` 是 optional method——这样的接口设计可以接受吗？还是应该抽象为 strategy pattern？
2. `ThreadMeta` 只在 OutboundDeliveryHook 定义——未来 ConnectorRouter 调 deliver 时如何传入 threadMeta？（Phase B 的 thread 元数据查询）
3. `ConnectorMessageFormatter.format()` 的 timestamp 用 `new Date()` 在 hook 里生成——是否应该从 message record 取？

## Next Action
请做 R1-R4 审查，关注：
- 公共层/适配层边界是否清晰
- 后向兼容路径是否安全
- 接口设计是否合理

## 自检证据

### Spec 合规
愿景覆盖: 3/3 (公共层 ✅ | userId 可见性 ✅ | 飞书富文本 ✅)
功能验收: 6/6 (Formatter ✅ | env config ✅ | sendFormattedReply ✅ | hook wiring ✅ | interface ✅ | backward compat ✅)

### 测试结果
```
connector tests → 49/49 pass, 0 fail
pnpm build → exit 0
pnpm lint → 0 errors (pre-existing warnings only)
```

### 相关文档
- Feature: F088 Multi-Platform Chat Gateway
- Spec: `docs/features/F088-multi-platform-chat-gateway.md`
- Discussion: `docs/discussions/2026-03-10-f088-connector-thread-unification-meeting-notes.md`
- Guides: `docs/guides/im-platform-setup.md`, `docs/guides/im-usage-guide.md`

### 变更文件清单
| 文件 | 类型 | 行数 |
|------|------|------|
| `ConnectorMessageFormatter.ts` | NEW | ~60 |
| `connector-message-formatter.test.js` | NEW | ~119 |
| `FeishuAdapter.ts` | MOD | +35 |
| `feishu-adapter.test.js` | MOD | +48 |
| `OutboundDeliveryHook.ts` | MOD | +30 |
| `outbound-delivery-hook.test.js` | MOD | +55 |
| `connector-gateway-bootstrap.ts` | MOD | +5 |
| `connector-gateway-bootstrap.test.js` | MOD | +30 |
