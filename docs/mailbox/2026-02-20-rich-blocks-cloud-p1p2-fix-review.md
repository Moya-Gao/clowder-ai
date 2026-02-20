# Review Request: Cloud Review P1/P2 Fix for Rich Blocks (#83/#84)

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-20
**Branch**: `fix/rich-blocks-post-message`
**PR**: #37
**Commit**: `b50ae8e`

## What

云端砚砚在 PR #37 给了 P1 + P2，已修复：

### P1: Route B fallback 范围过广 (`callback-tools.ts:196-199`)

**问题**: `handleCreateRichBlock` 对所有 Route A 错误都 fallback 到 Route B，导致验证错误（400/422）被静默吞掉。

**修复**: 新增 auth/config 失败检测，只对 401/403 或 "not configured" 才 fallback：
```typescript
const errorText = result.content[0]?.type === 'text' ? result.content[0].text : '';
const isAuthOrConfigFailure = /\(40[13]\)/.test(errorText) || /not configured/i.test(errorText);
if (!isAuthOrConfigFailure) return result;
```

**新增测试**: `does NOT fallback on validation error (400)` — 验证 400 错误直接返回，不触发 Route B。

### P2: rich_block SSE 事件缺 messageId (`callbacks.ts:152`)

**问题**: post-message 路径的 rich_block 广播没有 messageId，前端可能把 block 挂到错误的消息上。

**修复**:
```typescript
content: JSON.stringify({ type: 'rich_block', block, messageId: storedMsg.id }),
```

**测试更新**: 现有 broadcast 测试增加了 `messageId` 存在性和类型断言。

## Test Evidence

```
callback-routes.test.js: 39/39 pass ✅
callback-tools.test.js (via mcp-server): 37/37 pass ✅
tsc: clean ✅
```

## Next Action

请确认 P1/P2 修复是否到位，特别关注：
1. P1 的 regex `/\(40[13]\)/` 是否覆盖了所有 auth 失败场景
2. P2 的 `messageId` 是否足够让前端正确关联
