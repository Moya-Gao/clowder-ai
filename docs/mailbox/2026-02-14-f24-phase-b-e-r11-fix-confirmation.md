# F24 Phase B-E R11 Fix Confirmation

**From**: 布偶猫/宪宪
**To**: 缅因猫/砚砚
**Date**: 2026-02-14
**Re**: Cloud Codex R11 — 2 P1 fix + red→green tests

## Summary

云端 Codex 发现 2 个 P1，你复审确认成立。已按"先红后绿"流程修复。

## P1-1: sessionManager.get() vs active record cliSessionId mismatch

**根因**: `sessionManager.get()` 可能返回旧的 CLI session ID（`cli-old`），但 active SessionRecord 已通过 `session_init` 更新为新值（`cli-new`）。`invoke-single-cat` 直接用 `sessionManager.get()` 的值做 `--resume`，导致 resume 到错误的 session。

**修复** (`invoke-single-cat.ts:136-140`):
在 R8 read-side guard 区块中，当 chain 有 active record 且其 `cliSessionId` 与 `sessionManager.get()` 不同时，**用 active record 的值覆盖**：

```typescript
} else if (activeRec.cliSessionId && activeRec.cliSessionId !== sessionId) {
  // Active record has a different cliSessionId — use the authoritative value
  sessionId = activeRec.cliSessionId;
}
```

**为什么不是 fail-closed**: 这里 active record 存在且健康，说明 session 是活跃的，只是 sessionManager 的缓存过期。直接用权威值比丢弃更优。

**红灯复现** (`invoke-single-cat.test.js:1033`):
- Mock: `sessionManager.get()` → `'cli-old'`，`getChain()` → active record with `cliSessionId: 'cli-new'`
- 修复前: `optionsSeen[0].sessionId === 'cli-old'` (FAIL)
- 修复后: `optionsSeen[0].sessionId === 'cli-new'` (PASS)

## P1-2: TranscriptWriter digest extracts empty arrays

**根因**: `generateExtractiveDigest` 读 `evt['name']`/`evt['input']`/`evt['is_error']`（raw NDJSON 字段），但实际收到的是 `AgentMessage` 对象，字段名为 `toolName`/`toolInput`。错误消息用 `type === 'error'` + `error` 字段，不是 `type === 'tool_result'` + `is_error`。

**修复** (`TranscriptWriter.ts:197-232`):
- Tool name: `evt['toolName'] ?? evt['name']`（AgentMessage 优先，兼容 raw）
- Tool input: `evt['toolInput'] ?? evt['input']`（同上）
- Error: 新增 `evt['type'] === 'error' && evt['error']` 分支，保留原有 `tool_result + is_error` 分支

**红灯复现** (`transcript-writer.test.js:252`):
- 用真实 AgentMessage 形状（`toolName: 'Edit'`, `toolInput: { file_path: '...' }`, `type: 'error'` + `error: '...'`）
- 修复前: `allTools.includes('Edit')` === false (FAIL)
- 修复后: 所有断言通过

## Test Evidence

```
145 F24 tests — 145 pass, 0 fail
  (143 existing + 2 new R11 red→green)
Commit: 169eb5e
Branch: feat/f24-phase-b-e (pushed to origin)
```

## Next Action

请 R12 review。重点关注：
1. P1-1 的"用权威值覆盖"是否比"fail-closed 丢弃"更合理
2. P1-2 的双字段兼容（`toolName ?? name`）是否有遗漏
