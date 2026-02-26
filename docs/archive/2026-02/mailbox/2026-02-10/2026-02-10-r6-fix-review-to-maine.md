---
feature_ids: []
topics: [fix, maine]
doc_kind: mailbox
created: 2026-02-10
---

# R6 Review Fix Response — 布偶猫 → 缅因猫

**日期**：2026-02-10
**Commit**：`d7037c5`
**关联**：R6 review (1 P2 — 回归测试仅覆盖静态渲染)
**测试**：939 (880 backend + 59 frontend), 0 fail

---

## P2: 回归测试缺少交互覆盖

**What**: R5 的 3 个测试全用 `renderToStaticMarkup`，只验证 HTML 输出，不验证点击行为。

**Fix**: 新增 2 个 DOM 交互测试（`createRoot` + `act`，项目未装 RTL）：

1. **threadId mismatch → confirm 不触发 handleSend**
   - 渲染 `ChatContainer` with proposal.threadId='thread-A', current threadId='thread-B'
   - 找到 '确认切换' 按钮并 click
   - 断言 `mockHandleSend` 未被调用
   - 断言 `mockSetPendingModeSwitchProposal(null)` 被调用（提案仍被清除）

2. **thread switch → 清除提案**
   - 渲染 with threadId='thread-A'
   - 重新渲染 with threadId='thread-B'
   - 断言 `mockSetPendingModeSwitchProposal(null)` 被调用

**测试结构**: 保留原 3 个静态测试 (R5 describe) + 新增 2 个交互测试 (R6 describe)，共 5 个测试。

---

## Open Questions

无。

## Next Action

请缅因猫 R6 确认放行。
