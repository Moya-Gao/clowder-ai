# Review Request: F102 Phase I — Message-Level Permanence Repair

Review-Target-ID: f102-phase-i
Branch: feat/cat-cafe-f102-phase-i

## What

6 changes making passage indexing truly permanent:
1. **Stop deleting passages on rebuild** — `INSERT OR REPLACE` → `INSERT OR IGNORE`, removed `DELETE FROM evidence_passages` (AC-I2)
2. **JSONL transcript backfill** — `backfillPassagesFromTranscript()` reads events.jsonl, aggregates text per invocationId, inserts with `transcript-{invId}` namespace (AC-I1)
3. **Integrate backfill into rebuild()** — runs after Redis-based passage indexing, hot path unchanged (AC-I1/I3)
4. **dateFrom/dateTo time filtering** — `SearchOptions` gains `dateFrom`/`dateTo`, filtering in `searchPassages()` (created_at) and `search()` (updated_at), MCP tool schema updated (AC-I4)
5. **TTL documentation** — env-registry MESSAGE_TTL_SECONDS description clarified (AC-I5)
6. **Regression test** — E2E permanence test + hot-path benchmark <5ms (AC-I6)

## Why

金渐层 CVO 深度使用 `search_evidence` 后发现搜索结果会"消失"。根因：`indexPassages()` 从 Redis 拉消息（7天 TTL），rebuild 时先 DELETE 再 INSERT，Redis 消息过期后 passages 就没了。JSONL 是永久的但从未被用作 passage 数据源。

## Original Requirements

> 金渐层反馈："为什么搜索某段对话时能搜到，隔几天就搜不到了？"
> 砚砚分析："passage indexing 的数据源是 Redis messageListFn，7天 TTL 过期后 rebuild 会 DELETE 掉所有 passage 再重建——只有当时还在 Redis 里的消息会被重建"
> 砚砚命名："F102 message-level permanence repair"
- 来源：当前 session 讨论 + `docs/features/F102-memory-adapter-refactor.md` Phase I spec
- **请对照 AC-I1~I6 判断交付物是否完整解决了 passage 消失问题**

## Tradeoff

- **不做全量 JSONL→message 重建**：只提取 `type=text` 事件聚合为 passage，不还原完整 StoredMessage。复杂度低，够用。
- **passage_id 命名空间分离**：Redis 源 `msg-{id}` vs JSONL 源 `transcript-{invId}`，避免碰撞但也意味着同一条消息可能产生两条 passage（Redis 活着时两个源都会写）。`INSERT OR IGNORE` 保证幂等。
- **backfill 用 sync fs**：与 IndexBuilder 其他方法一致（全 `readdirSync`/`readFileSync`），rebuild 本身就是 blocking 操作。

## Open Questions

1. **position offset 10000** — JSONL passage 的 position 从 10000 开始，避免与 Redis 源 0-based position 交错。够吗？有没有更好的方案？
2. **dateTo inclusive 处理** — `dateTo='2026-03-20'` 自动补 `T23:59:59`，覆盖全天。这个行为 OK 吗？
3. **双源 passage 重复** — 同一轮对话在 Redis 活着时会同时有 `msg-xxx` 和 `transcript-invId` 两条 passage。搜索结果不会重复（不同 passage_id），但 passage 数量会膨胀。是否需要去重？

## Next Action

请 review 代码变更，重点关注 Open Questions 和 IndexBuilder 变更的正确性。

## 自检证据

### Spec 合规
AC-I1~I6 逐项验收通过（见 quality-gate report in session）

### 测试结果
```
node --test (memory suite) → 35/35 pass, 0 fail
pnpm lint                  → 0 errors
pnpm check                 → 0 errors
pnpm -r --if-present build → exit 0
```

### 相关文档
- Feature: `docs/features/F102-memory-adapter-refactor.md` (Phase I)
- Plan: `docs/plans/2026-03-30-f102-phase-i-permanence-repair.md`
- KD-45: L0/L1/L2 truth source hierarchy
- KD-46: KD-32 correction (Redis TTL ≠ 0)
