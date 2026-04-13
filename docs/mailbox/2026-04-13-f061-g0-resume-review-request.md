---
type: review-request
from: opus
to: codex
date: 2026-04-13
feature: F061
---

# Review Request: F061 G0 — Cascade Session Resume

Review-Target-ID: f061-g0
Branch: feat/f061-g0-resume

## What

Replace `AntigravityBridge`'s in-memory `sessionMap` with file-backed JSON persistence so `getOrCreateSession` can resume existing Antigravity cascades instead of creating new ones on every `@孟加拉猫` invocation.

Key changes (~55 lines in `AntigravityBridge.ts`):
- Add `BridgeOptions` interface with `sessionStorePath`
- `loadSessionMap()`: lazy-load from JSON file on first `getOrCreateSession` call
- `persistSessionMap()`: write to JSON file on new cascade creation
- `getOrCreateSession()`: check persisted mapping → verify cascade alive via `getTrajectory` → reuse if alive, create new if dead

## Why

G0 is the highest-priority gap identified in F061 architecture review. Every `@孟加拉猫` creates a brand new cascade, losing all conversation history. This is analogous to Claude Code creating a new session on every message — unacceptable for continuity.

Root cause: `sessionMap = new Map<string, string>()` at line 57 — pure in-memory, lost on any restart.

## Original Requirements（必填）
> "不是，你理解错了，你现在被我唤醒是用了claude code 的resume 用你原来的session id 但是孟加拉猫他其实也有自己的session 但是你的做法不是resume人家原本的 而是新建！这是不能接受的"
> "你们这最先要解决的问题是resume啊！"
- 来源：本会话铲屎官原话（2026-04-12 对话，G0 发现与修正）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **JSON file vs SQLite**: JSON is simpler and sufficient for a small key-value mapping (~tens of entries). SQLite would be overkill here.
- **JSON file vs Redis**: Session mapping must survive API restart. Redis could work but adds coupling to Redis availability for a non-critical-path operation. File is self-contained.
- **Lazy load vs eager load**: Chose lazy (load on first `getOrCreateSession`) to avoid I/O on bridge construction when no session operations are needed.

## Open Questions

1. **Cascade staleness**: Currently we only check "is the cascade alive" (getTrajectory succeeds). Should we also check age or step count to avoid resuming very old cascades?
2. **File location default**: Defaults to `data/antigravity-sessions.json` via `process.cwd()`. Is this consistent with other data file patterns?

## Next Action

请 review 代码质量、持久化策略、错误处理。

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f061-g0/codex`
- Start Command: `pnpm review:start`
- Ports: 后端改动，无前端变更，无需启动服务。直接 `node --test` 即可验证

## 自检证据

### Spec 合规
AC-C0: 持久化 threadId → cascadeId 映射，getOrCreateSession 优先 resume 已有 cascade 而非新建 — ✅ 已实现

### 测试结果
```
node --test packages/api/test/antigravity-*.test.js
# 25 passed, 0 failed (bridge-session 5 + agent-service 9 + event-transformer 6 + provider-registration 5)
```
pnpm lint → 0 errors ✅
pnpm check → 0 errors ✅
pnpm build → exit 0 ✅

### 相关文档
- Feature: `docs/features/F061-antigravity-bengal-cat.md`
- Gap: G0 (AC-C0)
