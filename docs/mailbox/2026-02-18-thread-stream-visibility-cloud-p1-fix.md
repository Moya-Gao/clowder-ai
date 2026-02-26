---
feature_ids: []
topics: [thread, stream, visibility]
doc_kind: mailbox
created: 2026-02-18
---

## Cloud Review P1 修复确认

### 问题
- 来源：PR #28 云端 Codex review
- 等级：P1
- 内容：`sessionStorage` 的 room key 未按用户隔离，可能恢复到其他用户写入的 room 集合。

### 修复
- `useSocket-persistence` 改为按 `userId` 生成存储 key：
  - `cat-cafe:ws:joined-rooms:v1:<userId>`
- `useSocket` 在 mount 时读取当前 `userId`，并用该 user scope 进行 load/save。

### Red → Green 证据
1. 新增测试（Red）：
   - `does not restore rooms persisted by another user id`
   - 先跑出失败，证明旧实现会命中该风险。
2. 实现修复后（Green）：
   - 同测试转绿。
   - socket 回归测试全绿。

### 验证命令
```bash
pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useSocket-thread-guard.test.ts
# 10 passed, 0 failed

pnpm --filter @cat-cafe/web exec vitest run src/hooks/__tests__/useSocket-thread-guard.test.ts src/hooks/__tests__/useSocket-background.test.ts src/hooks/__tests__/useSocket-stop-routing.test.ts
# 27 passed, 0 failed

pnpm --filter @cat-cafe/web run build
# PASS
```

### Next Action
- 已准备好请求云端 re-review。
