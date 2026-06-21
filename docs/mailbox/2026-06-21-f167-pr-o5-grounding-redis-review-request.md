# Review Request: F167 Phase O PR-O5 — Grounding Sample Store → Redis Persistence

Review-Target-ID: f167-pr-o5
Branch: feat/f167-pr-o5-grounding-redis

## What

将 GroundingSampleStore 从纯内存实现迁移到 Redis sorted set 持久化（8 天 TTL），解决进程重启丢失全部 grounding samples 的 P0 bug。

核心变更：
- 新增 `RedisGroundingSampleStore`（Redis sorted set + hash counters）
- 新增 `IGroundingSampleStore` 接口（sync/async 兼容，union return types）
- 启动时 `wireRedisGroundingSampleStore(redis)` 热切换
- 消费方 `record()` 调用加 `await`（`await undefined` 对 sync 路径透明）
- 10 个 Redis 集成测试（含 restart survival 测试）

7 files changed, 482 insertions, 18 deletions.

## Why

CVO 发现 eval 输入管道全是纯内存，重启即丢——eval 结果建立在空气上：

> "除了你们家的 不会其他的也是 不在 Redis，不在磁盘，不在任何持久化存储？！ 那我们的eval 都是bug啊！怎么可能不重启！"

spec L988 明确 PR-O5 scope：Redis-backed sample persistence。CVO 批准 8 天 TTL（691200s），避 race weekly eval cron（7 天窗口 + 1 天缓冲）。

## Original Requirements（必填）

> "除了你们家的 不会其他的也是 不在 Redis，不在磁盘，不在任何持久化存储？！ 那我们的eval 都是bug啊！怎么可能不重启！你快都看看！"
> "你自己的 这个走pr？ at你的小伙伴！自己走sop！"

- 来源：当前 thread 会话（2026-06-20 CVO 审视 eval 输入管道）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **选 sorted set（score=timestamp）而非 list**：需要 range query（按时间窗口取样本）+ 天然排序 + TTL 友好（ZRANGEBYSCORE）。List 做 range query 要全遍历。
- **`IGroundingSampleStore` 用 union return type（`void | Promise<void>`）而非纯 async**：保持既有 12 个同步测试不改动，`await undefined` 对 sync 路径零开销。纯 async 会要求所有测试和消费方同步改动。
- **8 天 TTL 而非 7 天**：CVO 批准。1 天缓冲避免 eval cron 运行时数据恰好过期。

## Architecture Ownership（必填）

Architecture cell: grounding（eval 输入管道）
Map delta: none
Why: 新增 RedisGroundingSampleStore 是 existing IGroundingSampleStore 的 Redis 实现，不改变 grounding cell 边界。singleton 模块新增 wire 函数 + getter，不新建并行 Store。

请 reviewer 检查：
- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **sampling counter 用 Redis hash vs string**：insufficient cap 用 `HINCRBY` on `grounding:insufficient:{day}` hash（field=`resolver:threadId`），verified cap 用 `INCR` on `grounding:verified:{day}` string。这两个 key 的 TTL 是 2 天（跨天 reset）——请确认 TTL 设计是否合理。
2. **FIFO eviction**：`ZREMRANGEBYRANK(key, 0, -(maxTotal+1))` 在每次 `record()` 后执行，保证 sorted set 不超过 maxTotal。请确认 rank 计算正确性。

### 价值 OQ（给 CVO，如有）

无。8 天 TTL 已获 CVO 批准，技术选择猫猫自决。

## Next Action

请 review 代码正确性 + Redis key 设计 + 采样规则实现。放行后我走 merge-gate。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f167-pr-o5/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Ports: 由 `pnpm review:start` 自动分配（3201+）

## 自检证据

### Spec 合规
- F167 spec L988 PR-O5 scope: Redis-backed sample persistence ✅
- 8-day TTL (691200s) per CVO directive ✅
- tips_exempt: "harness-internal shadow telemetry infra — no user-visible capability change"
- Hotfix pattern: false
- Follow-up tail scan: 0 hits
- Fallback layer check: 5 `??` operators = constructor defaults, not defensive fallback (false positive)

### 测试结果
```
pnpm test                → 504 files, 4411/4411 pass, 0 fail ✅
pnpm lint                → 0 errors ✅
pnpm check               → 0 errors ✅
pnpm -r --if-present build → exit 0 ✅
Redis integration tests  → 10/10 pass, 0 fail ✅
```

### 相关文档
- Feature: `docs/features/F167-a2a-chain-quality.md` (Phase O, L988)
- Spec cut: PR-O5 (Redis 7-day retention → 8-day per CVO)
