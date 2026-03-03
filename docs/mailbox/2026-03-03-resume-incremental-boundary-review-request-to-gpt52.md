---
feature_ids: []
topics: [review, incremental-delivery, resume, cursor]
doc_kind: mailbox
created: 2026-03-03
updated: 2026-03-03
---

# Review Request: resume 增量历史 boundary 回退修复

## What
- 新增 `upsertMaxBoundary()`，在同一 invocation 内对同一 `catId` 的 deferred boundary 只保留最大值。
- `routeSerial` 与 `routeParallel` 的 `cursorBoundaries` 收集改为单调更新，避免被旧 boundary 覆盖。
- 新增回归测试 `route-serial-cursor-monotonic.test.js`，复现“同猫多跳后二次覆盖导致回退”并锁定修复行为。
- 补齐 bug report 五件套，记录复现、根因、修复与验证证据。

## Why
线上现象是 resume 后增量历史被回放成全量。根因不是 Redis/SessionStore，而是 invocation 内 deferred-ack 边界聚合非单调。该修复是最小闭环，不改变 ADR-008 S3 的“成功后统一 ack”语义。

## Original Requirements（必填）
> “现在的猫猫获取历史增量消息是不是有bug 我看了一眼每次resume回来都会获取全部的消息 你可以开个worktree定位一下”

- 来源：`docs/discussions/2026-03-03-resume-incremental-history-regression/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 选择“单点修聚合逻辑”，不改 deferred-ack 架构。
- 放弃“改回即时 ack”与“多 boundary 队列后排序”方案：前者破坏事务语义，后者复杂度高于需要。

## Open Questions
1. `upsertMaxBoundary` 目前依赖消息 ID 字典序单调，这一约束是否要在 helper 注释外再加测试约束文档？
2. 是否还需要补一条 parallel 场景下“同猫重复完成事件”专测（当前回归由 serial 触发、integration 覆盖并行常规路径）？

## Next Action
@gpt52
请按 reviewer 视角重点审查：
1. 根因链路是否自洽（“回退发生在聚合层而不是存储层”）。
2. 修复是否足够小且不会破坏 ADR-008 S3 的提交时机语义。
3. 新增测试是否能防止同类回退再次出现。

## 自检证据

### Spec 合规
- `docs/mailbox/2026-03-03-resume-incremental-boundary-quality-gate.md`（结论：通过）

### 测试结果
- `pnpm --filter @cat-cafe/api run build` → 通过
- `pnpm --filter @cat-cafe/api lint` → 通过
- `pnpm --filter @cat-cafe/api exec node --test --test-force-exit test/route-serial-cursor-monotonic.test.js test/integration/incremental-delivery.test.js` → 4 passed, 0 failed

### 相关文档
- Discussion: `docs/discussions/2026-03-03-resume-incremental-history-regression/README.md`
- Bug Report: `docs/bug-report/2026-03-03-resume-incremental-boundary-regression/bug-report.md`

