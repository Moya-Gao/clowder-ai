---
doc_kind: review-request
feature_ids: [F118]
created: 2026-04-12
---

# Review Request: F118 D3+D4 — InvocationTracker TTL Guard + QueueProcessor Zombie Defense

Review-Target-ID: f118-d3d4
Branch: feat/f118-phase-d3d4

## What

两项防御性加固，防止内存中的调用槽位（slot）泄漏后永久阻��后续调用：

1. **D3: InvocationTracker TTL Guard** — `has()` 方法加 TTL 检查，超过 75min（2.5× CLI timeout）的槽位自动清理并返回 false
2. **D4: QueueProcessor Zombie Defense** — `processingSlots` 从 `Set<string>` 改为 `Map<string, number>`（记录 startedAt），在 `tryAutoExecute` / `tryExecuteNextAcrossUsers` 入口加 zombie sweep。仅在 TTL 超时 **且** `invocationTracker.has()` 也返回 false 时才清理（双重确认防误杀）

## Why

D1+D2 已修复核心故障链（circuit breaker + spawn feedback），D3+D4 是纵深防御层：

- InvocationTracker 和 processingSlots 都是纯内存结构，无 TTL
- 如果 CLI 进程异常退出但 `.complete()` ��被调用，slot 会永久占用
- 被占用的 slot 会导致：tracker 误判"线程繁忙" → 新消息无法调度 → 铲屎官卡死

## Original Requirements（必填）
> 铲屎官报告两个线程的砚砚 @mention 5+ 分钟无响应... CLI 内部卡住 → 前端无反馈 → stall-kill → 新 session 也卡 → 熔断器永远不触发 → 用户持续无反馈
- 来源：`docs/plans/2026-04-11-f118-phase-d-invocation-resilience.md`
- **请对照上面的摘录判断：D3+D4 是否堵住了"slot 泄漏导致后续调用永久阻塞"这条故障路径**

## Tradeoff

- **75min TTL** 取 2.5× CLI hard timeout（30min × 2 stall-kill + 15min 安全余量）。比 InvocationRecord 的 Redis TTL（2h）更紧，因为内存 slot 阻塞比 Redis 记录残留更致命
- **QueueProcessor sweep 双重确认** — 只在 tracker 也判定过期时才释放 processingSlot。代价是 sweep 多一次 tracker 查询，但���免了误杀正在运行的慢调用

## Open Questions

1. D3 的 `isExpired()` 目前只在 `has()` 和 `getActiveSlots()` 触发。是否需要在 `cancel()` / `complete()` 等写路径也加？（当前判断：不需要，这些是显式生命周期操作）
2. `processingSlots` 从 private 改为无修饰符（供测试直接设值）。生产代码无外部访问，但可能有更优雅的方式？

## Next Action

请 reviewer 审查：
1. TTL 计算是否安全（不会误杀正常的长工具调用）
2. zombie sweep 双重确���逻辑是否严密
3. 多猫并发场景下 TTL 清理的隔离性

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/f118-d3d4/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 纯后端改动，无需启动 web

## 自检证据

### Spec 合规
- AC-D6 ✅: has() 对超过 TTL 的 slot 返回 false 并自动清理
- AC-D7 ✅: 长工具调用（TTL 内）不被误清理
- AC-D7b ✅: 多猫并发场景清理只影响超时 slot，不波及同 thread 其他 cat
- AC-D8 ✅: processingSlots 超时 + tracker 为空 → 自动清理
- AC-D9 ✅: tracker 仍活跃时不误清理

### 测试结果
- D3 tests: 6/6 pass (invocation-tracker-ttl.test.js)
- D4 tests: 4/4 pass (queue-processor-zombie.test.js)
- Existing tracker + queue tests: 119/119 pass (0 regressions)
- pnpm lint: 0 errors
- pnpm check: 0 errors
- pnpm build: exit 0

### 相关文档
- Plan: `docs/plans/2026-04-11-f118-phase-d-invocation-resilience.md`
- Feature: F118 (`docs/features/F118-cli-liveness-watchdog.md`)
