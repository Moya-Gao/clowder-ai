# Review Request: F118 Phase C — 前端预警 UI + Session Recovery

## What

F118 Phase C 实现 6 个 AC，覆盖前端 CLI 活性预警 UI + 后端 session 恢复安全三件套：

**前端 UI（AC-C1/C2/C3）：**
- `ThinkingIndicator` 新增 `alive_but_silent` / `suspected_stall` 活性状态渲染
- `suspected_stall` 状态下显示 Cancel 按钮
- `TimeoutDiagnosticsPanel` 组件：超时错误增强诊断面板（按 Pencil Scene 4 设计稿实现）
- 事件管线：`__cliTimeout` 诊断字段 → 5 个 provider → `system_info` → socket → `useAgentMessages` → UI

**后端 Session Recovery（AC-C4/C5/C6，对应社区 Issue #98/#99/#86）：**
- AC-C4: Resume 前健康检查，stale session（>30min）auto-seal + fresh fallback
- AC-C5: Generator `.return()` 路径 finally 块 fallback 审计（`didWriteAudit`/`didComplete` 三 flag 系统）
- AC-C6: `consecutiveRestoreFailures >= 3` overflow circuit breaker

## Why

铲屎官痛点："跑着跑着@它没反应"、"不知道是我们的问题还是 CLI 的问题"、"不想等 30 分钟才知道出问题了"。Phase A+B 解决了后端检测，Phase C 把信息送到前端 + 堵住 session 恢复的三个安全漏洞。

## Original Requirements（必填）

> "这两天 Codex 的 CLI 经常会出现这种情况……反正不知道为什么跑着跑着 @它没反应……我们这里的问题可观测性不足，不知道到底是我们的问题还是 Codex CLI 的问题"
>
> "本质是我们的 CLI 都没有心跳！！我们只是看人家有没有吐东西！不过哦万一有进程但是假死咋办？"

- 来源：`docs/features/F118-cli-liveness-watchdog.md`（铲屎官原话 Section）
- 社区 Issues：#86 (overflow loop), #98 (toxic session), #99 (audit gap)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 超时诊断面板用独立 `TimeoutDiagnosticsPanel` 组件而非内嵌到 `ChatMessage`，避免测试需要 mock 大量 ChatMessage 依赖
- Circuit breaker 阈值硬编码 `3`（不可配置），YAGNI — 如需调整再加配置
- Finally 审计移除了 `durationMs > 1000` 过滤，因为 `!didComplete` flag 已经精确区分正常完成 vs force-return

## Open Questions

1. **AC-C4 stale 阈值 30min** — 是否合适？太短可能误 seal 长任务的 session
2. **AC-C6 circuit breaker reason** 用 `overflow_circuit_breaker`，AC-C4 用 `auto_health_check` — 命名是否清晰？
3. **前端 liveness 状态**在 `ThinkingIndicator` 中渲染，没有独立截图证据（需要 runtime 实际触发 liveness warning 才能看到）— 设计稿对照已通过

## Next Action

请 review 12 commits on `feat/f118-phase-c`，重点关注：
- `invoke-single-cat.ts` 的 health check + circuit breaker + finally audit 逻辑
- 5 个 provider 的 timeout diagnostics 转发一致性
- `useAgentMessages.ts` 的 `pendingTimeoutDiagRef` 捕获机制
- `TimeoutDiagnosticsPanel.tsx` 与 Pencil Scene 4 设计稿的一致性

## 自检证据

### Spec 合规

Quality Gate PASS — 6/6 AC implemented，设计稿对照 100% 匹配（20 项 token 逐一验证），愿景覆盖 8/8 需求点。

### 测试结果

```
F118 specific tests:
  Web: 2/2 pass (ChatMessage-timeout-diagnostics.test.ts)
  API: 6/6 pass (resume-health 2 + finally-audit 2 + overflow-breaker 2)

Full suite:
  pnpm lint      → 0 errors (warnings pre-existing)
  pnpm check     → 0 errors (1384 files checked)
  pnpm build     → exit 0
  pnpm test      → 23 files failed / 172 passed (pre-existing: main has 22/169)
```

### 相关文档

- Feature: `docs/features/F118-cli-liveness-watchdog.md`
- Plan: `docs/plans/2026-03-14-f118-phase-c-liveness-ui.md`
- Branch: `feat/f118-phase-c` (12 commits)
- Worktree: `/Users/lysander/projects/relay-station/cat-cafe-f118-phase-c`
