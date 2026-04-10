---
feature_ids: [F157]
topics: [feishu, ux, connector, streaming, review-request]
doc_kind: review-request
created: 2026-04-10
---

# Review Request: F157 Feishu Receipt Ack — 猫猫即时接住替代"思考中→撤回"

Review-Target-ID: f157
Branch: feat/feishu-receipt-ack

## What

三层即时反馈替代旧的 `🤔 思考中...` → delete 流程：

1. **L1 Reaction**: 收到消息后立即给用户消息加 ❤️ reaction（fire-and-forget）
2. **L2 Receipt Card**: 发一条猫猫口吻的 receipt 卡片（12 猫 × 5 条词库随机选）
3. **L3 Streaming**: 流式编辑 receipt 卡片 → 生成结束后 `finalizeStreamCard`（edit 为"✅ 已回复"绿卡片），**全程不调用 deleteMessage**

6 个文件变更，236 行净增：
- `feishu-receipt-lines.ts`（新增）：12 猫词库 + `pickReceiptLine()`
- `OutboundDeliveryHook.ts`：接口新增可选 `addReaction` + `finalizeStreamCard`
- `FeishuAdapter.ts`：实现 `addReaction`（im.messageReaction.create）+ `finalizeStreamCard`（interactive card edit）
- `StreamingOutboundHook.ts`：receipt 替代 placeholder + 优先 finalizeStreamCard
- `ConnectorRouter.ts`：fire-and-forget `addReaction('HEART')`
- `streaming-outbound-hook.test.js`：13 tests 全覆盖新行为

## Why

飞书 `im.message.delete` API 表现为"xxx 撤回了一条消息"，每次回复都有一条撤回通知，用户困惑且突兀。社区 fork（openJiuwen/relay-claw PR #24）用 THUMBSUP reaction 验证了"不撤回"路线可行，但缺乏猫味。

## Original Requirements（必填）

> "飞书显示思考中后撤回消息"
> "好像甚至能发猫猫已经收到～（提供很多种文本随机发）然后不撤回？"
> "可以参考我们做苹果手表特性的！那些句子"
> "还有小金渐层别忘记人家哈哈哈 我们有多少猫猫就得有多少个诶"

- 来源：本轮对话（2026-04-10），铲屎官 + 砚砚(GPT-5.4) + 宪宪三方讨论
- Spec：`docs/features/F157-feishu-receipt-ack.md`（已 commit+push 到 main）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 放弃 | 选择 | 理由 |
|------|------|------|
| 单消息生命周期（receipt → final 同一条） | receipt 卡片 → "✅ 已回复" + final 独立消息 | `finalizeStreamCard` 只能 edit 为固定结构卡片，无法承载最终回复的 rich content；两条消息但零撤回 > 一条消息但有撤回 |
| THUMBSUP reaction | HEART ❤️ | 铲屎官说"太不猫猫了" |
| `Record<CatId, ...>` 强类型词库 | `Record<string, ...>` | CatId 是 branded type，不能做 object literal key；运行时仍通过 catId 索引 |

## Open Questions

1. **AC-A4 偏差**：Spec 写"edit receipt 为 final content"，实现是"edit 为 ✅ 已回复 + final 独立发送"。语义等价（零撤回达成）但实现细节不同。请 reviewer 判断是否需要更新 spec。
2. **addReaction 权限**：`im.messageReaction.create` 需要 `im:message.reactions:create` scope，OQ-1 待飞书实测。当前 errors are non-fatal（catch + warn）。
3. **catRegistry 测试覆盖**：test 环境没有加载真实 catRegistry，所以 `【displayName🐱】` prefix 在测试中不出现。生产环境有完整 cat-config.json 加载。

## Next Action

请 `@codex` review 代码质量 + 安全 + 接口设计。重点关注：
- `FeishuAdapter.addReaction` / `finalizeStreamCard` 的错误处理是否充分
- `ConnectorRouter` 中 fire-and-forget 的 `addReaction` 是否有隐患
- `cleanupPlaceholders` 中 finalizeStreamCard vs deleteMessage 的优先级逻辑
- receipt 词库的维护性（新猫入册时如何扩展）

## 自检证据

### Spec 合规

| AC | 状态 | 说明 |
|----|------|------|
| AC-A1 | ✅ | ConnectorRouter fire-and-forget addReaction('HEART') |
| AC-A2 | ✅ | pickReceiptLine 按 catId 选文案，prefix 格式 `【{name}🐱】` |
| AC-A3 | ✅ | onStreamChunk 保留原有流式编辑 |
| AC-A4 | ⚠️ | finalizeStreamCard edit 为 "✅ 已回复"，非 final content（见 OQ-1） |
| AC-A5 | ✅ | 全程不调用 deleteMessage（Feishu adapter 有 finalizeStreamCard） |
| AC-A6 | ✅ | 12 猫 × 5 条，feishu-receipt-lines.ts 逐猫验证 |
| AC-A7 | ✅ | 13/13 streaming-outbound-hook tests pass |
| AC-A8 | ✅ | DingTalk/WeCom/Xiaoyi/Telegram/Weixin 零改动 |

### 测试结果

```
node --test streaming-outbound-hook.test.js   # 13 passed, 0 failed
node --test connector-router.test.js + outbound-delivery.test.js  # 52 passed, 0 failed (全 connector 测试)
pnpm --filter @cat-cafe/api build             # 成功（tsc 零 error）
pnpm check                                    # Biome 零 error
pnpm lint                                     # 类型检查通过（仅 web 预存 warnings）
```

Commit: `0ba85d9fb` on `feat/feishu-receipt-ack`

### 相关文档

- Feature: `docs/features/F157-feishu-receipt-ack.md`
- BACKLOG: `docs/BACKLOG.md` 已更新
- 社区参考: openJiuwen/relay-claw PR #24
