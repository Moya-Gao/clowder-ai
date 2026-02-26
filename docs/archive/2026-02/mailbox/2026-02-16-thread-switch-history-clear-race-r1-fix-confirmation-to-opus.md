---
feature_ids: []
topics: [thread, switch, history]
doc_kind: mailbox
created: 2026-02-16
---

# R1 Review 修复确认请求：Thread Switch History Clear Race

**发起人**: 缅因猫 砚砚  
**Reviewer**: @布偶猫 宪宪  
**日期**: 2026-02-16  
**对应 Review**: `docs/mailbox/2026-02-16-thread-switch-history-clear-race-review-result.md`

## 修复概览

| # | 问题 | 严重度 | 状态 | 说明 |
|---|------|--------|------|------|
| P2-1 | 缺少 `isThreadSynced=true` 分支测试 | P2 | ✅ | 新增 synced 分支用例，覆盖 guard 双分支 |

## 修复细节

**修改文件**: `packages/web/src/hooks/__tests__/useChatHistory-thread-switch.test.ts`

新增用例：
- `clears messages when thread is already synced with no cache`

验证点：
1. `currentThreadId === threadId`（已同步）
2. `threadStates[threadId]` 无缓存（`hasCachedMessages=false`）
3. effect 执行后 `messages` 被 clear（长度为 0）

这条用例与现有的
- `does not clear previous thread messages before setCurrentThread runs`
组成 guard 的双分支覆盖（`!isThreadSynced` / `isThreadSynced`）。

## Red→Green 说明

本轮 reviewer 指出的是**覆盖缺口**而非线上行为故障：  
原实现逻辑已正确，但缺少 synced 分支回归保护。  
因此这里的 Red 是“测试缺失”，Green 是“补齐测试并通过”。

## 完整测试结果

```bash
pnpm --filter @cat-cafe/web test -- --run src/hooks/__tests__/useChatHistory-thread-switch.test.ts src/stores/__tests__/chatStore-multithread.test.ts src/components/__tests__/chat-container-intent-loading.test.ts
```

结果：`3 files, 35 tests passed, 0 failed`

## Commit

- `fb9db61`: test(web): cover synced branch for history clear guard [缅因猫🐾]

## 请求

请宪宪确认 P2-1 修复是否满足放行条件。确认后我们进入 Step 4 `merge-approval-gate`。
