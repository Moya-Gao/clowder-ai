---
feature_ids: [F049]
topics: [mission-hub, phase3, review-request]
doc_kind: mailbox
created: 2026-03-02
---

# Review Request: F049 Phase3（lease atomicity + ratchet blocker UX）

@gpt52

## What
- 把 backlog lease 四条迁移（`acquire/heartbeat/release/reclaim`）改为 Redis Lua 原子更新，去掉读改写竞态窗口。
- 新增 Redis 并发回归测试：并发抢占 lease、heartbeat/reclaim 过期边界竞争。
- Mission Hub 增加 once/thread 策略阻断原因映射与提示（错误文案 + drawer 阻断说明）。
- 同步 F049 Feature 文档的 Phase3 进度勾选与时间线。

## Why
- Phase2 已可用，但高并发与语义可见性还没收口：如果不补原子迁移与阻断原因，进入多猫并发阶段风险过高。
- 对齐 F049 愿景里“全局调度 + 防并发故障”的核心约束，避免继续依赖隐式行为。

## Original Requirements（必填）
> “现在我要进行全局管理需要打开 vscode or webstorm 很麻烦”  
> “我们有一个全局跨thread的协同作战指挥中心。”  
> “我可以开五个thread召唤五组猫猫，让你们自己去backlog领取任务和协作。”  
> “还需要的机制得学习 claude code 的agent team 锁文件等 防止并发故障。”
- 来源：`docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- Lua 脚本当前以“单 item 原子迁移”为边界，未引入跨 item 事务；这轮目标是先消除 lease 关键竞态。
- UI 侧先做 once/thread 阻断原因显式化，未做更重的策略可视化配置面板（避免 Phase3 范围膨胀）。

## Open Questions
1. `release`/`reclaim` 的 no-op 返回（result=2）是否还需要区分出更细粒度错误码给 UI？
2. 是否要把 Lua 迁移模式推广到 `suggest/approve/dispatch` 三段链路（下一轮）？
3. `thread` scope 后续是否需要跨 item 的 Redis 原子约束（当前在 route 层判定）？

## Next Action
- 请重点看：
  - Lua 返回码与 `BacklogTransitionError` 映射是否一致、是否有漏网状态。
  - 并发测试是否足够证明“单 winner”不变量。
  - Mission Hub 阻断提示是否准确反映 API 语义（once/thread）。

## 自检证据

### Spec 合规
- Quality Gate 报告：`docs/mailbox/2026-03-02-f049-phase3-quality-gate.md`
- Plan：`docs/plans/2026-03-02-f049-phase3-ratchet-atomicity.md`
- Feature：`docs/features/F049-mission-control-backlog-center.md`

### 测试结果
```bash
env -u REDIS_URL pnpm --dir packages/api run build
env -u REDIS_URL node --test packages/api/test/backlog-routes.test.js packages/api/test/backlog-store.test.js
# ✅ 27 pass, 0 fail

pnpm --dir packages/api run test:redis -- node --test test/redis-backlog-store.test.js
# ✅ 2 pass, 0 fail

pnpm --dir packages/web test -- src/components/__tests__/mission-control-page.test.ts
# ✅ 14 pass, 0 fail

pnpm lint
# ✅ exit 0（existing warnings only）

pnpm --filter @cat-cafe/web build
# ✅ exit 0（existing warnings only）
```

### 相关文档
- Plan: `docs/plans/2026-03-02-f049-phase3-ratchet-atomicity.md`
- Feature: `docs/features/F049-mission-control-backlog-center.md`
- Discussion: `docs/discussions/2026-03-01-f049-mission-control-backlog-center/README.md`
