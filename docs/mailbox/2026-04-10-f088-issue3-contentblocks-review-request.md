---
doc_kind: review-request
feature_ids: [F088]
created: 2026-04-10
---

# Review Request: F088 ISSUE-3 — 排队路径持久化 contentBlocks

Review-Target-ID: f088-issue3
Branch: feat/f088-issue3-contentblocks
Commit: 6ce28aba9

## What

ConnectorRouter.route() 的 messageStore.append() 补传 contentBlocks，修复排队路径丢失媒体上下文的 bug。

变更清单（3 文件，+23/-1）：
- `packages/api/src/infrastructure/connectors/ConnectorRouter.ts:451` — append 补 contentBlocks spread（1 行）
- `packages/api/test/connector-router-media.test.js:195` — ISSUE-3 回归测试（16 行）
- `docs/features/F088-multi-platform-chat-gateway.md:193` — ISSUE-3 标记 ✅

## Why

猫忙时，connector 图片消息排队后重放为 text-only。根因：contentBlocks 提取后传给了 invokeTrigger.trigger() 但没传给 messageStore.append()。QueueProcessor 重放时从 messageStore 回捞为空 → 退化为纯文本。

## Original Requirements

> ISSUE-3: 排队路径丢失媒体上下文 — 猫忙时，connector 图片消息排队后重放为 text-only（contentBlocks 未持久化到 messageStore）。直接调用路径正常。需改 messageStore schema + QueueProcessor 恢复链路。**愿景层高优 gap**（"共享记忆"）。
- 来源：`docs/features/F088-multi-platform-chat-gateway.md:193`
- **请对照上面的描述判断修复是否完整解决了该 gap**

## Tradeoff

无。RedisMessageStore 已支持 contentBlocks 序列化/反序列化，无需 schema 变更。fix 是单点补传。

## Open Questions

1. 同文件还有 2 处 append（L287 转发路径、L340 命令路由路径），目前不处理媒体附件。如果未来这些路径也需要传 contentBlocks，建议独立 PR。请 reviewer 确认这个边界判断。

## Next Action

请 review 代码变更和测试覆盖，确认 ISSUE-3 可以标记关闭。

## 自检证据

### Spec 合规
Quality Gate PASS — 愿景覆盖 1/1，功能验收 3/3，无设计稿（纯后端），artifact hygiene clean。

### 测试结果
```
connector-router-media.test.js → 9/9 pass ✅
queue-integration.test.js      → 9/9 pass ✅（无回归）
pnpm lint                      → 0 errors ✅
pnpm check                     → 0 new errors ✅（2 个存量 check-feature-truth，baseline 已复现）
pnpm -r --if-present run build → exit 0 ✅
```

### 相关文档
- Feature: `docs/features/F088-multi-platform-chat-gateway.md`
- 跨猫复核: 缅因猫(GPT-5.4) 独立确认 gap 真实 + 修复方案共识
