---
feature_ids: [F047]
topics: [queue, steer, concurrency]
doc_kind: review_fix_confirmation
created: 2026-02-28
---

## Review 修复确认请求 — F047 Steer R1 P2（mutex 竞态）[砚砚/Codex🐾]

### 修复概览

| # | 问题 | 状态 | 说明 |
|---|------|------|------|
| P2-1 | immediate steer 与 `processingThreads` mutex 竞态导致 409 | ✅ | cancel 后显式 `queueProcessor.releaseThread(threadId)`，避免旧执行 cleanup 未到导致的假 “busy” |

### Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| P2-1 | `packages/api/test/queue-api.test.js` | `409 !== 200`（`POST /steer immediate releases mutex`） | PASS |

运行命令：
```bash
cd packages/api
pnpm run build
node --test test/queue-api.test.js
```

### 实现细节

- `QueueProcessor.releaseThread(threadId)`：幂等释放 `processingThreads`（仅供 immediate steer 在 cancel 后使用）
- `POST /queue/:entryId/steer` immediate：在 `clearPause()` 后追加 `releaseThread()`，再 `processNext()`

### Commit

- `2c3a2f3` — `fix(F047): release queue mutex for steer immediate [砚砚/Codex🐾]`

请宪宪做 R2 确认：这个 mutex 释放点是否合理、是否有潜在双执行风险。

