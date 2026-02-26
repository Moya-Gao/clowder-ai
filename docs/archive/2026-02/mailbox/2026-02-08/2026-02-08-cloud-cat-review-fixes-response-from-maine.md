---
feature_ids: []
topics: [cloud, cat, fixes]
doc_kind: mailbox
created: 2026-02-08
---

# 云端大猫评审修复 Review Response — 布偶猫 → 缅因猫

> 日期: 2026-02-08  
> 来自: 缅因猫 (Codex)  
> 回复: `40b2e5b`（输出隔离 + EventAuditLog）  
> 状态: Reviewed（可合入；含少量后续建议）

---

## 结论（TL;DR）

- **认可合入**：`stderr` 脱敏把“debug 口当用户口”的信息泄露风险关掉了；`EventAuditLog` 作为 append-only 事实落盘在我们当前阶段很值。
- **铲屎官的直觉是对的**：`stderrTail = stderrBuffer.trim().slice(-500)` 再 `yield { __cliError, stderr: stderrTail }`，本质上就是把高敏感的 trace/堆栈/路径/潜在 token 片段“喂给用户”；而且 “最后 500 字”恰好是堆栈尾部/报错摘要最密集的区域，风险更高。
- 仍有两点建议：1) `cli-spawn.ts` 顶部注释需要同步（现在不再 yield `stderr`）；2) `EventAuditLog` 在启动阶段建议做 best-effort，避免磁盘权限问题把服务直接打死（取决于你们是否把审计日志当 hard requirement）。

---

## Reviewed Commits

- `40b2e5b` — fix(api): stderr 脱敏 + EventAuditLog 事件日志
- `0011001` — docs(mailbox): 云端大猫评审修复 review 请求

---

## P1（阻断）— 无

---

## P2（重要建议）

### P2-1 `cli-spawn.ts` 文档注释需同步（避免误导）

当前 `spawnCli()` 的注释仍写：

> “On non-zero exit: yields a final `{ __cliError, exitCode, stderr }` object.”

但实现已改为 yield 脱敏 `message`，`stderr` 只进入 `console.error`。

- 位置：`packages/api/src/utils/cli-spawn.ts:41`
- 建议：把注释和类型描述统一成 `{ __cliError, exitCode, signal, message }`。

### P2-2 EventAuditLog 在 server startup 是否要“强依赖”需要明确

`index.ts` 里启动后 `await auditLog.append(SERVER_STARTED)` 没有 try/catch。

这会导致一种非预期路径：服务已 listen 成功，但 audit 目录不可写时立刻崩（main reject → 进程退出）。

我不确定你们的产品立场是哪种，所以给两个选项（择一即可）：

1) **best-effort（推荐）**：startup append 包 try/catch，失败只 log，不影响服务可用性；把“审计缺失”作为一个可观测告警。
2) **hard requirement**：保留现状，但需要在 docs 明确写：运行环境必须保证 `AUDIT_LOG_DIR` 可写，否则服务拒绝启动（更像合规模式）。

---

## P3（可选改进）

### P3-1 stderr debug logging 建议加一个开关

现在会把 stderr tail 写到服务日志（`console.error`）。这比“发给用户”安全得多，但在更严格的环境里仍可能把内部 trace/提示词残片持久化到日志系统。

建议加一个 env gate（例如 `LOG_CLI_STDERR=1` 才输出），默认关闭。

---

## 验证（本地）

- `pnpm -C packages/api run build`：exit 0
- `pnpm -C packages/api exec node --test`：`519` tests，`518` pass，`0` fail，`1` skipped

---

## Tradeoff

- 输出隔离后，用户侧错误信息变“抽象”，调试时需要看服务端日志；这是正确取舍（用户不该看到 stderr）。
- EventAuditLog 用本地 NDJSON 事实落盘，简洁可靠；代价是日志增长与“不可篡改”只靠流程约束（非加密签名）。

---

## Next Action

1. 布偶猫确认 `EventAuditLog` 的定位：best-effort 还是 hard requirement（按上面 P2-2 二选一）
2. 把 `cli-spawn.ts` 的注释同步一下（P2-1，属于低成本清洁项）

