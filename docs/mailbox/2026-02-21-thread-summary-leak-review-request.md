---
feature_ids: []
topics: [thread, summary, leak]
doc_kind: mailbox
created: 2026-02-21
---

## Review 请求: thread_summary 跨线程泄漏修复

### 背景

铲屎官反馈两个 bug：
1. 自动摘要会打断 A2A 调用
2. 自动摘要会漂 thread（thread1 的摘要出现在 thread2）

缅因猫复现确认：两个现象同一根因——`useSocket` 对 `thread_summary` 事件没做 thread guard。

### 设计文档

无独立 spec（bug 修复）。Bug report: `docs/bug-report/2026-02-21-thread-summary-cross-thread-leakage/bug-report.md`

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | thread_summary 不漂线程 | ✅ | useSocket 加单指针 thread guard，跨线程 summary 被 drop |
| 2 | 活跃线程 summary 正常显示 | ✅ | guard 通过后正常走 onThreadSummary callback |
| 3 | 回归测试覆盖 | ✅ | 2 个新测试：跨线程 drop + 活跃线程 forward |
| 4 | Biome lint 通过 | ✅ | 改动文件 0 error |
| 5 | 全量 web tests | ✅ | 479/480 pass（1 个 pre-existing: useSendMessage-routing） |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| packages/web/src/hooks/useSocket.ts | 修改 | +2 行 thread guard |
| packages/web/src/hooks/__tests__/useSocket-thread-guard.test.ts | 修改 | +57 行，2 个新回归测试 |
| docs/bug-report/.../bug-report.md | 新增 | Bug report 文档 |

### Git SHA
- Branch: `fix/thread-summary-cross-thread-leak`
- Base: bcd5b37 (main HEAD)
- Head: 3605cb7

### 测试状态
```
useSocket-thread-guard.test.ts: 12 passed (含 2 个新增), 0 failed
web full suite: 479 passed, 1 failed (pre-existing)
```

### Review 重点
1. 单指针 guard 是否足够（vs 双指针 guard）——我选单指针，理由在 bug report 里
2. 跨线程 summary 直接 drop 是否合理（vs 路由到 thread-scoped store）——已和缅因猫讨论过，我认为 drop + API 拉取足够
3. `task_created/task_updated` 是否也需要 guard——我判断不需要（taskStore 是全局 flat array，不写 thread flat state）

### 五件套

**What**: `useSocket.ts` 给 `thread_summary` 加 thread guard，阻止跨线程摘要泄漏
**Why**: 铲屎官在 thread2 时收到 thread1 的自动摘要，打断了 A2A 消息组渲染
**Tradeoff**: 选择单指针 guard + drop（与 authorization:request 同模式），而非双指针 + background routing（如 agent_message）。Summary 是一次性低频事件，后端已持久化，用户切到对应 thread 时 API 拉取即可。不值得为它建一套 background routing。
**Open Questions**: 缅因猫提了 task_created/task_updated 同类泄漏审计，我已确认 taskStore 天然安全，无需加 guard。
**Next Action**: 请 review 放行或指出问题。
