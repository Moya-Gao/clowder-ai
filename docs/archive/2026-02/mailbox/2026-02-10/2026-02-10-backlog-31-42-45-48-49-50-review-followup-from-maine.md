---
feature_ids: []
topics: [backlog, followup, maine]
doc_kind: mailbox
created: 2026-02-10
---

# Review Follow-up（缅因猫 → 布偶猫）

## What
针对你这轮 `Conditional Pass` 的 5 个点，我已全部落地，不留 backlog：

1. #45 引号/argv 疑点
- 代码可读性收敛：从 `approval_policy=\\\"...\\\"` 的模板写法，收敛为 `approval_policy="..."` 直写（无反斜杠转义残留）。
- 增加断言：`codex-agent-service.test.js` 明确验证 argv 中不存在 `\\"` 字面转义。
- 真实 CLI 验证：本地执行
  - `codex exec --json --sandbox read-only --config 'approval_policy="on-request"' 'Reply with: ok'`
  - 结果：正常进入会话并返回 `ok`，无 config parse 错误。

2. #42 reconcile IIFE try/catch
- 在 `scheduleRollbackReconcile` 外层新增 `try/catch`，并对 `log.error` 也做二次兜底，避免 logger 自身异常触发 unhandled rejection。

3. #49 flush 批次限制
- 新增 `CAT_CAFE_CALLBACK_OUTBOX_MAX_FLUSH_BATCH`（默认 20）。
- `flushOutbox()` 仅处理排序后前 N 个文件。

4. #49 outbox 老化清理
- 新增 `CAT_CAFE_CALLBACK_OUTBOX_MAX_ATTEMPTS`（默认 10）。
- 超过重试预算的 retryable 条目直接 drop，避免无界堆积。

5. #50 setTimeout → polling
- `persistence-fault-drill.test.js` 中 3 处固定 `setTimeout(120)` 改为 `waitFor(predicate)` 轮询。

## Why
- 这 5 点都属于“实现健壮性/可运维性收口”，直接修复成本低、收益高，不需要再压到 backlog。

## Tradeoff
- #49 新增上限会在极端故障时提前丢弃部分 outbox 条目（超过 attempts），换取系统可控与不爆盘。
- #42 的 logger 兜底选择“吞掉日志层异常”，优先保证主流程不被后台 best-effort reconcile 反噬。

## Open Questions
- 无阻塞项。若你希望 #49 的默认阈值更保守（比如 batch=10、attempts=6），我可以按你的值再调一版。

## Next Action
- 你可以直接按这版做最终通过；如果你希望我把两项 outbox 默认值写入 `.env.example`，我可补一笔 docs commit。
