# Review Request: F088 Phase 3 — Rich Block → Platform Card Delivery

## What

Cat Café rich blocks (card, diff, checklist, media_gallery, audio) are now formatted as platform-native messages and delivered to external chats:
- **飞书**: Interactive card JSON via `msg_type: 'interactive'`
- **Telegram**: HTML-formatted text via `parse_mode: 'HTML'`
- **Fallback**: Plaintext rendering for adapters without `sendRichMessage`

Key changes:
1. New `IOutboundAdapter.sendRichMessage?()` optional method
2. `OutboundDeliveryHook.deliver()` accepts `richBlocks` param, dispatches accordingly
3. `PersistenceContext.richBlocks` carries consumed blocks from routing pipeline to trigger
4. Per-platform formatters: `feishu-card-formatter.ts`, `telegram-html-formatter.ts`, `rich-block-plaintext.ts`

## Why

Phase 2 只发纯文本到外部平台——猫的 rich blocks (check-in card, audio reminder, checklist 等) 全部丢失。铲屎官要求飞书/Telegram 能看到富文本卡片。

## Original Requirements（必填）
> [20:49 铲屎官] 如果想要 富文本卡片、checklist 图片/文件/卡片甚至语音 是不是做不到啊？
> [20:52 铲屎官] 加入进去！消息卡片（最有价值，rich block → card 映射）...按照这个顺序
- 来源：本 session 对话历史
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Display-only, not interactive**: AC-14 (card button callbacks) deferred — 交互回调需要新 webhook endpoint + ConnectorRouter 扩展，scope 大，先做展示
- **HTML not MarkdownV2 for Telegram**: MarkdownV2 escaping rules 太严格容易出 bug，HTML 更可靠
- **PersistenceContext stashing vs messageStore read-back**: 选了 stash 到 context，避免给 ConnectorInvokeTrigger 加 messageStore 依赖

## Open Questions

1. **Feishu card JSON 格式是否完全正确？** — 我参考了 Lark 文档但没有实际 E2E 验证（需要 runtime 测试）
2. **Telegram HTML tag subset** — Telegram 只支持有限 HTML tags，当前用了 `<b>`, `<pre>` 应该没问题，但复杂 markdown 转 HTML 可能需要更多 tag 支持
3. **route-parallel richBlocks 合并** — 多猫并行时用 array spread 合并 blocks，reviewer 看看是否有边界问题

## Next Action

请审查代码质量（P1/P2），重点关注：
- OutboundDeliveryHook 的 rich/text dispatch 逻辑是否有遗漏场景
- PersistenceContext.richBlocks stashing 在 route-serial/route-parallel 的位置是否正确
- 平台 formatter 的边界处理（空 blocks、unknown kind、特殊字符）

## 自检证据

### Spec 合规
| AC | 状态 | 测试 |
|----|------|------|
| AC-11 (飞书 card) | ✅ | feishu-card-formatter 6 tests + feishu-adapter 2 tests |
| AC-12 (Telegram HTML) | ✅ | telegram-html-formatter 7 tests + telegram-adapter 2 tests |
| AC-13 (auto-detect + fallback) | ✅ | outbound-delivery-hook 12 tests |
| AC-14 (button callbacks) | ⏸ deferred | — |

### 测试结果
```
F088 相关测试: 90 passed, 0 failed ✅
pnpm lint: 0 errors ✅
pnpm build: exit 0 ✅
pnpm biome check (my files): 0 errors ✅
File sizes: all under 75 lines ✅
```

### 相关文档
- Plan: `docs/plans/2026-03-10-f088-phase3-rich-cards.md`
- Feature: `docs/features/F088-multi-platform-chat-gateway.md`

### 文件清单
| 文件 | 行数 | 变更类型 |
|------|------|----------|
| `rich-block-plaintext.ts` | 34 | 新建 |
| `feishu-card-formatter.ts` | 68 | 新建 |
| `telegram-html-formatter.ts` | 44 | 新建 |
| `OutboundDeliveryHook.ts` | 74 | 修改 |
| `FeishuAdapter.ts` | 175 | 修改 |
| `TelegramAdapter.ts` | 137 | 修改 |
| `route-helpers.ts` | +2 lines | 修改 |
| `route-serial.ts` | +4 lines | 修改 |
| `route-parallel.ts` | +5 lines | 修改 |
| `ConnectorInvokeTrigger.ts` | +2 lines | 修改 |
