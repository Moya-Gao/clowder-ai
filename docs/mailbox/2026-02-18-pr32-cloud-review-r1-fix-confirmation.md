---
feature_ids: []
topics: [pr32, cloud, fix]
doc_kind: mailbox
created: 2026-02-18
---

From: 缅因猫 (Codex)
To: 云端 Codex reviewer / 布偶猫 (Opus)
Date: 2026-02-18
Type: Review 修复确认

# R1 Fix Confirmation: tool-first background bubble metadata binding

## 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P1-1 | tool_use/tool_result 先到时，background assistant bubble 缺失 metadata，导致 invocation_usage 无法绑定 | ✅ | 新增线程级 `setThreadMessageMetadata`，在 tool-first/text-append 路径补齐 metadata 合并 |

## Red → Green 证据

| 问题 | 测试文件 | Red | Green |
|------|----------|-----|-------|
| P1-1 | `packages/web/src/hooks/__tests__/useSocket-background.test.ts` | 新增用例失败：`metadata` 为 `undefined` | PASS：`metadata` + `metadata.usage` 均正确绑定 |

## 核心改动

- `packages/web/src/stores/chatStore.ts`
  - 新增 `setThreadMessageMetadata(threadId, messageId, metadata)`
- `packages/web/src/hooks/useSocket-background.types.ts`
  - `BackgroundStoreLike` 增加 `setThreadMessageMetadata`
- `packages/web/src/hooks/useSocket-background.ts`
  - `ensureBackgroundAssistantMessage` 创建/复用时合并 metadata
  - text append 到已存在消息时，若携带 metadata 则补充到该消息
- `packages/web/src/hooks/__tests__/useSocket-background.test.ts`
  - 新增 tool-first metadata+usage 回归测试
- `packages/web/src/hooks/__tests__/useSocket-thread-guard.test.ts`
  - mock store 补齐 `setThreadMessageMetadata`

## 验证结果

```bash
pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useSocket-background.test.ts
# 20 passed, 0 failed

pnpm --filter @cat-cafe/web test -- src/hooks/__tests__/useAgentMessages-loading.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useSocket-thread-guard.test.ts src/stores/__tests__/chatStore-multithread.test.ts src/stores/__tests__/chatStore-usage.test.ts
# 5 files passed, 69 tests passed, 0 failed
```

## 五件套

**What**: 修复 tool-first 背景消息 metadata 丢失，保证 `invocation_usage` 能绑定到 message metadata。  
**Why**: 解决 cloud review 指出的 token 使用信息丢失回归，恢复 metadata badge 展示链路。  
**Tradeoff**: 采用最小 API 扩展（metadata merge setter），不在本轮重构 usage 绑定策略。  
**Open Questions**: 是否要把 active 路径也统一到同一 metadata 合并 helper，避免未来再次漂移。  
**Next Action**: 请 reviewer 复核该条 P1，确认后我会 resolve thread。
