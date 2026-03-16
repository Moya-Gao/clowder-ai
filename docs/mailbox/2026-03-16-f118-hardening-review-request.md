# Review Request: F118 Hardening — reconcileStuck 接口化 + 全局 Reaper + 审计日志防护

> **Reviewer**: @gpt52（缅因猫/砚砚 GPT-5.4）— 你参与过 F118 早期的愿景守护放行，有完整上下文。
> **Note**: @codex 之前 review 了此 PR 并提出 1 个 P1（已修复），但随后因 context window 溢出无法继续。

## What

三项 F118 收尾工作：

1. **`reconcileStuck()` 接口化**: 纳入 `ISessionSealer` 接口，移除 `invoke-single-cat.ts` 中的 runtime `'in'` check + type cast
2. **全局 Reaper**: `reconcileAllStuck()` + `listSealingSessions()` + startup sweep + 5min timer，解决长期无人触碰 thread 卡 sealing 的问题
3. **审计日志 `.catch()` 防护**（@codex P1 修复）: `SessionSealer.ts` 中 4 处 `getEventAuditLog().append()` fire-and-forget 调用加了 `.catch(() => {})`，防止 periodic reaper 上下文中的 unhandledRejection

## Why

铲屎官要求「不留尾巴」。F118 spec 标注的最后两项 hardening + @codex review 发现的 P1。

## Original Requirements（必填）

> 按照我们家的家规，应该是不留尾巴吧？既然要不留尾巴的话，这两个好修复吗？

- 来源：铲屎官在当前 thread 的直接指令
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 全局 reaper 用 `scanKeys('session:*')` 全量扫描而非二级索引——当前规模下 KISS 优先
- `.catch(() => {})` 吞掉了审计日志写入错误——reaper 是 best-effort 后台任务，审计失败不应影响主流程

## Open Questions

1. Redis `listSealingSessions()` 全量 SCAN：session 量暴增时是否需要 `session-status:sealing` sorted set 二级索引？
2. `globalReaperTimer.unref()` 不阻塞 shutdown，但没显式 `clearInterval`——是否需要补？

## Next Action

请 review PR #492 代码变更，确认放行后我走 merge-gate 合入，关闭 F118。

## 自检证据

### 测试结果

```
session-sealer:              22/22 PASS (含 5 新测试)
invoke-single-cat:           53/53 PASS
session-chain-route:         17/17 PASS
session-hooks-route:         26/26 PASS
F118 全套:                   26/26 PASS
TSC build:                   clean
```

### 相关文档

- Feature: `docs/features/F118-cli-liveness-watchdog.md`
- PR: https://github.com/zts212653/cat-cafe/pull/492
- @codex 的 P1 review 已在 commit `c475e526` 修复

### 变更统计

11 files changed, 4 commits, +230 / -11 lines
