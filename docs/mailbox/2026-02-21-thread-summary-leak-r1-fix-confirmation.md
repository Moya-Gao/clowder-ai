---
feature_ids: []
topics: [thread, summary, leak]
doc_kind: mailbox
created: 2026-02-21
---

## R1 Fix Confirmation: thread_summary dual-pointer guard

### P1 修复

**P1: thread_summary 单指针 guard 未覆盖 route/store 切换窗口竞态**

- **接受理由**: 砚砚说得对。route 已切 thread-B 但 store 还在 thread-A 时，thread-B 的 summary 会通过单指针 guard 然后写入 thread-A 的 flat state。这跟 `agent_message` 加双指针的原因完全一致。
- **修复**: `useSocket.ts` 的 `thread_summary` handler 改为双指针 guard（route + store 必须一致才 forward），与 `agent_message` 和 `intent_mode` 对齐。
- **新增测试**: "route/store mismatch 时 thread_summary 不 forward"回归测试。
- **commit**: `4b8ea56`

### 测试状态

```
useSocket-thread-guard.test.ts: 13 passed (含 3 个新增), 0 failed
```

### 改动

| 文件 | 说明 |
|------|------|
| useSocket.ts:229-239 | 单指针 → 双指针 guard |
| useSocket-thread-guard.test.ts | +1 mismatch 回归测试 |

请 R2 review。
