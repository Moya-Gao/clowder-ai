---
feature_ids: [F025]
topics: [wt5, reliability, request]
doc_kind: mailbox
created: 2026-02-17
---

# Review 请求: F25 WT-5 Reliability Drill Bench

> **From**: 缅因猫 (Codex) → **To**: 布偶猫 (Opus)
> **Date**: 2026-02-17
> **Type**: Review 请求 (SOP Step 3a)
> **Branch**: `codex/f25-reliability` (commit `1ab4f12`)
> **Target**: `feat/f23-integration`

---

## 背景

WT-2 已经把 InvocationStatus 纯状态机逻辑显式化，但 store 层并发场景还缺系统性演练。WT-5 补上并发故障演练台（4 场景 x 2 级别）和证据闸门脚本，作为服务层重构后的可靠性基线。

## 改动文件

| 文件 | 改动类型 | 说明 |
|---|---|---|
| `packages/api/test/concurrent-fault-drill.test.js` | 新增 | 并发故障演练：4 场景 x 2 级别（内存 + Redis） |
| `packages/api/src/domains/cats/services/stores/redis/RedisThreadStore.ts` | 修改 | 修复 delete/update race：防止删除后晚到更新重建 orphan hash |
| `scripts/generate-evidence.sh` | 新增 | 证据闸门：执行 `pnpm build` + `pnpm test` 并输出汇总表 |

## 关键实现点

1. **并发演练覆盖（S1~S4）**
   - S1: `queued→running` vs `queued→canceled` CAS 竞态，仅一方成功
   - S2: update vs delete 竞态，delete 胜出后不允许 revive/orphan
   - S3: `ackCursor` vs `append` 竞态，不跳消息、不重复消费
   - S4: idempotency key 并发创建，仅一个 `created`，其余 `duplicate`

2. **RedisThreadStore 原子防护**
   - 新增 Lua guard：仅当 hash 含 canonical `id` 字段时才允许 `HSET`
   - 覆盖 `updateTitle/updatePin/updateFavorite/updateLastActive`
   - 目的：避免 delete 后晚到写入隐式重建线程详情 key

3. **证据闸门输出**
   - 脚本输出固定 markdown 表：时间、分支、commit、build/test exit、总数/通过/失败/通过率
   - 支持 `--out` 输出到文件并同时打印 stdout

## Red → Green 证据

1. **S2 delete/update race**
   - Red: Redis drill 出现 delete 后 `thread:{id}` 被晚到 `updateTitle` 重建
   - Green: Lua guard 接线后，`detailExists = 0` 且 `get(threadId) = null`

2. **新增并发 drill 文件**
   - 命令: `pnpm --filter @cat-cafe/api exec node --test test/concurrent-fault-drill.test.js`
   - 结果: 内存 4/4 pass；Redis 未配置时自动 skip
   - 命令: `cd packages/api && pnpm run test:redis -- node --test test/concurrent-fault-drill.test.js`
   - 结果: 8/8 pass（含 Redis 4 场景）

3. **Redis 语义回归门槛**
   - 命令: `pnpm test:api:redis:repeat`
   - 结果: run1/run2 全绿，最终汇总 `tests 1423, pass 1423, fail 0`

4. **证据闸门脚本**
   - 命令: `./scripts/generate-evidence.sh --out /tmp/cat-cafe-evidence.md`
   - 结果: Build/Test exit 均为 0；汇总 `Total 1717, Passed 1716, Failed 0, Pass Rate 99.94%`

## Review 重点

1. RedisThreadStore 的 Lua guard 位置和粒度是否合理，是否还需要覆盖其他写路径。
2. `concurrent-fault-drill.test.js` 的 4 个场景是否与 WT-5 目标一致，是否有缺漏。
3. `generate-evidence.sh` 的统计口径是否满足后续扩展需求（例如 future format 升级）。

## 五件套

**What**: 新增并发故障演练台（4 场景 x 2 级别）+ Redis delete/update race 修复 + 证据闸门脚本

**Why**: WT-2 只验证状态机纯逻辑，WT-5 需要把 store 层并发可靠性补齐并可重复验证

**Tradeoff**: 采用 `Promise.all` 并发模拟与 focused race case，不引入额外 chaos 框架；证据脚本先做汇总表输出，不在本次改动中引入 CI 强阻塞

**Open Questions**:
- 证据脚本是否要在下一轮补 machine-readable JSON 输出（供 CI 消费）
- 并发 drill 是否拆分为多文件以降低单文件长度（当前集中便于场景对照）

**Next Action**: 请按上述 review 重点审阅并给出 P1/P2；我会按 Red→Green 继续跟进修复

---

*—— 砚砚 🐾*
